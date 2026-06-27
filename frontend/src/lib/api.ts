/**
 * Backend API client. Talks to the Spring Boot backend (default http://localhost:8081).
 * Maps the backend CanonicalEvent shape into the frontend Transaction shape.
 */
import type {
  Transaction,
  TxnStatus,
  Channel,
  FraudAlertSummary,
  AlertDetail as AlertDetailT,
  AlertRow,
  FdsRule,
  ApiKey,
  IssuedKey,
  Stats,
  AccountBalance,
  ReconMismatch,
  ReconSummary,
} from '../data/types'

export const API_BASE = (import.meta.env.VITE_API_BASE as string) || 'http://localhost:8081'

/** Mirror of backend com.pggateway.ingest.CanonicalEvent */
interface CanonicalEvent {
  eventId: string
  txnRef: string
  channel: 'QRIS' | 'TRANSFER' | 'VIRTUAL_ACCOUNT' | 'DIRECT_DEBIT' | 'OTHER'
  amountMinor: number
  currency: string
  occurredAt: string
  status: string
  partitionKey: string
}

function mapChannel(c: string): Channel {
  if (c === 'QRIS') return 'QRIS'
  if (c === 'VIRTUAL_ACCOUNT') return 'Virtual Account'
  return 'Transfer'
}

function mapStatus(s: string): TxnStatus {
  const v = (s || '').toUpperCase()
  if (v.includes('PENDING')) return 'pending'
  if (v.includes('FLAG') || v.includes('DITANDAI') || v.includes('FRAUD')) return 'ditandai'
  return 'sukses' // "00" / SUCCESS / default
}

function hhmmss(iso: string): string {
  return new Date(iso).toLocaleTimeString('id-ID', { hour12: false })
}

function mapTxn(e: CanonicalEvent): Transaction {
  return {
    id: e.eventId,
    waktu: hhmmss(e.occurredAt),
    channel: mapChannel(e.channel),
    jumlah: Math.round(e.amountMinor / 100), // minor units (scale 2) -> rupiah
    status: mapStatus(e.status),
  }
}

export async function fetchTransactions(limit = 25): Promise<Transaction[]> {
  const res = await fetch(`${API_BASE}/api/transactions?limit=${limit}`)
  if (!res.ok) throw new Error(`API ${res.status}`)
  const data = (await res.json()) as CanonicalEvent[]
  return data.map(mapTxn)
}

const TYPES = ['QRIS_MPM', 'TRANSFER_INTRABANK', 'VIRTUAL_ACCOUNT', 'DIRECT_DEBIT']
const ACCOUNTS = ['ACC-9', 'ACC-21', 'ACC-37', 'ACC-55']

/** Sends one random SNAP mirror payload through the real ingest pipeline. */
export async function postRandomMirror(): Promise<void> {
  const n = Date.now()
  const type = TYPES[n % TYPES.length]
  const acc = ACCOUNTS[Math.floor(n / 7) % ACCOUNTS.length]
  const value = (((n % 900) + 50) * 1000).toFixed(2) // e.g. "350000.00"
  const payload = {
    externalId: `EXT-${n}`,
    partnerReferenceNo: `REF-${n}`,
    transactionType: type,
    amount: { value, currency: 'IDR' },
    sourceAccountNo: acc,
    beneficiaryAccountNo: 'ACC-merchant',
    latestTransactionStatus: '00',
    seq: null,
  }
  const res = await fetch(`${API_BASE}/api/ingest/mirror`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) throw new Error(`Ingest ${res.status}`)
}

// ---------- Fraud alerts (FDS) ----------

/** Mirror of backend com.pggateway.fds.Alert */
interface AlertDto {
  alertId: string
  txnEventId: string
  txnRef: string
  account: string
  channel: string
  amountMinor: number
  score: number
  rule: string
  ruleName: string
  report: string
  reasons: string[]
  status: 'OPEN' | 'CONFIRMED_FRAUD' | 'FALSE_POSITIVE'
  createdAt: string
}

/** Rules are dynamic now — prefer the backend-provided ruleName, fall back to the id. */
function alertTitle(a: AlertDto): string {
  return a.ruleName && a.ruleName.trim() ? a.ruleName : a.rule
}

function channelLabel(c: string): string {
  if (c === 'QRIS') return 'QRIS'
  if (c === 'VIRTUAL_ACCOUNT') return 'Virtual Account'
  if (c === 'TRANSFER') return 'Transfer'
  if (c === 'DIRECT_DEBIT') return 'Direct Debit'
  return c
}
function minutesAgo(iso: string): number {
  return Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000))
}

function toSummary(a: AlertDto): FraudAlertSummary {
  return {
    id: a.alertId,
    judul: alertTitle(a),
    score: a.score,
    menitLalu: minutesAgo(a.createdAt),
    report: a.report,
  }
}

function toDetail(a: AlertDto): AlertDetailT {
  const prioritas = a.score >= 80 ? 'tinggi' : a.score >= 60 ? 'sedang' : 'rendah'
  const jumlah = Math.round(a.amountMinor / 100)
  return {
    id: a.alertId,
    judul: alertTitle(a),
    channel: channelLabel(a.channel),
    jumlah,
    waktuRingkas: new Date(a.createdAt).toLocaleTimeString('id-ID', { hour12: false }),
    status: a.status === 'OPEN' ? 'terbuka' : 'ditutup',
    prioritas,
    score: a.score,
    rule: a.rule,
    report: a.report,
    konteks: {
      jumlah,
      channel: channelLabel(a.channel),
      merchant: '—',
      akunSumber: a.account,
      waktu: new Date(a.createdAt).toLocaleString('id-ID', { hour12: false }),
      txnRef: a.txnRef,
    },
    alasan: a.reasons,
  }
}

export async function fetchAlertSummaries(limit = 20): Promise<FraudAlertSummary[]> {
  const res = await fetch(`${API_BASE}/api/alerts?status=OPEN&limit=${limit}`)
  if (!res.ok) throw new Error(`API ${res.status}`)
  const data = (await res.json()) as AlertDto[]
  return data.map(toSummary)
}

function toRow(a: AlertDto): AlertRow {
  return {
    id: a.alertId,
    rule: a.rule,
    ruleName: alertTitle(a),
    report: a.report,
    account: a.account,
    amount: Math.round(a.amountMinor / 100),
    score: a.score,
    status: a.status,
    waktu: new Date(a.createdAt).toLocaleTimeString('id-ID', { hour12: false }),
  }
}

/** status: OPEN | CONFIRMED_FRAUD | FALSE_POSITIVE | ALL */
export async function fetchAlertList(status = 'OPEN', limit = 100): Promise<AlertRow[]> {
  const res = await fetch(`${API_BASE}/api/alerts?status=${encodeURIComponent(status)}&limit=${limit}`)
  if (!res.ok) throw new Error(`API ${res.status}`)
  return ((await res.json()) as AlertDto[]).map(toRow)
}

export async function fetchAlertDetail(id: string): Promise<AlertDetailT | null> {
  const res = await fetch(`${API_BASE}/api/alerts/${encodeURIComponent(id)}`)
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`API ${res.status}`)
  return toDetail((await res.json()) as AlertDto)
}

export async function postAlertVerdict(
  id: string,
  verdict: 'confirm_fraud' | 'false_positive',
): Promise<void> {
  const res = await fetch(`${API_BASE}/api/alerts/${encodeURIComponent(id)}/verdict`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ verdict }),
  })
  if (!res.ok) throw new Error(`Verdict ${res.status}`)
}

// ---------- FDS rules (dynamic, CRUD) ----------

export async function fetchRules(): Promise<FdsRule[]> {
  const res = await fetch(`${API_BASE}/api/rules`)
  if (!res.ok) throw new Error(`API ${res.status}`)
  return (await res.json()) as FdsRule[]
}

async function errorMessage(res: Response, fallback: string): Promise<string> {
  try {
    const body = (await res.json()) as { error?: string }
    return body.error ?? fallback
  } catch {
    return fallback
  }
}

export async function createRule(rule: Partial<FdsRule>): Promise<FdsRule> {
  const res = await fetch(`${API_BASE}/api/rules`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ enabled: true, score: 70, report: '', ...rule }),
  })
  if (!res.ok) throw new Error(await errorMessage(res, `Gagal membuat rule (${res.status})`))
  return (await res.json()) as FdsRule
}

export async function updateRule(id: string, patch: Partial<FdsRule>): Promise<FdsRule> {
  const res = await fetch(`${API_BASE}/api/rules/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  })
  if (!res.ok) throw new Error(await errorMessage(res, `Gagal memperbarui rule (${res.status})`))
  return (await res.json()) as FdsRule
}

export async function deleteRule(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/rules/${encodeURIComponent(id)}`, { method: 'DELETE' })
  if (!res.ok && res.status !== 204) throw new Error(`Gagal menghapus rule (${res.status})`)
}

// ---------- Developer / API keys ----------

export async function fetchKeys(): Promise<ApiKey[]> {
  const res = await fetch(`${API_BASE}/api/dev/keys`)
  if (!res.ok) throw new Error(`API ${res.status}`)
  return (await res.json()) as ApiKey[]
}

export async function createKey(body: {
  name: string
  env: string
  scopes: string[]
}): Promise<IssuedKey> {
  const res = await fetch(`${API_BASE}/api/dev/keys`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`Gagal membuat key (${res.status})`)
  return (await res.json()) as IssuedKey
}

export async function revokeKey(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/dev/keys/${encodeURIComponent(id)}`, { method: 'DELETE' })
  if (!res.ok && res.status !== 204) throw new Error(`Gagal mencabut key (${res.status})`)
}

// ---------- Ledger + stats ----------

export async function fetchStats(): Promise<Stats> {
  const res = await fetch(`${API_BASE}/api/stats`)
  if (!res.ok) throw new Error(`API ${res.status}`)
  return (await res.json()) as Stats
}

export async function fetchAccounts(limit = 50): Promise<AccountBalance[]> {
  const res = await fetch(`${API_BASE}/api/accounts?limit=${limit}`)
  if (!res.ok) throw new Error(`API ${res.status}`)
  return (await res.json()) as AccountBalance[]
}

// ---------- Reconciliation ----------

export async function fetchMismatches(): Promise<ReconMismatch[]> {
  const res = await fetch(`${API_BASE}/api/reconciliation/mismatches`)
  if (!res.ok) throw new Error(`API ${res.status}`)
  return (await res.json()) as ReconMismatch[]
}

export async function fetchReconSummary(): Promise<ReconSummary> {
  const res = await fetch(`${API_BASE}/api/reconciliation/summary`)
  if (!res.ok) throw new Error(`API ${res.status}`)
  return (await res.json()) as ReconSummary
}

export async function resolveMismatch(txnRef: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/reconciliation/${encodeURIComponent(txnRef)}/resolve`, {
    method: 'POST',
  })
  if (!res.ok && res.status !== 204) throw new Error(`Gagal menyelesaikan (${res.status})`)
}

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
  AuditEntry,
} from '../data/types'

export const API_BASE = (import.meta.env.VITE_API_BASE as string) || 'http://localhost:8081'

// ---------- Auth: bearer-token injection + 401 handling (installed once) ----------
let authToken: string | null = null
let onUnauthorized: (() => void) | null = null
export function setAuthToken(token: string | null) { authToken = token }
export function setUnauthorizedHandler(fn: () => void) { onUnauthorized = fn }

const _origFetch = window.fetch.bind(window)
window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
  let nextInit = init
  if (url.startsWith(API_BASE) && authToken && !url.includes('/api/auth/login')) {
    nextInit = {
      ...init,
      headers: { ...(init?.headers as Record<string, string> | undefined), Authorization: `Bearer ${authToken}` },
    }
  }
  const res = await _origFetch(input, nextInit)
  if (res.status === 401 && url.startsWith(API_BASE) && !url.includes('/api/auth/')) {
    onUnauthorized?.() // token expired/invalid -> drop to login
  }
  return res
}

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

/** ?tenant=PJP when a specific tenant is selected; '' for the platform-wide ('all') view. */
function tenantParam(tenant?: string): string {
  return tenant && tenant !== 'all' ? `&tenant=${encodeURIComponent(tenant)}` : ''
}

export async function fetchTenants(): Promise<string[]> {
  const res = await fetch(`${API_BASE}/api/tenants`)
  if (!res.ok) throw new Error(`API ${res.status}`)
  return (await res.json()) as string[]
}

export async function fetchTransactions(limit = 25, tenant?: string): Promise<Transaction[]> {
  const res = await fetch(`${API_BASE}/api/transactions?limit=${limit}${tenantParam(tenant)}`)
  if (!res.ok) throw new Error(`API ${res.status}`)
  const data = (await res.json()) as CanonicalEvent[]
  return data.map(mapTxn)
}

const TYPES = ['QRIS_MPM', 'TRANSFER_INTRABANK', 'VIRTUAL_ACCOUNT', 'DIRECT_DEBIT']
const ACCOUNTS = ['ACC-9', 'ACC-21', 'ACC-37', 'ACC-55']

export interface SimulateResult {
  outcome: string; eventId: string; tenant: string; scored: boolean
  score: number; band: string; alertRaised: boolean
  signals: { label: string; category: string; points: number }[]
}
export interface SimulatePayload {
  externalId: string; partnerReferenceNo: string; transactionType: string
  amount: { value: string; currency: string }
  sourceAccountNo: string; beneficiaryAccountNo: string; latestTransactionStatus: string; seq: null
}

/** Run an explicit transaction scenario through the real pipeline (JWT-authed sandbox). */
export async function simulateTxn(payload: SimulatePayload): Promise<SimulateResult> {
  const res = await fetch(`${API_BASE}/api/dev/simulate`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
  })
  if (!res.ok) throw new Error(await errorMessage(res, `Simulasi gagal (${res.status})`))
  return (await res.json()) as SimulateResult
}

/**
 * Fires one transaction through the real pipeline via the JWT-authed dev sandbox (not the
 * SNAP-signed partner ingest). Returns the live risk assessment so the UI can show score + signals.
 */
export async function postRandomMirror(): Promise<SimulateResult> {
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
  return simulateTxn(payload)
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
  band: string
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
    band: a.band,
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

export async function fetchAlertSummaries(limit = 20, tenant?: string): Promise<FraudAlertSummary[]> {
  const res = await fetch(`${API_BASE}/api/alerts?status=OPEN&limit=${limit}${tenantParam(tenant)}`)
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
    band: a.band,
    status: a.status,
    waktu: new Date(a.createdAt).toLocaleTimeString('id-ID', { hour12: false }),
  }
}

/** status: OPEN | CONFIRMED_FRAUD | FALSE_POSITIVE | ALL */
export async function fetchAlertList(status = 'OPEN', limit = 100, tenant?: string): Promise<AlertRow[]> {
  const res = await fetch(
    `${API_BASE}/api/alerts?status=${encodeURIComponent(status)}&limit=${limit}${tenantParam(tenant)}`,
  )
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

// ---------- FDS watchlist (dynamic blocklist) ----------
export async function fetchWatchlist(): Promise<string[]> {
  const res = await fetch(`${API_BASE}/api/fds/watchlist`)
  if (!res.ok) throw new Error(`API ${res.status}`)
  return (await res.json()) as string[]
}

export async function addWatchlist(account: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/fds/watchlist`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ account }),
  })
  if (!res.ok) throw new Error(await errorMessage(res, `Gagal menambah daftar pantau (${res.status})`))
}

export async function removeWatchlist(account: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/fds/watchlist/${encodeURIComponent(account)}`, { method: 'DELETE' })
  if (!res.ok && res.status !== 204) throw new Error(`Gagal menghapus dari daftar pantau (${res.status})`)
}

// ---------- FDS ML model (confidential — ADMIN/ANALYST) ----------
export interface ModelMetrics {
  n: number; tp: number; fp: number; tn: number; fn: number
  precision: number; recall: number; f1: number; accuracy: number; auc: number
}
export interface FeatureWeight { feature: string; weight: number }
export interface TrainingRun {
  version: number; trainedAt: string; samples: number; positives: number; negatives: number
  holdout: number; metrics: ModelMetrics; championF1Before: number; autoPromoted: boolean; status: string
}
export interface ModelSnapshot {
  modelType: string; championVersion: number; trained: boolean; featureCount: number
  labelledSamples: number; positives: number; negatives: number; openUnlabelled: number
  championMetrics: ModelMetrics; challengerVersion: number; challengerMetrics: ModelMetrics | null
  weights: FeatureWeight[]; history: TrainingRun[]
}

export async function fetchModel(): Promise<ModelSnapshot> {
  const res = await fetch(`${API_BASE}/api/fds/model`)
  if (!res.ok) throw new Error(`API ${res.status}`)
  return (await res.json()) as ModelSnapshot
}

export async function trainModel(): Promise<TrainingRun> {
  const res = await fetch(`${API_BASE}/api/fds/model/train`, { method: 'POST' })
  if (!res.ok) throw new Error(await errorMessage(res, `Gagal melatih model (${res.status})`))
  return (await res.json()) as TrainingRun
}

export async function promoteModel(): Promise<boolean> {
  const res = await fetch(`${API_BASE}/api/fds/model/promote`, { method: 'POST' })
  if (!res.ok) throw new Error(await errorMessage(res, `Gagal promosi model (${res.status})`))
  return ((await res.json()) as { promoted: boolean }).promoted
}

// ---------- FDS lists (block / warning / allow — ADMIN/ANALYST) ----------
export type ListAction = 'BLOCK' | 'WARNING' | 'ALLOW'
export type ListEntityType = 'ACCOUNT' | 'BIN' | 'DEVICE' | 'IP' | 'COUNTRY'
export interface FdsListEntry {
  id: string; action: ListAction; entityType: ListEntityType; value: string; reason: string; createdAt: string
}

export async function fetchLists(): Promise<FdsListEntry[]> {
  const res = await fetch(`${API_BASE}/api/fds/lists`)
  if (!res.ok) throw new Error(`API ${res.status}`)
  return (await res.json()) as FdsListEntry[]
}

export async function addListEntry(body: { action: ListAction; entityType: ListEntityType; value: string; reason: string }): Promise<FdsListEntry> {
  const res = await fetch(`${API_BASE}/api/fds/lists`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(await errorMessage(res, `Gagal menambah entri (${res.status})`))
  return (await res.json()) as FdsListEntry
}

export async function removeListEntry(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/fds/lists/${encodeURIComponent(id)}`, { method: 'DELETE' })
  if (!res.ok && res.status !== 204) throw new Error(`Gagal menghapus entri (${res.status})`)
}

// ---------- FDS Entity 360 / investigation (ADMIN/ANALYST) ----------
export interface EntityTxn { txnRef: string; channel: string; amountMinor: number; direction: 'IN' | 'OUT'; counterparty: string; occurredAt: string }
export interface EntityAlert { alertId: string; score: number; band: string; rule: string; report: string; status: string; createdAt: string }
export interface EntityListHit { action: 'BLOCK' | 'WARNING' | 'ALLOW'; reason: string }
export interface EntityCounterparty { account: string; count: number; sentTo: number; receivedFrom: number }
export interface EntityStats { txnCount: number; alertCount: number; confirmedFraud: number; counterparties: number; totalInMinor: number; totalOutMinor: number }
export interface Entity360 {
  account: string; tenant: string | null; stats: EntityStats; listHits: EntityListHit[]
  transactions: EntityTxn[]; alerts: EntityAlert[]; counterparties: EntityCounterparty[]
}

export async function fetchEntity(account: string): Promise<Entity360> {
  const res = await fetch(`${API_BASE}/api/fds/entity/${encodeURIComponent(account)}`)
  if (!res.ok) throw new Error(`API ${res.status}`)
  return (await res.json()) as Entity360
}

// ---------- FDS scoring config (maintainable detectors — ADMIN/ANALYST) ----------
export interface ScoringLayer { enabled: boolean; weight: number }
export interface ScoringConfigSnapshot {
  layers: Record<string, ScoringLayer>
  mediumCutoff: number; highCutoff: number; criticalCutoff: number
}
export interface ScoringConfigUpdate {
  layers: { category: string; enabled: boolean; weight: number }[]
  mediumCutoff: number; highCutoff: number; criticalCutoff: number
}

export async function fetchScoringConfig(): Promise<ScoringConfigSnapshot> {
  const res = await fetch(`${API_BASE}/api/fds/scoring-config`)
  if (!res.ok) throw new Error(`API ${res.status}`)
  return (await res.json()) as ScoringConfigSnapshot
}

export async function updateScoringConfig(body: ScoringConfigUpdate): Promise<ScoringConfigSnapshot> {
  const res = await fetch(`${API_BASE}/api/fds/scoring-config`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(await errorMessage(res, `Gagal menyimpan konfigurasi (${res.status})`))
  return (await res.json()) as ScoringConfigSnapshot
}

// ---------- Buku Besar (general ledger) ----------
export interface GlTrialLine { code: string; name: string; type: string; debitMinor: number; creditMinor: number }
export interface GlTrialBalance { lines: GlTrialLine[]; totalDebitMinor: number; totalCreditMinor: number; balanced: boolean }
export interface GlSafeguarding {
  customerFundsMinor: number; backingAssetsMinor: number; surplusMinor: number; feeRevenueMinor: number; coveragePct: number
}
export interface GlPosting { accountCode: string; accountName: string; type: string; debit: boolean; amountMinor: number }
export interface GlJournalEntry {
  id: string; tenantId: string; txnRef: string; occurredAt: string; description: string; postings: GlPosting[]
}

export async function fetchTrialBalance(tenant?: string): Promise<GlTrialBalance> {
  const q = tenant && tenant !== 'all' ? `?tenant=${encodeURIComponent(tenant)}` : ''
  const res = await fetch(`${API_BASE}/api/ledger/trial-balance${q}`)
  if (!res.ok) throw new Error(`API ${res.status}`)
  return (await res.json()) as GlTrialBalance
}

export async function fetchSafeguarding(tenant?: string): Promise<GlSafeguarding> {
  const q = tenant && tenant !== 'all' ? `?tenant=${encodeURIComponent(tenant)}` : ''
  const res = await fetch(`${API_BASE}/api/ledger/safeguarding${q}`)
  if (!res.ok) throw new Error(`API ${res.status}`)
  return (await res.json()) as GlSafeguarding
}

export async function fetchJournal(tenant?: string, limit = 50): Promise<GlJournalEntry[]> {
  const res = await fetch(`${API_BASE}/api/ledger/journal?limit=${limit}${tenantParam(tenant)}`)
  if (!res.ok) throw new Error(`API ${res.status}`)
  return (await res.json()) as GlJournalEntry[]
}

// ---------- Platform admin (super-admin only) ----------
export interface AdminTenant { id: string; name: string; status: string; env: string; createdAt: string }
export interface AdminUser { username: string; displayName: string; role: string; tenantId: string | null }

export async function fetchAdminTenants(): Promise<AdminTenant[]> {
  const res = await fetch(`${API_BASE}/api/admin/tenants`)
  if (!res.ok) throw new Error(`API ${res.status}`)
  return (await res.json()) as AdminTenant[]
}

export async function registerTenant(body: { id: string; name: string; env: string }): Promise<AdminTenant> {
  const res = await fetch(`${API_BASE}/api/admin/tenants`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(await errorMessage(res, `Gagal registrasi tenant (${res.status})`))
  return (await res.json()) as AdminTenant
}

export async function setTenantStatus(id: string, status: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/admin/tenants/${encodeURIComponent(id)}/status`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }),
  })
  if (!res.ok) throw new Error(`API ${res.status}`)
}

export async function fetchAdminUsers(): Promise<AdminUser[]> {
  const res = await fetch(`${API_BASE}/api/admin/users`)
  if (!res.ok) throw new Error(`API ${res.status}`)
  return (await res.json()) as AdminUser[]
}

export async function createAdminUser(body: {
  username: string; password: string; displayName: string; role: string; tenant: string | null
}): Promise<AdminUser> {
  const res = await fetch(`${API_BASE}/api/admin/users`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(await errorMessage(res, `Gagal membuat user (${res.status})`))
  return (await res.json()) as AdminUser
}

export async function impersonateTenant(tenantId: string): Promise<{ token: string; user: AdminUser }> {
  const res = await fetch(`${API_BASE}/api/admin/impersonate`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tenantId }),
  })
  if (!res.ok) throw new Error(await errorMessage(res, `Gagal impersonate (${res.status})`))
  return (await res.json()) as { token: string; user: AdminUser }
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

export async function fetchStats(tenant?: string): Promise<Stats> {
  const q = tenant && tenant !== 'all' ? `?tenant=${encodeURIComponent(tenant)}` : ''
  const res = await fetch(`${API_BASE}/api/stats${q}`)
  if (!res.ok) throw new Error(`API ${res.status}`)
  return (await res.json()) as Stats
}

export async function fetchAccounts(limit = 50, tenant?: string): Promise<AccountBalance[]> {
  const res = await fetch(`${API_BASE}/api/accounts?limit=${limit}${tenantParam(tenant)}`)
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

// ---------- Audit log ----------

export async function fetchAudit(limit = 100): Promise<AuditEntry[]> {
  const res = await fetch(`${API_BASE}/api/audit?limit=${limit}`)
  if (!res.ok) throw new Error(`API ${res.status}`)
  return (await res.json()) as AuditEntry[]
}

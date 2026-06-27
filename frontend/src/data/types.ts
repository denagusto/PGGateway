export type TxnStatus = 'sukses' | 'pending' | 'ditandai'

export type Channel = 'QRIS' | 'Transfer' | 'Virtual Account'

export interface Transaction {
  id: string
  waktu: string // HH:MM:SS
  channel: Channel
  jumlah: number
  status: TxnStatus
}

export interface FraudAlertSummary {
  id: string
  judul: string
  score: number
  menitLalu: number
  report?: string // 'LTKM' | 'LTKT' (PPATK)
}

// Row in the FDS alert queue
export interface AlertRow {
  id: string
  rule: string
  ruleName: string
  report: string
  account: string
  amount: number
  score: number
  band: string // LOW | MEDIUM | HIGH | CRITICAL
  status: string // 'OPEN' | 'CONFIRMED_FRAUD' | 'FALSE_POSITIVE'
  waktu: string // HH:MM:SS
}

export interface Kpi {
  label: string
  value: string
  sub?: string
  subTone?: 'muted' | 'success' | 'warning' | 'danger'
  valueTone?: 'ink' | 'success' | 'warning' | 'danger'
  trend?: 'up' | 'down' // renders a lucide icon (not a char)
}

export interface AlertDetail {
  id: string
  judul: string
  channel: string
  jumlah: number
  waktuRingkas: string // e.g. "10:42:05"
  status: 'terbuka' | 'ditutup'
  prioritas: 'tinggi' | 'sedang' | 'rendah'
  score: number
  band: string // LOW | MEDIUM | HIGH | CRITICAL
  rule: string
  report?: string // 'LTKM' | 'LTKT' (PPATK)
  konteks: {
    jumlah: number
    channel: string
    merchant: string
    akunSumber: string
    waktu: string
    txnRef: string
  }
  alasan: string[]
}

// FDS dynamic rule (mirrors backend com.pggateway.fds.rules.Rule)
export interface FdsRule {
  id: string
  name: string
  report: string // 'LTKM' | 'LTKT' | ''
  enabled: boolean
  score: number
  expression: string // SpEL formula over transaction features
}

// Developer / API keys (mirrors backend com.pggateway.developer.ApiKey)
export interface ApiKey {
  id: string
  tenantId: string
  name: string
  prefix: string
  scopes: string[]
  env: string // 'sandbox' | 'production'
  status: string // 'active' | 'revoked'
  createdAt: string
  lastUsedAt: string | null
}
export interface IssuedKey {
  key: ApiKey
  apiKey: string // shown once
  secret: string // shown once
}

// Real dashboard stats + ledger balances (mirror backend)
export interface Stats {
  txnCount: number
  totalVolumeMinor: number
  openAlerts: number
  activeAccounts: number
  rulesActive: number
}
export interface AccountBalance {
  account: string
  balanceMinor: number
  txnCount: number
}

// Reconciliation (mirror backend com.pggateway.recon)
export interface ReconMismatch {
  id: string
  txnRef: string
  amountPjpMinor: number | null
  amountCounterpartyMinor: number | null
  diffMinor: number | null
  type: string // 'selisih_nominal' | 'satu_sisi'
  resolved: boolean
}
export interface ReconSummary {
  matched: number
  mismatchOpen: number
  diffMinorTotal: number
}

// Audit entry (mirror backend com.pggateway.audit.AuditEntry)
export interface AuditEntry {
  id: string
  timestamp: string
  actor: string
  action: string
  target: string
  detail: string
}

export type MismatchStatus = 'selisih nominal' | 'satu sisi' | 'cocok'

export interface Mismatch {
  id: string
  txnRef: string
  jumlah: number
  sisiPjp: number
  sisiCounterparty: number | null // null = tidak ada (one-sided)
  selisih: number | null
  window: string // HH:MM
  status: MismatchStatus
}

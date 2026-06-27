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
}

export interface Kpi {
  label: string
  value: string
  sub?: string
  subTone?: 'muted' | 'success' | 'warning' | 'danger'
  valueTone?: 'ink' | 'success' | 'warning' | 'danger'
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
  rule: string
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

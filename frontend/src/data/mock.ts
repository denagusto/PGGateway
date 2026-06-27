import type {
  AlertDetail,
  FraudAlertSummary,
  Kpi,
  Mismatch,
  Transaction,
} from './types'

/**
 * MOCK DATA — no backend yet. Mirrors docs/mockups/pg-mockups.png exactly.
 * Wrapped behind tiny "fetch" helpers so screens read like real data screens.
 */

// ── Dashboard ────────────────────────────────────────────────────────────────
export const dashboardKpis: Kpi[] = [
  {
    label: 'TPS sekarang',
    value: '1.284',
    sub: '6% vs 1 jam lalu',
    subTone: 'success',
    valueTone: 'ink',
    trend: 'up',
  },
  {
    label: 'Transaksi hari ini',
    value: '3,1 jt',
    sub: 'Rp 482 M',
    subTone: 'muted',
    valueTone: 'ink',
  },
  {
    label: 'Alert fraud terbuka',
    value: '7',
    sub: '2 prioritas tinggi',
    subTone: 'danger',
    valueTone: 'danger',
  },
  {
    label: 'Mismatch rekonsiliasi',
    value: '12',
    sub: 'selisih Rp 1,4 jt',
    subTone: 'warning',
    valueTone: 'warning',
  },
  {
    label: 'Lag projection',
    value: '0,8 dtk',
    sub: 'sehat (< 2 dtk)',
    subTone: 'success',
    valueTone: 'ink',
  },
]

export const transactions: Transaction[] = [
  { id: 't1', waktu: '10:42:07', channel: 'QRIS', jumlah: 75_000, status: 'sukses' },
  { id: 't2', waktu: '10:42:07', channel: 'Transfer', jumlah: 2_500_000, status: 'sukses' },
  { id: 't3', waktu: '10:42:06', channel: 'QRIS', jumlah: 19_000, status: 'pending' },
  { id: 't4', waktu: '10:42:06', channel: 'Virtual Account', jumlah: 540_000, status: 'sukses' },
  { id: 't5', waktu: '10:42:05', channel: 'QRIS', jumlah: 1_200_000, status: 'ditandai' },
]

export const fraudAlerts: FraudAlertSummary[] = [
  { id: 'A-20431', judul: 'Velocity tinggi — akun baru', score: 88, menitLalu: 2 },
  { id: 'A-20428', judul: 'Refund QRIS mencurigakan', score: 81, menitLalu: 9 },
  { id: 'A-20420', judul: 'Pola merchant tak biasa', score: 64, menitLalu: 21 },
  { id: 'A-20415', judul: 'Mismatch settlement', score: 59, menitLalu: 33 },
]

// ── FDS Alert Detail ─────────────────────────────────────────────────────────
const alertDetails: Record<string, AlertDetail> = {
  'A-20431': {
    id: 'A-20431',
    judul: 'Velocity tinggi pada akun baru',
    channel: 'QRIS',
    jumlah: 1_200_000,
    waktuRingkas: '10:42:05',
    status: 'terbuka',
    prioritas: 'tinggi',
    score: 88,
    band: 'CRITICAL',
    rule: 'velocity_new_account',
    konteks: {
      jumlah: 1_200_000,
      channel: 'QRIS (MPM)',
      merchant: 'Toko Sinar Jaya',
      akunSumber: '•••• 8821 (umur 2 hari)',
      waktu: '27 Jun 10:42:05',
      txnRef: 'QR-9f3a-2210',
    },
    alasan: ['14 transaksi / 3 menit', 'akun < 72 jam', 'nominal naik 6×'],
  },
}

export function getAlertDetail(id: string): AlertDetail | undefined {
  return alertDetails[id] ?? alertDetails['A-20431']
}

// ── Reconciliation ───────────────────────────────────────────────────────────
export const reconKpis: Kpi[] = [
  {
    label: 'Cocok hari ini',
    value: '99,2%',
    sub: '3,07 jt dari 3,10 jt',
    subTone: 'muted',
    valueTone: 'success',
  },
  {
    label: 'Mismatch terbuka',
    value: '12',
    sub: 'perlu ditinjau',
    subTone: 'warning',
    valueTone: 'warning',
  },
  {
    label: 'Selisih nominal',
    value: 'Rp 1,4 jt',
    sub: 'akumulasi hari ini',
    subTone: 'muted',
    valueTone: 'danger',
  },
]

export const mismatches: Mismatch[] = [
  {
    id: 'm1',
    txnRef: 'TF-2231-0098',
    jumlah: 2_500_000,
    sisiPjp: 2_500_000,
    sisiCounterparty: 2_450_000,
    selisih: 50_000,
    window: '10:40',
    status: 'selisih nominal',
  },
  {
    id: 'm2',
    txnRef: 'QR-9920-1121',
    jumlah: 320_000,
    sisiPjp: 320_000,
    sisiCounterparty: null,
    selisih: null,
    window: '10:38',
    status: 'satu sisi',
  },
  {
    id: 'm3',
    txnRef: 'VA-5510-7732',
    jumlah: 1_040_000,
    sisiPjp: 1_040_000,
    sisiCounterparty: 1_040_000,
    selisih: 0,
    window: '10:35',
    status: 'cocok',
  },
]

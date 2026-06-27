/**
 * Backend API client. Talks to the Spring Boot backend (default http://localhost:8081).
 * Maps the backend CanonicalEvent shape into the frontend Transaction shape.
 */
import type { Transaction, TxnStatus, Channel } from '../data/types'

const API_BASE = (import.meta.env.VITE_API_BASE as string) || 'http://localhost:8081'

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

import { Badge, type BadgeTone } from './ui/Badge'
import type { MismatchStatus, TxnStatus } from '../data/types'

/** Transaction status -> color + icon + text badge (a11y §10). */
const txnMap: Record<TxnStatus, { tone: BadgeTone; label: string }> = {
  sukses: { tone: 'success', label: 'sukses' },
  pending: { tone: 'warning', label: 'pending' },
  ditandai: { tone: 'danger', label: 'ditandai FDS' },
}

export function TxnStatusBadge({ status }: { status: TxnStatus }) {
  const { tone, label } = txnMap[status]
  return <Badge tone={tone}>{label}</Badge>
}

/** Reconciliation mismatch status -> badge. */
const reconMap: Record<MismatchStatus, { tone: BadgeTone; label: string }> = {
  'selisih nominal': { tone: 'danger', label: 'selisih nominal' },
  'satu sisi': { tone: 'warning', label: 'satu sisi' },
  cocok: { tone: 'success', label: 'cocok' },
}

export function ReconStatusBadge({ status }: { status: MismatchStatus }) {
  const { tone, label } = reconMap[status]
  return <Badge tone={tone}>{label}</Badge>
}

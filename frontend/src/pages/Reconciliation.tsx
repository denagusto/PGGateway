import { ShieldCheck, CheckCircle2 } from 'lucide-react'
import { useQuery, useMutation, useQueryClient, type UseQueryResult } from '@tanstack/react-query'
import { PageHeader } from '../components/PageHeader'
import { Card, CardHeader } from '../components/ui/Card'
import { StatCard } from '../components/ui/StatCard'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { Skeleton } from '../components/ui/Skeleton'
import { EmptyState, ErrorState } from '../components/StateViews'
import { Table, TBody, THead, TH, TR, TD } from '../components/ui/Table'
import { formatRupiah, formatInt } from '../lib/format'
import { fetchMismatches, fetchReconSummary, resolveMismatch } from '../lib/api'
import type { ReconMismatch, ReconSummary } from '../data/types'

function rupiahOrDash(minor: number | null): string {
  return minor == null ? '— tidak ada —' : formatRupiah(minor / 100)
}

export default function Reconciliation() {
  const qc = useQueryClient()
  const summary = useQuery<ReconSummary, Error>({ queryKey: ['recon-summary'], queryFn: fetchReconSummary })
  const mismatches = useQuery<ReconMismatch[], Error>({ queryKey: ['recon-mismatches'], queryFn: fetchMismatches })
  const resolve = useMutation({
    mutationFn: (ref: string) => resolveMismatch(ref),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['recon-mismatches'] })
      qc.invalidateQueries({ queryKey: ['recon-summary'] })
    },
  })

  return (
    <>
      <PageHeader title="Rekonsiliasi" subtitle="Pencocokan 2-arah: ledger PGGateway vs counterparty" />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {summary.isPending || summary.isError ? (
          Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} className="p-4"><Skeleton className="h-3 w-24" /><Skeleton className="mt-2 h-7 w-20" /></Card>
          ))
        ) : (
          <>
            <StatCard label="Cocok" value={formatInt(summary.data.matched)} sub="transaksi termatch" subTone="success" valueTone="success" />
            <StatCard label="Mismatch terbuka" value={formatInt(summary.data.mismatchOpen)} sub="perlu ditinjau" subTone="warning" valueTone="warning" />
            <StatCard label="Selisih nominal" value={formatRupiah(summary.data.diffMinorTotal / 100)} sub="akumulasi" subTone="danger" valueTone="danger" />
          </>
        )}
      </div>

      <Card className="mt-6">
        <CardHeader title="Mismatch" />
        <MismatchTable query={mismatches} onResolve={(ref) => resolve.mutate(ref)} resolving={resolve.isPending} />
      </Card>
    </>
  )
}

function MismatchTable({
  query,
  onResolve,
  resolving,
}: {
  query: UseQueryResult<ReconMismatch[], Error>
  onResolve: (ref: string) => void
  resolving: boolean
}) {
  if (query.isPending) {
    return (
      <div className="space-y-2 p-4">
        {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-9 w-full" />)}
      </div>
    )
  }
  if (query.isError) return <ErrorState onRetry={() => query.refetch()} />
  if (query.data.length === 0) {
    return (
      <EmptyState icon={ShieldCheck} title="Semua transaksi cocok" description="Tidak ada mismatch terbuka. Ledger dan counterparty selaras." />
    )
  }
  return (
    <Table>
      <THead>
        <TR>
          <TH>txnRef</TH><TH>Jenis</TH>
          <TH align="right">Sisi PJP</TH><TH align="right">Sisi counterparty</TH><TH align="right">Selisih</TH>
          <TH></TH>
        </TR>
      </THead>
      <TBody>
        {query.data.map((m) => (
          <TR key={m.id} className={m.type === 'selisih_nominal' ? 'bg-warning-bg' : ''}>
            <TD numeric>{m.txnRef}</TD>
            <TD>
              {m.type === 'selisih_nominal'
                ? <Badge tone="danger">selisih nominal</Badge>
                : <Badge tone="warning">satu sisi</Badge>}
            </TD>
            <TD numeric align="right" className={m.amountPjpMinor == null ? 'text-muted' : ''}>{rupiahOrDash(m.amountPjpMinor)}</TD>
            <TD numeric align="right" className={m.amountCounterpartyMinor == null ? 'text-muted' : ''}>{rupiahOrDash(m.amountCounterpartyMinor)}</TD>
            <TD numeric align="right" className="text-danger">{m.diffMinor == null ? '—' : formatRupiah(Math.abs(m.diffMinor) / 100)}</TD>
            <TD>
              <Button variant="secondary" className="h-8 gap-1 px-2 text-small" disabled={resolving} onClick={() => onResolve(m.txnRef)}>
                <CheckCircle2 aria-hidden="true" className="h-3.5 w-3.5" /> Selesaikan
              </Button>
            </TD>
          </TR>
        ))}
      </TBody>
    </Table>
  )
}

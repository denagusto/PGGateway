import { useState } from 'react'
import { CheckCircle2 } from 'lucide-react'
import { PageHeader } from '../components/PageHeader'
import { StateToggle } from '../components/StateToggle'
import { StatCard } from '../components/ui/StatCard'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Skeleton } from '../components/ui/Skeleton'
import { EmptyState, ErrorState } from '../components/StateViews'
import { ReconStatusBadge } from '../components/StatusBadge'
import { Table, TBody, THead, TH, TR, TD } from '../components/ui/Table'
import { useScreenState } from '../lib/useScreenState'
import { useMockQuery } from '../lib/useMockQuery'
import { formatRupiah } from '../lib/format'
import { mismatches, reconKpis } from '../data/mock'
import type { Kpi, Mismatch } from '../data/types'

interface ReconData {
  kpis: Kpi[]
  rows: Mismatch[]
}

export default function Reconciliation() {
  const { state, setState } = useScreenState()
  const [resolvedIds, setResolvedIds] = useState<Set<string>>(new Set())

  const query = useMockQuery<ReconData>(
    ['recon'],
    { kpis: reconKpis, rows: mismatches },
    { kpis: reconKpis, rows: [] },
    state,
  )

  const resolve = (id: string) =>
    setResolvedIds((prev) => new Set(prev).add(id))

  return (
    <>
      <PageHeader
        title="Rekonsiliasi"
        subtitle="Pencocokan 2 arah ledger PJP vs counterparty"
        right={<StateToggle state={state} onChange={setState} />}
      />

      {/* Summary stats — 3 cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {query.isPending
          ? Array.from({ length: 3 }).map((_, i) => (
              <Card key={i} className="p-4">
                <Skeleton className="h-3 w-28" />
                <Skeleton className="mt-2 h-7 w-24" />
                <Skeleton className="mt-2 h-3 w-20" />
              </Card>
            ))
          : (query.data?.kpis ?? reconKpis).map((kpi) => (
              <StatCard
                key={kpi.label}
                label={kpi.label}
                value={kpi.value}
                sub={kpi.sub}
                subTone={kpi.subTone}
                valueTone={kpi.valueTone}
              />
            ))}
      </div>

      {/* Mismatch table */}
      <Card className="mt-6">
        <FilterBar />
        <ReconTable query={query} resolvedIds={resolvedIds} onResolve={resolve} />
      </Card>
    </>
  )
}

function FilterBar() {
  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-line p-3">
      <input
        type="text"
        placeholder="Cari txnRef…"
        className="h-8 rounded-sm border border-line bg-surface px-2 text-small text-ink placeholder:text-muted"
        aria-label="Cari txnRef"
      />
      <SelectChip label="Channel: semua" />
      <SelectChip label="Window: hari ini" />
      <SelectChip label="Status: mismatch" />
    </div>
  )
}

function SelectChip({ label }: { label: string }) {
  return (
    <span className="inline-flex h-8 items-center gap-1 rounded-sm border border-line bg-surface px-2 text-small text-muted">
      {label} <span aria-hidden="true">▾</span>
    </span>
  )
}

function ReconTable({
  query,
  resolvedIds,
  onResolve,
}: {
  query: ReturnType<typeof useMockQuery<ReconData>>
  resolvedIds: Set<string>
  onResolve: (id: string) => void
}) {
  if (query.isPending) {
    return (
      <div className="space-y-2 p-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-9 w-full" />
        ))}
      </div>
    )
  }
  if (query.isError) {
    return <ErrorState onRetry={() => query.refetch()} />
  }
  const rows = query.data?.rows ?? []
  if (rows.length === 0) {
    return (
      <EmptyState
        icon={CheckCircle2}
        title="Tidak ada mismatch"
        description="Semua transaksi cocok untuk window ini. Tidak ada yang perlu diselesaikan."
      />
    )
  }
  return (
    <Table>
      <THead>
        <TR>
          <TH>txnRef</TH>
          <TH align="right">Jumlah</TH>
          <TH align="right">Sisi PJP</TH>
          <TH align="right">Sisi counterparty</TH>
          <TH align="right">Selisih</TH>
          <TH>Window</TH>
          <TH>Status</TH>
          <TH>Aksi</TH>
        </TR>
      </THead>
      <TBody>
        {rows.map((r) => {
          const isAmountMismatch = r.status === 'selisih nominal'
          const isResolved = resolvedIds.has(r.id)
          return (
            <TR key={r.id} highlight={isAmountMismatch ? 'warning' : undefined}>
              <TD numeric className="font-semibold">{r.txnRef}</TD>
              <TD numeric align="right">{formatRupiah(r.jumlah)}</TD>
              <TD numeric align="right">{formatRupiah(r.sisiPjp)}</TD>
              <TD numeric align="right">
                {r.sisiCounterparty === null ? (
                  <span className="text-muted">— tidak ada —</span>
                ) : (
                  formatRupiah(r.sisiCounterparty)
                )}
              </TD>
              <TD numeric align="right">
                {r.selisih === null ? (
                  <span className="font-semibold text-warning">satu sisi</span>
                ) : r.selisih === 0 ? (
                  <span className="text-success">cocok</span>
                ) : (
                  <span className="font-semibold text-danger">
                    {formatRupiah(r.selisih)}
                  </span>
                )}
              </TD>
              <TD numeric className="text-muted">{r.window}</TD>
              <TD>
                <ReconStatusBadge status={r.status} />
              </TD>
              <TD>
                {r.status === 'cocok' ? (
                  <span className="text-small text-muted">—</span>
                ) : isResolved ? (
                  <span className="text-small font-semibold text-success">Selesai</span>
                ) : (
                  <Button
                    variant="secondary"
                    className="h-8 px-2"
                    onClick={() => onResolve(r.id)}
                  >
                    Selesaikan
                  </Button>
                )}
              </TD>
            </TR>
          )
        })}
      </TBody>
    </Table>
  )
}

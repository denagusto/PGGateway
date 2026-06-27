import { useNavigate } from 'react-router-dom'
import { Activity, ShieldCheck, Plus } from 'lucide-react'
import { useQuery, useMutation, useQueryClient, type UseQueryResult } from '@tanstack/react-query'
import { PageHeader } from '../components/PageHeader'
import { StateToggle } from '../components/StateToggle'
import { StatCard } from '../components/ui/StatCard'
import { Card, CardHeader } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Skeleton } from '../components/ui/Skeleton'
import { EmptyState, ErrorState } from '../components/StateViews'
import { TxnStatusBadge } from '../components/StatusBadge'
import { Table, TBody, THead, TH, TR, TD } from '../components/ui/Table'
import { useScreenState } from '../lib/useScreenState'
import { useMockQuery } from '../lib/useMockQuery'
import { formatRupiah } from '../lib/format'
import { scoreMeta } from '../lib/score'
import { fetchTransactions, postRandomMirror } from '../lib/api'
import { dashboardKpis, fraudAlerts } from '../data/mock'
import type { FraudAlertSummary, Kpi, Transaction } from '../data/types'

interface DashboardMeta {
  kpis: Kpi[]
  alerts: FraudAlertSummary[]
}

export default function Dashboard() {
  const { state, setState } = useScreenState()
  const navigate = useNavigate()
  const qc = useQueryClient()

  // KPIs + alerts are still mock (backend doesn't produce them yet); honor the demo toggle.
  const metaQuery = useMockQuery<DashboardMeta>(
    ['dashboard-meta'],
    { kpis: dashboardKpis, alerts: fraudAlerts },
    { kpis: dashboardKpis, alerts: [] },
    state,
  )

  // Transaction feed is REAL — GET /api/transactions. ?state= still forces loading/error/empty.
  const txnQuery = useQuery<Transaction[], Error>({
    queryKey: ['transactions', state],
    queryFn: async () => {
      if (state === 'loading') {
        await new Promise((r) => setTimeout(r, 100000))
        return []
      }
      if (state === 'error') throw new Error('Simulated API 5xx')
      if (state === 'empty') return []
      return fetchTransactions(25)
    },
    staleTime: 0,
    gcTime: 0,
  })

  const sendTest = useMutation({
    mutationFn: postRandomMirror,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['transactions'] }),
  })

  return (
    <>
      <PageHeader
        title="Dashboard"
        subtitle="Pantauan langsung — PT Dompet Cepat (PJP)"
        right={<StateToggle state={state} onChange={setState} />}
      />

      {/* KPI row — 5 cards, wraps responsively (DESIGN.md §6) */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {metaQuery.isPending
          ? Array.from({ length: 5 }).map((_, i) => (
              <Card key={i} className="p-4">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="mt-2 h-7 w-20" />
                <Skeleton className="mt-2 h-3 w-16" />
              </Card>
            ))
          : (metaQuery.data?.kpis ?? dashboardKpis).map((kpi) => (
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

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Live transaction feed — real data from the backend */}
        <Card className="lg:col-span-2">
          <CardHeader
            title="Aliran transaksi langsung"
            action={
              <Button
                variant="secondary"
                className="h-7 gap-1 px-2 text-small"
                onClick={() => sendTest.mutate()}
                disabled={sendTest.isPending}
              >
                <Plus aria-hidden="true" className="h-3.5 w-3.5" />
                {sendTest.isPending ? 'Mengirim…' : 'Kirim transaksi uji'}
              </Button>
            }
          />
          <TxnFeed query={txnQuery} />
        </Card>

        {/* Recent fraud alerts (mock) */}
        <Card>
          <CardHeader title="Alert fraud terbaru" />
          <AlertList query={metaQuery} onOpen={(id) => navigate(`/fds/${id}`)} />
        </Card>
      </div>
    </>
  )
}

function TxnFeed({ query }: { query: UseQueryResult<Transaction[], Error> }) {
  if (query.isPending) {
    return (
      <div className="space-y-2 p-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-full" />
        ))}
      </div>
    )
  }
  if (query.isError) {
    return <ErrorState onRetry={() => query.refetch()} />
  }
  const txns = query.data ?? []
  if (txns.length === 0) {
    return (
      <EmptyState
        icon={Activity}
        title="Belum ada transaksi"
        description="Transaksi masuk akan muncul di sini secara real-time. Coba 'Kirim transaksi uji'."
      />
    )
  }
  return (
    <div aria-live="polite">
      <Table>
        <THead>
          <TR>
            <TH>Waktu</TH>
            <TH>Channel</TH>
            <TH align="right">Jumlah</TH>
            <TH>Status</TH>
          </TR>
        </THead>
        <TBody>
          {txns.map((t) => (
            <TR key={t.id} className="animate-slide-fade-in">
              <TD numeric className="text-muted">{t.waktu}</TD>
              <TD>{t.channel}</TD>
              <TD numeric align="right">{formatRupiah(t.jumlah)}</TD>
              <TD>
                <TxnStatusBadge status={t.status} />
              </TD>
            </TR>
          ))}
        </TBody>
      </Table>
    </div>
  )
}

function AlertList({
  query,
  onOpen,
}: {
  query: UseQueryResult<DashboardMeta, Error>
  onOpen: (id: string) => void
}) {
  if (query.isPending) {
    return (
      <div className="space-y-3 p-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-9 w-full" />
        ))}
      </div>
    )
  }
  if (query.isError) {
    return <ErrorState onRetry={() => query.refetch()} />
  }
  const alerts = query.data?.alerts ?? []
  if (alerts.length === 0) {
    return (
      <EmptyState
        icon={ShieldCheck}
        title="Tidak ada alert fraud terbuka"
        description="Sistem memantau. Anda akan diberi tahu saat ada yang perlu ditinjau."
      />
    )
  }
  return (
    <ul className="divide-y divide-line" aria-live="polite">
      {alerts.map((a) => {
        const meta = scoreMeta(a.score)
        return (
          <li key={a.id}>
            <button
              type="button"
              onClick={() => onOpen(a.id)}
              className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-bg"
            >
              <span
                aria-hidden="true"
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: meta.color }}
              />
              <span className="flex-1 text-body text-ink">{a.judul}</span>
              <span className="shrink-0 text-small text-muted tnum">
                skor{' '}
                <span className="font-semibold" style={{ color: meta.color }}>
                  {a.score}
                </span>{' '}
                · {a.menitLalu} mnt
              </span>
            </button>
          </li>
        )
      })}
    </ul>
  )
}

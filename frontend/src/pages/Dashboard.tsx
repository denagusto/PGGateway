import { useNavigate } from 'react-router-dom'
import { Activity, ShieldCheck, Plus, LayoutDashboard, Banknote, ShieldAlert, Wallet, SlidersHorizontal, type LucideIcon } from 'lucide-react'

function kpiIcon(label: string): LucideIcon {
  const l = label.toLowerCase()
  if (l.includes('volume')) return Banknote
  if (l.includes('alert')) return ShieldAlert
  if (l.includes('akun')) return Wallet
  if (l.includes('rule')) return SlidersHorizontal
  return Activity
}
import { useQuery, useMutation, useQueryClient, type UseQueryResult } from '@tanstack/react-query'
import { PageHeader } from '../components/PageHeader'
import { StatCard } from '../components/ui/StatCard'
import { Card, CardHeader } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Skeleton } from '../components/ui/Skeleton'
import { EmptyState, ErrorState } from '../components/StateViews'
import { TxnStatusBadge } from '../components/StatusBadge'
import { Table, TBody, THead, TH, TR, TD } from '../components/ui/Table'
import { useScreenState } from '../lib/useScreenState'
import { formatRupiah, formatInt, formatRupiahCompact } from '../lib/format'
import { scoreMeta } from '../lib/score'
import { fetchTransactions, postRandomMirror, fetchAlertSummaries, fetchStats } from '../lib/api'
import { useTenant } from '../lib/tenant'
import { dashboardKpis } from '../data/mock'
import type { FraudAlertSummary, Kpi, Stats, Transaction } from '../data/types'

function statsToKpis(s: Stats): Kpi[] {
  return [
    { label: 'Transaksi', value: formatInt(s.txnCount), sub: 'ditangkap', subTone: 'muted', valueTone: 'ink' },
    { label: 'Volume', value: formatRupiahCompact(s.totalVolumeMinor / 100), sub: 'akumulasi', subTone: 'muted', valueTone: 'ink' },
    {
      label: 'Alert fraud terbuka', value: String(s.openAlerts),
      sub: s.openAlerts > 0 ? 'perlu ditinjau' : 'aman',
      subTone: s.openAlerts > 0 ? 'danger' : 'success',
      valueTone: s.openAlerts > 0 ? 'danger' : 'ink',
    },
    { label: 'Akun aktif', value: formatInt(s.activeAccounts), sub: 'unik', subTone: 'muted', valueTone: 'ink' },
    { label: 'Rule FDS aktif', value: formatInt(s.rulesActive), sub: 'aturan', subTone: 'muted', valueTone: 'ink' },
  ]
}

export default function Dashboard() {
  const { state } = useScreenState()
  const { tenant } = useTenant()
  const navigate = useNavigate()
  const qc = useQueryClient()

  // Real KPIs from /api/stats; honor the demo toggle for loading/error.
  const kpiQuery = useQuery<Kpi[], Error>({
    queryKey: ['stats', state, tenant],
    queryFn: async () => {
      if (state === 'loading') { await new Promise((r) => setTimeout(r, 100000)); return [] }
      if (state === 'error') throw new Error('Simulated API 5xx')
      return statsToKpis(await fetchStats(tenant))
    },
    staleTime: 0,
    gcTime: 0,
  })

  // Transactions + fraud alerts are REAL (backend). ?state= still forces loading/error/empty.
  const txnQuery = useQuery<Transaction[], Error>({
    queryKey: ['transactions', state, tenant],
    queryFn: () => withState(state, () => fetchTransactions(25, tenant)),
    staleTime: 0,
    gcTime: 0,
  })
  const alertsQuery = useQuery<FraudAlertSummary[], Error>({
    queryKey: ['alerts', state, tenant],
    queryFn: () => withState(state, () => fetchAlertSummaries(20, tenant)),
    staleTime: 0,
    gcTime: 0,
  })

  const sendTest = useMutation({
    mutationFn: postRandomMirror,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['transactions'] })
      qc.invalidateQueries({ queryKey: ['alerts'] })
      qc.invalidateQueries({ queryKey: ['stats'] })
    },
  })

  return (
    <>
      <PageHeader
        icon={LayoutDashboard}
        title="Dashboard"
        subtitle="Pantauan langsung transaksi, risiko, dan rekonsiliasi"
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {kpiQuery.isPending
          ? Array.from({ length: 5 }).map((_, i) => (
              <Card key={i} className="p-4">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="mt-2 h-7 w-20" />
                <Skeleton className="mt-2 h-3 w-16" />
              </Card>
            ))
          : (kpiQuery.data ?? dashboardKpis).map((kpi) => (
              <StatCard
                key={kpi.label}
                label={kpi.label}
                value={kpi.value}
                sub={kpi.sub}
                subTone={kpi.subTone}
                valueTone={kpi.valueTone}
                trend={kpi.trend}
                icon={kpiIcon(kpi.label)}
              />
            ))}
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="flex flex-col lg:col-span-2 lg:h-[620px]">
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
          <div className="min-h-0 flex-1 overflow-y-auto">
            <TxnFeed query={txnQuery} />
          </div>
        </Card>

        <Card className="flex flex-col lg:h-[620px]">
          <CardHeader title="Alert fraud terbaru" />
          <div className="min-h-0 flex-1 overflow-y-auto">
            <AlertList query={alertsQuery} onOpen={(id) => navigate(`/fds/${id}`)} />
          </div>
        </Card>
      </div>
    </>
  )
}

/** Demo-state wrapper: forces loading/error/empty for the ?state= toggle, else runs the real fetch. */
async function withState<T>(
  state: string,
  real: () => Promise<T[]>,
): Promise<T[]> {
  if (state === 'loading') {
    await new Promise((r) => setTimeout(r, 100000))
    return []
  }
  if (state === 'error') throw new Error('Simulated API 5xx')
  if (state === 'empty') return []
  return real()
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
  if (query.isError) return <ErrorState onRetry={() => query.refetch()} />
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
  query: UseQueryResult<FraudAlertSummary[], Error>
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
  if (query.isError) return <ErrorState onRetry={() => query.refetch()} />
  const alerts = query.data ?? []
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
              <span className="flex-1">
                <span className="block text-body text-ink">{a.judul}</span>
                {a.report ? (
                  <span className="text-micro uppercase tracking-wide text-muted">
                    {a.report}
                  </span>
                ) : null}
              </span>
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

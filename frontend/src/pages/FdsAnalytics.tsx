import { BarChart3, ShieldAlert } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { PageHeader } from '../components/PageHeader'
import { Card, CardBody, CardHeader } from '../components/ui/Card'
import { StatCard } from '../components/ui/StatCard'
import { Donut, BarList } from '../components/ui/Charts'
import { Skeleton } from '../components/ui/Skeleton'
import { ErrorState } from '../components/StateViews'
import { useTenant } from '../lib/tenant'
import { fetchAlertList } from '../lib/api'
import type { AlertRow } from '../data/types'

const BAND = [
  { key: 'CRITICAL', label: 'Kritis', color: '#dc2626' },
  { key: 'HIGH', label: 'Tinggi', color: '#d97706' },
  { key: 'MEDIUM', label: 'Sedang', color: '#ca8a04' },
  { key: 'LOW', label: 'Rendah', color: '#6b7185' },
]

export default function FdsAnalytics() {
  const { tenant } = useTenant()
  const q = useQuery<AlertRow[], Error>({
    queryKey: ['fds-analytics', tenant],
    queryFn: () => fetchAlertList('ALL', 2000, tenant),
  })

  return (
    <>
      <PageHeader icon={BarChart3} title="FDS — Analitik"
        subtitle="Performa deteksi fraud: tipologi, band risiko, akun berisiko, false-positive" />
      {q.isError ? (
        <Card><ErrorState onRetry={() => q.refetch()} /></Card>
      ) : q.isPending ? (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">{Array.from({ length: 4 }).map((_, i) => <Card key={i} className="p-5"><Skeleton className="h-20 w-full" /></Card>)}</div>
      ) : (
        <Analytics alerts={q.data} />
      )}
    </>
  )
}

function Analytics({ alerts }: { alerts: AlertRow[] }) {
  const total = alerts.length
  const open = alerts.filter((a) => a.status === 'OPEN').length
  const fraud = alerts.filter((a) => a.status === 'CONFIRMED_FRAUD').length
  const fp = alerts.filter((a) => a.status === 'FALSE_POSITIVE').length
  const resolved = fraud + fp
  const fpRate = resolved ? Math.round((fp / resolved) * 100) : 0

  const bandSeg = BAND.map((b) => ({ label: b.label, color: b.color, value: alerts.filter((a) => (a.band || '').toUpperCase() === b.key).length })).filter((s) => s.value > 0)

  const byTag: Record<string, number> = {}
  alerts.forEach((a) => { (a.report || '—').split(',').map((t) => t.trim()).filter(Boolean).forEach((t) => { byTag[t] = (byTag[t] ?? 0) + 1 }) })
  const typologyBars = Object.entries(byTag).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value).slice(0, 8)

  const byAcc: Record<string, number> = {}
  alerts.forEach((a) => { byAcc[a.account] = (byAcc[a.account] ?? 0) + 1 })
  const topAccounts = Object.entries(byAcc).map(([label, value]) => ({ label, value, color: '#dc2626' })).sort((a, b) => b.value - a.value).slice(0, 8)

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total alert" value={String(total)} sub="sepanjang waktu" icon={ShieldAlert} />
        <StatCard label="Terbuka" value={String(open)} sub="perlu ditinjau" subTone={open ? 'warning' : 'muted'} valueTone={open ? 'warning' : 'ink'} icon={ShieldAlert} />
        <StatCard label="Dikonfirmasi fraud" value={String(fraud)} sub="true positive" subTone={fraud ? 'danger' : 'muted'} valueTone={fraud ? 'danger' : 'ink'} icon={ShieldAlert} />
        <StatCard label="False-positive rate" value={`${fpRate}%`} sub={`${fp} dari ${resolved} ditutup`} subTone={fpRate > 40 ? 'danger' : 'success'} valueTone={fpRate > 40 ? 'danger' : 'success'} icon={BarChart3} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader title="Distribusi band risiko" />
          <CardBody>{bandSeg.length ? <Donut segments={bandSeg} /> : <p className="py-6 text-center text-small text-muted">Belum ada alert.</p>}</CardBody>
        </Card>
        <Card>
          <CardHeader title="Tipologi (tag)" />
          <CardBody>{typologyBars.length ? <BarList items={typologyBars} /> : <p className="py-6 text-center text-small text-muted">Belum ada tag.</p>}</CardBody>
        </Card>
        <Card>
          <CardHeader title="Akun paling berisiko" />
          <CardBody>{topAccounts.length ? <BarList items={topAccounts} /> : <p className="py-6 text-center text-small text-muted">Belum ada data.</p>}</CardBody>
        </Card>
      </div>
    </div>
  )
}

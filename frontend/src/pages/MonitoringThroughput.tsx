import { Gauge, Activity, CheckCircle2, XCircle, RefreshCw } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { PageHeader } from '../components/PageHeader'
import { Card, CardBody, CardHeader } from '../components/ui/Card'
import { StatCard } from '../components/ui/StatCard'
import { BarList } from '../components/ui/Charts'
import { Skeleton } from '../components/ui/Skeleton'
import { ErrorState } from '../components/StateViews'
import { formatInt } from '../lib/format'
import { fetchOpsHealth, type OpsHealth } from '../lib/api'

const CH_COLOR: Record<string, string> = { QRIS: '#16357e', TRANSFER: '#2563eb', VIRTUAL_ACCOUNT: '#0891b2', DIRECT_DEBIT: '#7c3aed', OTHER: '#6b7185' }

export default function MonitoringThroughput() {
  const q = useQuery<OpsHealth, Error>({ queryKey: ['ops-health'], queryFn: fetchOpsHealth, refetchInterval: 5000 })

  return (
    <>
      <PageHeader icon={Gauge} title="Monitoring — Throughput"
        subtitle="Volume transaksi, distribusi channel, dan kesehatan ingest"
        right={<span className="inline-flex items-center gap-1.5 text-small text-muted"><RefreshCw className={`h-3.5 w-3.5 ${q.isFetching ? 'animate-spin' : ''}`} />auto 5s</span>} />

      {q.isError ? <Card><ErrorState onRetry={() => q.refetch()} /></Card> : q.isPending ? <Card className="p-6"><Skeleton className="h-40 w-full" /></Card> : (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard label="Event/jam" value={formatInt(q.data.metrics.eventsLastHour)} sub="60 menit terakhir" icon={Activity} />
            <StatCard label="Total event" value={formatInt(q.data.metrics.totalEvents)} sub="sepanjang waktu" />
            <StatCard label="Ingest sukses" value={formatInt(q.data.metrics.ingestAttempts - q.data.metrics.ingestErrors)} sub={`dari ${q.data.metrics.ingestAttempts} percobaan`} valueTone="success" icon={CheckCircle2} />
            <StatCard label="Ingest gagal" value={formatInt(q.data.metrics.ingestErrors)} sub="ditolak" subTone={q.data.metrics.ingestErrors ? 'danger' : 'muted'} valueTone={q.data.metrics.ingestErrors ? 'danger' : 'ink'} icon={XCircle} />
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader title="Distribusi channel" />
              <CardBody>
                {Object.keys(q.data.metrics.channelMix).length === 0 ? <p className="py-6 text-center text-small text-muted">Belum ada data.</p> : (
                  <BarList items={Object.entries(q.data.metrics.channelMix).map(([label, value]) => ({ label, value, color: CH_COLOR[label] ?? '#6b7185' })).sort((a, b) => b.value - a.value)} />
                )}
              </CardBody>
            </Card>
            <Card>
              <CardHeader title="Kesehatan ingest" />
              <CardBody>
                <div className="space-y-3">
                  <Bar label="Sukses" value={q.data.metrics.ingestAttempts - q.data.metrics.ingestErrors} total={q.data.metrics.ingestAttempts} tone="success" />
                  <Bar label="Gagal" value={q.data.metrics.ingestErrors} total={q.data.metrics.ingestAttempts} tone="danger" />
                </div>
                <p className="mt-4 text-small text-muted">Kegagalan ingest (signature/payload) bisa ditelusuri di <b className="text-ink">Developer → Integration Monitor</b>.</p>
              </CardBody>
            </Card>
          </div>
        </div>
      )}
    </>
  )
}

function Bar({ label, value, total, tone }: { label: string; value: number; total: number; tone: 'success' | 'danger' }) {
  const pct = total ? Math.round((value / total) * 100) : 0
  const c = tone === 'success' ? 'bg-success' : 'bg-danger'
  return (
    <div>
      <div className="mb-1 flex justify-between text-small"><span className="text-ink">{label}</span><span className="tnum text-muted">{value} ({pct}%)</span></div>
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-bg"><div className={`h-full ${c}`} style={{ width: `${pct}%` }} /></div>
    </div>
  )
}

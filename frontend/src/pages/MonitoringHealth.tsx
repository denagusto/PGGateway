import { HeartPulse, CheckCircle2, RefreshCw, Server, ShieldAlert, Radio, Users, Database } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { PageHeader } from '../components/PageHeader'
import { Card, CardBody, CardHeader } from '../components/ui/Card'
import { Skeleton } from '../components/ui/Skeleton'
import { ErrorState } from '../components/StateViews'
import { formatInt } from '../lib/format'
import { fetchOpsHealth, type OpsHealth } from '../lib/api'

function uptime(ms: number): string {
  const s = Math.floor(ms / 1000), d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60)
  return d ? `${d}h ${h}j ${m}m` : h ? `${h}j ${m}m` : `${m}m`
}

export default function MonitoringHealth() {
  const q = useQuery<OpsHealth, Error>({ queryKey: ['ops-health'], queryFn: fetchOpsHealth, refetchInterval: 5000 })

  return (
    <>
      <PageHeader icon={HeartPulse} title="Monitoring — Health"
        subtitle="Status komponen platform & metrik operasional, real-time"
        right={<span className="inline-flex items-center gap-1.5 text-small text-muted"><RefreshCw className={`h-3.5 w-3.5 ${q.isFetching ? 'animate-spin' : ''}`} />auto 5s</span>} />

      {q.isError ? <Card><ErrorState onRetry={() => q.refetch()} /></Card> : q.isPending ? <Card className="p-6"><Skeleton className="h-40 w-full" /></Card> : (
        <div className="space-y-6">
          {/* Status banner */}
          <Card className="border-success/40 bg-success/5">
            <CardBody>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="grid h-11 w-11 place-items-center rounded-full bg-success/15 text-success"><CheckCircle2 className="h-6 w-6" /></div>
                  <div>
                    <div className="text-h2 font-semibold text-ink">Semua sistem operasional</div>
                    <div className="text-small text-muted">Status keseluruhan: <b className="text-success">{q.data.status}</b></div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-micro uppercase tracking-wide text-muted">Uptime</div>
                  <div className="text-h2 font-bold text-ink">{uptime(q.data.uptimeMs)}</div>
                </div>
              </div>
            </CardBody>
          </Card>

          {/* Metric tiles */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Metric icon={Server} label="Total event" value={formatInt(q.data.metrics.totalEvents)} sub={`${q.data.metrics.eventsLastHour}/jam`} />
            <Metric icon={ShieldAlert} label="Alert terbuka" value={formatInt(q.data.metrics.openAlerts)} sub="FDS" tone={q.data.metrics.openAlerts ? 'warning' : 'ink'} />
            <Metric icon={Radio} label="Klien SSE" value={formatInt(q.data.metrics.sseClients)} sub="terhubung live" tone="success" />
            <Metric icon={Users} label="Tenant (PJP)" value={formatInt(q.data.metrics.tenants)} sub="aktif" />
          </div>

          {/* Components */}
          <Card>
            <CardHeader title="Komponen" action={<Database aria-hidden="true" className="h-4 w-4 text-muted" />} />
            <CardBody>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                {q.data.components.map((c) => (
                  <div key={c.name} className="flex items-start gap-3 rounded-lg border border-line p-3.5">
                    <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-success" />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-ink">{c.name}</span>
                        <span className="rounded bg-success/10 px-1.5 py-0.5 text-micro font-semibold text-success">{c.status}</span>
                      </div>
                      <div className="mt-0.5 text-small text-muted">{c.detail}</div>
                    </div>
                  </div>
                ))}
              </div>
            </CardBody>
          </Card>
        </div>
      )}
    </>
  )
}

function Metric({ icon: Icon, label, value, sub, tone = 'ink' }: { icon: typeof Server; label: string; value: string; sub: string; tone?: 'ink' | 'success' | 'warning' }) {
  const c = { ink: 'text-ink', success: 'text-success', warning: 'text-warning' }[tone]
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 text-micro font-semibold uppercase tracking-wide text-muted"><Icon className="h-3.5 w-3.5" />{label}</div>
      <div className={`mt-1 text-display font-bold ${c}`}>{value}</div>
      <div className="text-small text-muted">{sub}</div>
    </Card>
  )
}

import { useNavigate } from 'react-router-dom'
import { Construction } from 'lucide-react'
import { PageHeader } from '../components/PageHeader'
import { Card } from '../components/ui/Card'
import { EmptyState } from '../components/StateViews'
import { Button } from '../components/ui/Button'
import { fraudAlerts } from '../data/mock'
import { scoreMeta } from '../lib/score'

/**
 * Placeholder for routes not in the 3-screen scope (Transaksi, Audit).
 * Keeps nav from dead-ending; clearly marked as not-yet-built.
 */
export function Placeholder({ title }: { title: string }) {
  return (
    <>
      <PageHeader title={title} subtitle="Belum dibangun pada iterasi ini" />
      <Card>
        <EmptyState
          icon={Construction}
          title={`${title} segera hadir`}
          description="Layar ini ada di inventori (frontend-plan §4) tapi di luar lingkup 3 layar inti saat ini."
        />
      </Card>
    </>
  )
}

/**
 * FDS Alert Queue — minimal index so /fds is navigable and links into
 * the detail screen. Reuses the dashboard alert mock list.
 */
export function FdsQueue() {
  const navigate = useNavigate()
  return (
    <>
      <PageHeader title="FDS — Antrian Alert" subtitle="Alert fraud real-time" />
      <Card className="divide-y divide-line">
        {fraudAlerts.map((a) => {
          const meta = scoreMeta(a.score)
          return (
            <div key={a.id} className="flex items-center gap-3 px-4 py-3">
              <span
                aria-hidden="true"
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: meta.color }}
              />
              <div className="flex-1">
                <p className="text-body font-semibold text-ink">
                  #{a.id} — {a.judul}
                </p>
                <p className="text-small text-muted tnum">
                  skor{' '}
                  <span style={{ color: meta.color }} className="font-semibold">
                    {a.score}
                  </span>{' '}
                  · {a.menitLalu} menit lalu · {meta.label}
                </p>
              </div>
              <Button variant="secondary" onClick={() => navigate(`/fds/${a.id}`)}>
                Buka kasus
              </Button>
            </div>
          )
        })}
      </Card>
    </>
  )
}

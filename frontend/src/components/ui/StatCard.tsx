import type { ReactNode } from 'react'
import { TrendingUp, TrendingDown, type LucideIcon } from 'lucide-react'
import { cn } from '../../lib/cn'
import { Card } from './Card'

/** Premium KPI stat card: label + icon chip -> large value -> colored delta. */
export type StatTone = 'ink' | 'success' | 'warning' | 'danger'

const valueTone: Record<StatTone, string> = {
  ink: 'text-ink',
  success: 'text-success',
  warning: 'text-warning',
  danger: 'text-danger',
}

export function StatCard({
  label,
  value,
  sub,
  subTone = 'muted',
  valueTone: vTone = 'ink',
  trend,
  icon: Icon,
}: {
  label: string
  value: ReactNode
  sub?: ReactNode
  subTone?: 'muted' | 'success' | 'warning' | 'danger'
  valueTone?: StatTone
  trend?: 'up' | 'down'
  icon?: LucideIcon
}) {
  const subClass =
    subTone === 'muted' ? 'text-muted'
      : subTone === 'success' ? 'text-success'
        : subTone === 'warning' ? 'text-warning'
          : 'text-danger'

  return (
    <Card className="p-5 transition-shadow hover:shadow-card-hover">
      <div className="flex items-start justify-between gap-3">
        <div className="text-micro font-semibold uppercase tracking-[0.06em] text-muted">{label}</div>
        {Icon ? (
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary/8 text-primary ring-1 ring-inset ring-primary/10">
            <Icon aria-hidden="true" className="h-[18px] w-[18px]" />
          </div>
        ) : null}
      </div>
      <div className={cn('mt-2.5 text-[28px] font-bold leading-none tracking-tight tnum', valueTone[vTone])}>
        {value}
      </div>
      {sub ? (
        <div className={cn('mt-2 flex items-center gap-1 text-small tnum', subClass)}>
          {trend === 'up' ? <TrendingUp aria-hidden="true" className="h-3.5 w-3.5" />
            : trend === 'down' ? <TrendingDown aria-hidden="true" className="h-3.5 w-3.5" /> : null}
          <span>{sub}</span>
        </div>
      ) : null}
    </Card>
  )
}

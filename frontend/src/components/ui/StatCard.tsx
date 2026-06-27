import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'
import { Card } from './Card'

/**
 * KPI stat card. DESIGN.md §7:
 * micro label (uppercase, muted) -> display value -> small delta (colored).
 * Money/number stays ink; only the sub-line/delta may be colored.
 */
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
}: {
  label: string
  value: ReactNode
  sub?: ReactNode
  subTone?: 'muted' | 'success' | 'warning' | 'danger'
  valueTone?: StatTone
}) {
  const subClass =
    subTone === 'muted'
      ? 'text-muted'
      : subTone === 'success'
        ? 'text-success'
        : subTone === 'warning'
          ? 'text-warning'
          : 'text-danger'

  return (
    <Card className="p-4">
      <div className="text-micro uppercase tracking-[0.04em] text-muted">
        {label}
      </div>
      <div className={cn('mt-1 text-display font-bold tnum', valueTone[vTone])}>
        {value}
      </div>
      {sub ? <div className={cn('mt-1 text-small tnum', subClass)}>{sub}</div> : null}
    </Card>
  )
}

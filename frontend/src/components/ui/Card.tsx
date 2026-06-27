import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from '../../lib/cn'

/**
 * Card — shadcn-style surface. DESIGN.md §5/§7:
 * 1px line border does the separation, radius lg (10px), padding 14-16px.
 * No card-on-card nesting (Do/Don't).
 */
export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'rounded-lg border border-line bg-surface',
        className,
      )}
      {...props}
    />
  )
}

export function CardHeader({
  title,
  action,
  className,
}: {
  title: ReactNode
  action?: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex items-center justify-between border-b border-line px-4 py-3',
        className,
      )}
    >
      <h2 className="text-h2 font-semibold text-ink">{title}</h2>
      {action ? <div className="text-small text-muted">{action}</div> : null}
    </div>
  )
}

export function CardBody({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('p-4', className)} {...props} />
}

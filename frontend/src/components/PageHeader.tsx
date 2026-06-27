import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'

export function PageHeader({
  title,
  subtitle,
  icon: Icon,
  right,
}: {
  title: string
  subtitle?: ReactNode
  icon?: LucideIcon
  right?: ReactNode
}) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div className="flex items-center gap-3.5">
        {Icon ? (
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-primary/12 to-primary/5 text-primary ring-1 ring-inset ring-primary/15">
            <Icon aria-hidden="true" className="h-[22px] w-[22px]" strokeWidth={2} />
          </div>
        ) : null}
        <div>
          <h1 className="text-display font-bold tracking-tight text-ink">{title}</h1>
          {subtitle ? <p className="mt-0.5 text-body text-muted">{subtitle}</p> : null}
        </div>
      </div>
      {right ? <div className="flex items-center gap-2">{right}</div> : null}
    </div>
  )
}

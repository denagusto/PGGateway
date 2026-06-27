import type { ReactNode } from 'react'

export function PageHeader({
  title,
  subtitle,
  right,
}: {
  title: string
  subtitle?: ReactNode
  right?: ReactNode
}) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-display font-bold tracking-tight text-ink">{title}</h1>
        {subtitle ? <p className="mt-1 text-body text-muted">{subtitle}</p> : null}
      </div>
      {right ? <div className="flex items-center gap-2">{right}</div> : null}
    </div>
  )
}

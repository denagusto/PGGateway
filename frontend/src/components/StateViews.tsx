import type { ReactNode } from 'react'
import { AlertTriangle, RotateCw, type LucideIcon } from 'lucide-react'
import { Button } from './ui/Button'

/**
 * Shared empty/error presentations. DESIGN.md §8:
 * - Empty: warm, with context + a primary action.
 * - Error: inline, recoverable, with a manual "Coba lagi".
 */

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon
  title: string
  description?: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-12 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-bg text-muted">
        <Icon aria-hidden="true" className="h-6 w-6" />
      </span>
      <div>
        <p className="text-h2 font-semibold text-ink">{title}</p>
        {description ? <p className="mt-1 text-body text-muted">{description}</p> : null}
      </div>
      {action ? <div className="mt-1">{action}</div> : null}
    </div>
  )
}

export function ErrorState({
  title = 'Gagal memuat data',
  description = 'Terjadi kesalahan saat mengambil data dari server.',
  onRetry,
}: {
  title?: string
  description?: string
  onRetry?: () => void
}) {
  return (
    <div
      className="flex flex-col items-center justify-center gap-3 px-6 py-12 text-center"
      role="alert"
    >
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-danger-bg text-danger">
        <AlertTriangle aria-hidden="true" className="h-6 w-6" />
      </span>
      <div>
        <p className="text-h2 font-semibold text-ink">{title}</p>
        <p className="mt-1 text-body text-muted">{description}</p>
      </div>
      {onRetry ? (
        <Button variant="secondary" onClick={onRetry} className="mt-1">
          <RotateCw aria-hidden="true" className="mr-1 h-4 w-4" />
          Coba lagi
        </Button>
      ) : null}
    </div>
  )
}

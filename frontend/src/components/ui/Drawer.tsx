import { useEffect, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { cn } from '../../lib/cn'

/**
 * Right-hand slide-over panel for record detail (transactions, breaks, alerts, audit). Closes on
 * backdrop click or Esc. Width is comfortable for a detail/trace view without covering the whole app.
 */
export function Drawer({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  width = 'max-w-xl',
}: {
  open: boolean
  onClose: () => void
  title: ReactNode
  subtitle?: ReactNode
  children: ReactNode
  footer?: ReactNode
  width?: string
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null
  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-ink/30 backdrop-blur-[1px]" onClick={onClose} aria-hidden="true" />
      <aside
        role="dialog"
        aria-modal="true"
        className={cn('absolute right-0 top-0 flex h-full w-full flex-col bg-surface shadow-2xl', width)}
      >
        <header className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
          <div className="min-w-0">
            <div className="truncate text-h2 font-semibold text-ink">{title}</div>
            {subtitle ? <div className="mt-0.5 truncate text-small text-muted">{subtitle}</div> : null}
          </div>
          <button type="button" onClick={onClose} aria-label="Tutup"
            className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-muted hover:bg-bg hover:text-ink">
            <X className="h-4 w-4" />
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer ? <footer className="border-t border-line px-5 py-3">{footer}</footer> : null}
      </aside>
    </div>
  )
}

/** Labelled key/value row for drawer detail bodies. */
export function Field({ label, children, mono }: { label: string; children: ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-line/60 py-2 last:border-0">
      <span className="shrink-0 text-small text-muted">{label}</span>
      <span className={cn('text-right text-small font-medium text-ink', mono && 'font-mono')}>{children}</span>
    </div>
  )
}

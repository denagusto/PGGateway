import type { ReactNode } from 'react'
import {
  CheckCircle2,
  Clock,
  ShieldAlert,
  Info,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '../../lib/cn'

/**
 * Badge / pill. Two roles:
 *   - STATUS (success/warning/danger/info): color + icon + text — never color alone (a11y §10).
 *   - LABEL/CATEGORY (neutral): a clean pill with NO icon (e.g. LTKT, scopes, env) — modern
 *     fintech tags don't carry status glyphs.
 * Pass `icon={null}` to force a status tone without its icon.
 */
export type BadgeTone = 'success' | 'warning' | 'danger' | 'neutral' | 'info'

const toneStyles: Record<BadgeTone, string> = {
  success: 'bg-success-bg text-success',
  warning: 'bg-warning-bg text-warning',
  danger: 'bg-danger-bg text-danger',
  info: 'bg-[#dbeafe] text-accent',
  neutral: 'bg-[#eef1f4] text-ink/70 ring-1 ring-inset ring-[#dfe3e8]',
}

const defaultIcon: Partial<Record<BadgeTone, LucideIcon>> = {
  success: CheckCircle2,
  warning: Clock,
  danger: ShieldAlert,
  info: Info,
}

export function Badge({
  tone = 'neutral',
  icon: IconOverride,
  children,
  className,
}: {
  tone?: BadgeTone
  icon?: LucideIcon | null
  children: ReactNode
  className?: string
}) {
  const Icon = IconOverride === null ? null : (IconOverride ?? defaultIcon[tone] ?? null)
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-small font-semibold whitespace-nowrap',
        toneStyles[tone],
        className,
      )}
    >
      {Icon ? <Icon aria-hidden="true" className="h-3.5 w-3.5 shrink-0" /> : null}
      <span>{children}</span>
    </span>
  )
}

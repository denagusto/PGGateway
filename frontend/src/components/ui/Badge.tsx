import type { ReactNode } from 'react'
import {
  CheckCircle2,
  Clock,
  ShieldAlert,
  XCircle,
  AlertTriangle,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '../../lib/cn'

/**
 * Badge (status pill). DESIGN.md §2/§7/§10:
 * Status is NEVER color alone — always color + icon + text.
 */
export type BadgeTone = 'success' | 'warning' | 'danger' | 'neutral' | 'info'

const toneStyles: Record<BadgeTone, string> = {
  success: 'bg-success-bg text-success',
  warning: 'bg-warning-bg text-warning',
  danger: 'bg-danger-bg text-danger',
  info: 'bg-[#dbeafe] text-accent',
  neutral: 'bg-[#f1f3f5] text-muted',
}

const defaultIcon: Record<BadgeTone, LucideIcon> = {
  success: CheckCircle2,
  warning: Clock,
  danger: ShieldAlert,
  info: AlertTriangle,
  neutral: XCircle,
}

export function Badge({
  tone = 'neutral',
  icon: IconOverride,
  children,
  className,
}: {
  tone?: BadgeTone
  icon?: LucideIcon
  children: ReactNode
  className?: string
}) {
  const Icon = IconOverride ?? defaultIcon[tone]
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-sm px-2 py-0.5 text-small font-semibold whitespace-nowrap',
        toneStyles[tone],
        className,
      )}
    >
      <Icon aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
      <span>{children}</span>
    </span>
  )
}

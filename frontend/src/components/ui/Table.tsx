import type { HTMLAttributes, TdHTMLAttributes, ThHTMLAttributes } from 'react'
import { cn } from '../../lib/cn'

/**
 * Table primitives. DESIGN.md §7:
 * uppercase micro headers, 1px row dividers, right-align numbers (tabular),
 * row hover, optional highlighted row (--warning-bg/--danger-bg).
 */

export function Table({ className, ...props }: HTMLAttributes<HTMLTableElement>) {
  return (
    <div className="w-full overflow-x-auto">
      <table className={cn('w-full border-collapse text-small', className)} {...props} />
    </div>
  )
}

export function THead({ className, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return <thead className={cn('', className)} {...props} />
}

export function TBody({ className, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody className={cn('', className)} {...props} />
}

type RowHighlight = 'warning' | 'danger'

export function TR({
  className,
  highlight,
  interactive,
  ...props
}: HTMLAttributes<HTMLTableRowElement> & {
  highlight?: RowHighlight
  interactive?: boolean
}) {
  return (
    <tr
      className={cn(
        'border-b border-line last:border-b-0',
        highlight === 'warning' && 'bg-warning-bg/60',
        highlight === 'danger' && 'bg-danger-bg/60',
        interactive && 'cursor-pointer hover:bg-bg',
        !highlight && !interactive && 'hover:bg-bg',
        className,
      )}
      {...props}
    />
  )
}

export function TH({
  className,
  align = 'left',
  ...props
}: ThHTMLAttributes<HTMLTableCellElement> & { align?: 'left' | 'right' }) {
  return (
    <th
      scope="col"
      className={cn(
        'px-2 py-2 text-micro font-semibold uppercase tracking-[0.04em] text-muted',
        align === 'right' ? 'text-right' : 'text-left',
        className,
      )}
      {...props}
    />
  )
}

export function TD({
  className,
  align = 'left',
  numeric,
  ...props
}: TdHTMLAttributes<HTMLTableCellElement> & {
  align?: 'left' | 'right'
  numeric?: boolean
}) {
  return (
    <td
      className={cn(
        'px-2 py-2 text-small text-ink',
        align === 'right' ? 'text-right' : 'text-left',
        numeric && 'tnum',
        className,
      )}
      {...props}
    />
  )
}

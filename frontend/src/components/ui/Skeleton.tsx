import { cn } from '../../lib/cn'

/**
 * Skeleton — DESIGN.md §8: loading uses skeleton rows/cards, never a bare spinner.
 */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn('animate-pulse rounded-sm bg-line/70', className)}
      aria-hidden="true"
    />
  )
}

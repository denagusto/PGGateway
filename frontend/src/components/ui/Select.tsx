import type { SelectHTMLAttributes, ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '../../lib/cn'

/**
 * Consistent select control — no native browser chrome. Styled to match Input, with a single
 * lucide ChevronDown (never the OS double-arrow), used everywhere a dropdown appears.
 */
export function Select({
  className,
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { children: ReactNode }) {
  return (
    <div className="relative">
      <select
        className={cn(
          'w-full appearance-none rounded-md border border-line bg-surface py-2 pl-3 pr-9 text-body text-ink',
          'transition-colors hover:border-[#cbd2da] focus:border-accent',
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown
        aria-hidden="true"
        className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
      />
    </div>
  )
}

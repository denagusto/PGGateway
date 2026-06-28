import { type ReactNode } from 'react'
import { Search } from 'lucide-react'

export interface FilterSelect {
  label: string
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
}

/**
 * Reusable filter row: a search box + any number of select filters + an optional right slot
 * (e.g. an Export button). Used across Transaksi, Audit, FdsQueue, Rekonsiliasi for consistency.
 */
export function FilterBar({
  search,
  onSearch,
  searchPlaceholder = 'Cari…',
  filters = [],
  right,
}: {
  search?: string
  onSearch?: (v: string) => void
  searchPlaceholder?: string
  filters?: FilterSelect[]
  right?: ReactNode
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {onSearch ? (
        <div className="relative min-w-[200px] flex-1">
          <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input
            value={search ?? ''}
            onChange={(e) => onSearch(e.target.value)}
            placeholder={searchPlaceholder}
            className="h-9 w-full rounded-md border border-line bg-surface pl-9 pr-3 text-body text-ink focus:border-primary focus:outline-none"
          />
        </div>
      ) : null}
      {filters.map((f) => (
        <label key={f.label} className="flex items-center gap-1.5">
          <span className="text-micro font-semibold uppercase tracking-wide text-muted">{f.label}</span>
          <select
            value={f.value}
            onChange={(e) => f.onChange(e.target.value)}
            className="h-9 rounded-md border border-line bg-surface px-2.5 text-body text-ink focus:border-primary focus:outline-none"
          >
            {f.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </label>
      ))}
      {right ? <div className="ml-auto flex items-center gap-2">{right}</div> : null}
    </div>
  )
}

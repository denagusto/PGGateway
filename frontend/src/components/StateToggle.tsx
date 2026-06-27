import { cn } from '../lib/cn'
import type { ScreenState } from '../lib/useScreenState'

/**
 * Demo-only control to flip a screen between ready/empty/loading/error.
 * Maps to the ?state= query param (DESIGN.md §8 states are demoable).
 */
const OPTIONS: { value: ScreenState; label: string }[] = [
  { value: 'ready', label: 'Normal' },
  { value: 'loading', label: 'Loading' },
  { value: 'empty', label: 'Kosong' },
  { value: 'error', label: 'Error' },
]

export function StateToggle({
  state,
  onChange,
}: {
  state: ScreenState
  onChange: (s: ScreenState) => void
}) {
  return (
    <div
      className="inline-flex items-center gap-1 rounded-md border border-line bg-surface p-0.5"
      role="group"
      aria-label="Pratinjau status layar"
    >
      <span className="px-1.5 text-micro uppercase tracking-[0.04em] text-muted">
        Demo state
      </span>
      {OPTIONS.map((opt) => (
        <button
          key={opt.value}
          type="button"
          aria-pressed={state === opt.value}
          onClick={() => onChange(opt.value)}
          className={cn(
            'rounded-sm px-2 py-1 text-small font-semibold transition-colors',
            state === opt.value
              ? 'bg-primary text-white'
              : 'text-muted hover:bg-bg',
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

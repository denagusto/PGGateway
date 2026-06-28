/** Lightweight inline-SVG charts — no dependency, premium look. */

export interface Segment { label: string; value: number; color: string }

export function Donut({ segments, size = 132, thickness = 16 }: { segments: Segment[]; size?: number; thickness?: number }) {
  const total = segments.reduce((s, x) => s + x.value, 0)
  const r = (size - thickness) / 2
  const c = 2 * Math.PI * r
  let acc = 0
  return (
    <div className="flex items-center gap-6">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#eef1f4" strokeWidth={thickness} />
          {total > 0 && segments.map((s, i) => {
            const len = (s.value / total) * c
            const el = (
              <circle key={i} cx={size / 2} cy={size / 2} r={r} fill="none" stroke={s.color}
                strokeWidth={thickness} strokeDasharray={`${len} ${c - len}`} strokeDashoffset={-acc} />
            )
            acc += len
            return el
          })}
        </svg>
        <div className="absolute inset-0 grid place-items-center">
          <div className="text-center">
            <div className="text-h1 font-bold tnum text-ink">{total}</div>
            <div className="text-micro uppercase tracking-wide text-muted">total</div>
          </div>
        </div>
      </div>
      <ul className="min-w-0 flex-1 space-y-2">
        {segments.map((s) => (
          <li key={s.label} className="flex items-center gap-2 text-small">
            <span aria-hidden="true" className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: s.color }} />
            <span className="truncate text-ink">{s.label}</span>
            <span className="ml-auto font-semibold tnum text-muted">{s.value}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

export interface BarItem { label: string; value: number; display?: string; color?: string }

export function BarList({ items }: { items: BarItem[] }) {
  const max = Math.max(1, ...items.map((i) => i.value))
  return (
    <div className="space-y-3">
      {items.map((i) => (
        <div key={i.label}>
          <div className="mb-1 flex items-center justify-between text-small">
            <span className="text-ink">{i.label}</span>
            <span className="font-semibold tnum text-muted">{i.display ?? i.value}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-bg">
            <div className="h-full rounded-full" style={{ width: `${(i.value / max) * 100}%`, backgroundColor: i.color ?? '#16357e' }} />
          </div>
        </div>
      ))}
    </div>
  )
}

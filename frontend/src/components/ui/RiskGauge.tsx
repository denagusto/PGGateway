import { scoreMeta } from '../../lib/score'

/**
 * Risk-score gauge. DESIGN.md §7:
 * circular, fill color by threshold (§3), big tabular number + micro label.
 */
export function RiskGauge({ score, size = 120 }: { score: number; size?: number }) {
  const meta = scoreMeta(score)
  const stroke = 12
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const pct = Math.max(0, Math.min(100, score)) / 100
  const dash = circumference * pct

  return (
    <div
      className="relative inline-flex items-center justify-center"
      style={{ width: size, height: size }}
      role="img"
      aria-label={`Skor risiko ${score} dari 100 — ${meta.label}`}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#e5e7eb"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={meta.color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circumference}`}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-display font-bold tnum" style={{ color: meta.color }}>
          {score}
        </span>
        <span className="text-micro uppercase tracking-[0.04em] text-muted">
          Skor risiko
        </span>
      </div>
    </div>
  )
}

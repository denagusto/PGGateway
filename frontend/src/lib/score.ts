/**
 * Fraud-score thresholds — LOCKED per DESIGN.md §3.
 * Use the SAME thresholds everywhere a score appears (gauge, list, badge).
 *   >= 80  danger   Tinggi — prioritaskan
 *   60-79  warning  Sedang — tinjau
 *   < 60   muted    Rendah
 */
export type ScoreLevel = 'tinggi' | 'sedang' | 'rendah'

export interface ScoreMeta {
  level: ScoreLevel
  label: string
  /** hex color for SVG fill / inline color */
  color: string
  /** Tailwind text color class */
  textClass: string
}

export function scoreMeta(score: number): ScoreMeta {
  if (score >= 80) {
    return { level: 'tinggi', label: 'Tinggi — prioritaskan', color: '#dc2626', textClass: 'text-danger' }
  }
  if (score >= 60) {
    return { level: 'sedang', label: 'Sedang — tinjau', color: '#d97706', textClass: 'text-warning' }
  }
  return { level: 'rendah', label: 'Rendah', color: '#6b7185', textClass: 'text-muted' }
}

/**
 * Maps the backend risk band (LOW/MEDIUM/HIGH/CRITICAL) to a short Indonesian label + color.
 * The band is authoritative (computed by the scoring engine); colors stay consistent with score.
 */
export function bandMeta(band: string): { label: string; color: string } {
  switch ((band || '').toUpperCase()) {
    case 'CRITICAL':
      return { label: 'KRITIS', color: '#dc2626' }
    case 'HIGH':
      return { label: 'TINGGI', color: '#d97706' }
    case 'MEDIUM':
      return { label: 'SEDANG', color: '#ca8a04' }
    default:
      return { label: 'RENDAH', color: '#6b7185' }
  }
}

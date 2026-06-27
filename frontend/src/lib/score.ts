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
    return { level: 'tinggi', label: 'Tinggi — prioritaskan', color: '#b91c1c', textClass: 'text-danger' }
  }
  if (score >= 60) {
    return { level: 'sedang', label: 'Sedang — tinjau', color: '#b45309', textClass: 'text-warning' }
  }
  return { level: 'rendah', label: 'Rendah', color: '#6b7280', textClass: 'text-muted' }
}

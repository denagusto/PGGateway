/**
 * Formatting helpers — Indonesian locale (id-ID).
 * DESIGN.md §4/§7: consistent `Rp` money, tabular figures.
 */

const idNumber = new Intl.NumberFormat('id-ID')

/** Full rupiah, e.g. 1200000 -> "Rp 1.200.000" */
export function formatRupiah(amount: number): string {
  return `Rp ${idNumber.format(Math.round(amount))}`
}

/** Plain grouped integer, e.g. 1284 -> "1.284" */
export function formatInt(value: number): string {
  return idNumber.format(value)
}

/**
 * Compact rupiah for KPI sub-lines, e.g. 482_000_000 -> "Rp 482 M".
 * jt = juta (million), M = miliar (billion). Kept simple for mock display.
 */
export function formatRupiahCompact(amount: number): string {
  if (amount >= 1_000_000_000) {
    return `Rp ${idNumber.format(round1(amount / 1_000_000_000))} M`
  }
  if (amount >= 1_000_000) {
    return `Rp ${idNumber.format(round1(amount / 1_000_000))} jt`
  }
  return formatRupiah(amount)
}

function round1(n: number): number {
  return Math.round(n * 10) / 10
}

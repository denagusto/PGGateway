/**
 * Minimal, dependency-free CSV export. Builds a CSV from rows + column definitions and triggers a
 * browser download. Values are quoted/escaped so commas, quotes and newlines are safe. Used by the
 * data-heavy tables (Transaksi, Audit, Rekonsiliasi, neraca) for analyst/finance offline work.
 */
export interface CsvColumn<T> {
  key: keyof T | string
  label: string
  value?: (row: T) => string | number
}

function cell(v: string | number | null | undefined): string {
  const s = v == null ? '' : String(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function exportCsv<T>(filename: string, rows: T[], columns: CsvColumn<T>[]): void {
  const header = columns.map((c) => cell(c.label)).join(',')
  const body = rows.map((r) =>
    columns.map((c) => cell(c.value ? c.value(r) : (r as Record<string, unknown>)[c.key as string] as string | number)).join(','),
  )
  const csv = [header, ...body].join('\n')
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename.endsWith('.csv') ? filename : `${filename}.csv`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

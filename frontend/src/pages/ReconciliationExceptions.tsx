import { useMemo, useState } from 'react'
import { AlertTriangle, Download, CheckCircle2, Ban } from 'lucide-react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { PageHeader } from '../components/PageHeader'
import { Card, CardBody } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Badge } from '../components/ui/Badge'
import { Skeleton } from '../components/ui/Skeleton'
import { EmptyState, ErrorState } from '../components/StateViews'
import { FilterBar } from '../components/ui/FilterBar'
import { Drawer, Field } from '../components/ui/Drawer'
import { useToast } from '../components/ui/Toast'
import { exportCsv } from '../lib/csv'
import { formatRupiah } from '../lib/format'
import { fetchReconBreaks, updateReconBreak, type ReconBreak } from '../lib/api'

const CATEGORY: Record<string, { label: string; tone: 'danger' | 'warning' | 'neutral' }> = {
  UNSETTLED: { label: 'Belum settle', tone: 'warning' },
  UNEXPECTED: { label: 'Kredit tak terduga', tone: 'danger' },
  AMOUNT_MISMATCH: { label: 'Selisih nominal', tone: 'danger' },
  DUPLICATE: { label: 'Duplikat', tone: 'warning' },
  LATE_SETTLEMENT: { label: 'Settle terlambat', tone: 'warning' },
  STATUS_MISMATCH: { label: 'Selisih status', tone: 'neutral' },
}
const STATUS: Record<string, { label: string; tone: 'warning' | 'neutral' | 'success' | 'danger' }> = {
  OPEN: { label: 'Terbuka', tone: 'warning' },
  INVESTIGATING: { label: 'Investigasi', tone: 'neutral' },
  RESOLVED: { label: 'Selesai', tone: 'success' },
  WRITTEN_OFF: { label: 'Write-off', tone: 'danger' },
}
const rupiahN = (m: number | null) => (m == null ? '—' : formatRupiah(m / 100))
const ageLabel = (h: number) => (h <= 24 ? `${h}j` : `${Math.floor(h / 24)}h ${h % 24}j`)

export default function ReconciliationExceptions() {
  const qc = useQueryClient()
  const toast = useToast()
  const [status, setStatus] = useState('all')
  const [category, setCategory] = useState('all')
  const [source, setSource] = useState('all')
  const [search, setSearch] = useState('')
  const [sel, setSel] = useState<ReconBreak | null>(null)

  const q = useQuery<ReconBreak[], Error>({
    queryKey: ['recon-breaks', status, category, source, search],
    queryFn: () => fetchReconBreaks({ status, category, source, search }),
  })
  const breaks = q.data ?? []
  const sources = useMemo(() => Array.from(new Set(breaks.map((b) => b.source))), [breaks])

  async function save(id: string, body: { status?: string; assignee?: string; note?: string }) {
    try {
      const updated = await updateReconBreak(id, body)
      setSel(updated)
      await qc.invalidateQueries({ queryKey: ['recon-breaks'] })
      await qc.invalidateQueries({ queryKey: ['recon-ws-summary'] })
      toast({ tone: 'success', title: 'Break diperbarui' })
    } catch (e) { toast({ tone: 'error', title: 'Gagal', description: (e as Error).message }) }
  }

  function doExport() {
    exportCsv('recon-exceptions', breaks, [
      { key: 'txnRef', label: 'Ref' }, { key: 'source', label: 'Sumber' },
      { key: 'category', label: 'Kategori', value: (b) => CATEGORY[b.category]?.label ?? b.category },
      { key: 'amountLedgerMinor', label: 'Ledger', value: (b) => (b.amountLedgerMinor ?? '') },
      { key: 'amountSourceMinor', label: 'Sumber', value: (b) => (b.amountSourceMinor ?? '') },
      { key: 'diffMinor', label: 'Selisih', value: (b) => (b.diffMinor ?? '') },
      { key: 'status', label: 'Status', value: (b) => STATUS[b.status]?.label ?? b.status },
      { key: 'ageHours', label: 'Umur (jam)' }, { key: 'assignee', label: 'Penanggung jawab' },
    ])
    toast({ tone: 'success', title: `Export ${breaks.length} baris` })
  }

  return (
    <>
      <PageHeader icon={AlertTriangle} title="Rekonsiliasi — Exceptions"
        subtitle="Kelola break: kategori, assign, investigasi, selesaikan / write-off"
        right={<Button variant="ghost" onClick={doExport} disabled={!breaks.length}><Download className="mr-1.5 h-4 w-4" />Export CSV</Button>} />

      <Card className="mb-4">
        <CardBody>
          <FilterBar search={search} onSearch={setSearch} searchPlaceholder="Cari ref / sumber…"
            filters={[
              { label: 'Status', value: status, onChange: setStatus, options: [{ value: 'all', label: 'Semua' }, ...Object.entries(STATUS).map(([v, s]) => ({ value: v, label: s.label }))] },
              { label: 'Kategori', value: category, onChange: setCategory, options: [{ value: 'all', label: 'Semua' }, ...Object.entries(CATEGORY).map(([v, c]) => ({ value: v, label: c.label }))] },
              { label: 'Sumber', value: source, onChange: setSource, options: [{ value: 'all', label: 'Semua' }, ...sources.map((s) => ({ value: s, label: s }))] },
            ]} />
        </CardBody>
      </Card>

      <Card>
        <CardBody>
          {q.isError ? <ErrorState onRetry={() => q.refetch()} /> : q.isPending ? <Skeleton className="h-40 w-full" /> : breaks.length === 0 ? (
            <EmptyState icon={CheckCircle2} title="Tidak ada break" description="Semua cocok untuk filter ini." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-small">
                <thead>
                  <tr className="border-b border-line text-left text-micro uppercase tracking-wide text-muted">
                    <th className="py-2 pr-4 font-semibold">Ref</th><th className="py-2 pr-4 font-semibold">Sumber</th>
                    <th className="py-2 pr-4 font-semibold">Kategori</th><th className="py-2 pr-4 font-semibold text-right">Ledger</th>
                    <th className="py-2 pr-4 font-semibold text-right">Sumber</th><th className="py-2 pr-4 font-semibold text-right">Selisih</th>
                    <th className="py-2 pr-4 font-semibold">Umur</th><th className="py-2 pr-4 font-semibold">Status</th><th className="py-2 pr-4 font-semibold">PIC</th>
                  </tr>
                </thead>
                <tbody>
                  {breaks.map((b) => (
                    <tr key={b.id} className="cursor-pointer border-b border-line/60 hover:bg-bg" onClick={() => setSel(b)}>
                      <td className="py-2.5 pr-4 font-mono text-micro text-ink">{b.txnRef}</td>
                      <td className="py-2.5 pr-4 text-muted">{b.source}</td>
                      <td className="py-2.5 pr-4"><Badge tone={CATEGORY[b.category]?.tone ?? 'neutral'}>{CATEGORY[b.category]?.label ?? b.category}</Badge></td>
                      <td className="py-2.5 pr-4 text-right tnum">{rupiahN(b.amountLedgerMinor)}</td>
                      <td className="py-2.5 pr-4 text-right tnum">{rupiahN(b.amountSourceMinor)}</td>
                      <td className="py-2.5 pr-4 text-right tnum text-danger">{b.diffMinor == null ? '—' : formatRupiah(Math.abs(b.diffMinor) / 100)}</td>
                      <td className="py-2.5 pr-4"><span className={b.ageHours > 168 ? 'text-danger' : b.ageHours > 72 ? 'text-warning' : 'text-muted'}>{ageLabel(b.ageHours)}</span></td>
                      <td className="py-2.5 pr-4"><Badge tone={STATUS[b.status]?.tone ?? 'neutral'}>{STATUS[b.status]?.label ?? b.status}</Badge></td>
                      <td className="py-2.5 pr-4 text-muted">{b.assignee || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>

      <Drawer open={!!sel} onClose={() => setSel(null)} title={sel?.txnRef ?? ''} subtitle={sel ? `${sel.source} · ${CATEGORY[sel.category]?.label}` : ''}
        footer={sel ? (
          <div className="flex gap-2">
            <Button variant="secondary" className="flex-1" onClick={() => save(sel.id, { status: 'RESOLVED' })}><CheckCircle2 className="mr-1.5 h-4 w-4" />Selesaikan</Button>
            <Button variant="ghost" className="flex-1" onClick={() => save(sel.id, { status: 'WRITTEN_OFF' })}><Ban className="mr-1.5 h-4 w-4" />Write-off</Button>
          </div>
        ) : undefined}>
        {sel ? <BreakDetail b={sel} onSave={save} /> : null}
      </Drawer>
    </>
  )
}

function BreakDetail({ b, onSave }: { b: ReconBreak; onSave: (id: string, body: { status?: string; assignee?: string; note?: string }) => void }) {
  const [assignee, setAssignee] = useState(b.assignee)
  const [statusV, setStatusV] = useState(b.status)
  const [note, setNote] = useState(b.note)
  return (
    <div className="space-y-5">
      <section>
        <h3 className="mb-1 text-micro font-semibold uppercase tracking-wide text-muted">Detail break</h3>
        <Field label="Kategori">{CATEGORY[b.category]?.label ?? b.category}</Field>
        <Field label="Sisi ledger" mono>{rupiahN(b.amountLedgerMinor)}</Field>
        <Field label="Sisi sumber" mono>{rupiahN(b.amountSourceMinor)}</Field>
        <Field label="Selisih" mono>{b.diffMinor == null ? '—' : formatRupiah(b.diffMinor / 100)}</Field>
        <Field label="Umur">{ageLabel(b.ageHours)}</Field>
        <Field label="Run">{b.runId}</Field>
      </section>
      <section className="space-y-3">
        <h3 className="text-micro font-semibold uppercase tracking-wide text-muted">Workflow</h3>
        <label className="flex flex-col gap-1"><span className="text-micro font-semibold uppercase tracking-wide text-muted">Penanggung jawab</span>
          <input value={assignee} onChange={(e) => setAssignee(e.target.value)} placeholder="mis. analis.finance" className="h-9 rounded-md border border-line bg-surface px-3 text-small text-ink focus:border-primary focus:outline-none" /></label>
        <label className="flex flex-col gap-1"><span className="text-micro font-semibold uppercase tracking-wide text-muted">Status</span>
          <select value={statusV} onChange={(e) => setStatusV(e.target.value)} className="h-9 rounded-md border border-line bg-surface px-2.5 text-body text-ink focus:border-primary focus:outline-none">
            {Object.entries(STATUS).map(([v, s]) => <option key={v} value={v}>{s.label}</option>)}
          </select></label>
        <label className="flex flex-col gap-1"><span className="text-micro font-semibold uppercase tracking-wide text-muted">Catatan investigasi</span>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} className="rounded-md border border-line bg-surface px-3 py-2 text-small text-ink focus:border-primary focus:outline-none" /></label>
        <Button variant="primary" className="w-full" onClick={() => onSave(b.id, { status: statusV, assignee, note })}>Simpan perubahan</Button>
      </section>
    </div>
  )
}

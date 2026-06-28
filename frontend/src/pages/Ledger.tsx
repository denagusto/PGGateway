import { useMemo, useState } from 'react'
import { Wallet, Activity, ArrowLeftRight, Download, Play, Layers3, ArrowRight, UserSearch } from 'lucide-react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { PageHeader } from '../components/PageHeader'
import { Card, CardHeader } from '../components/ui/Card'
import { StatCard } from '../components/ui/StatCard'
import { Button } from '../components/ui/Button'
import { Skeleton } from '../components/ui/Skeleton'
import { EmptyState, ErrorState } from '../components/StateViews'
import { TxnStatusBadge } from '../components/StatusBadge'
import { Table, TBody, THead, TH, TR, TD } from '../components/ui/Table'
import { FilterBar } from '../components/ui/FilterBar'
import { Drawer, Field } from '../components/ui/Drawer'
import { useToast } from '../components/ui/Toast'
import { exportCsv } from '../lib/csv'
import { formatRupiah, formatInt } from '../lib/format'
import { fetchAccounts, fetchTransactions, postRandomMirror } from '../lib/api'
import { useTenant } from '../lib/tenant'
import type { AccountBalance, Transaction } from '../data/types'

const CHANNELS = ['QRIS', 'Transfer', 'Virtual Account']
const STATUSES: { v: string; l: string }[] = [
  { v: 'all', l: 'Semua status' }, { v: 'sukses', l: 'Sukses' }, { v: 'pending', l: 'Pending' }, { v: 'ditandai', l: 'Ditandai' },
]

export default function Ledger() {
  const { tenant } = useTenant()
  const qc = useQueryClient()
  const toast = useToast()
  const accounts = useQuery<AccountBalance[], Error>({ queryKey: ['accounts', tenant], queryFn: () => fetchAccounts(50, tenant) })
  const txns = useQuery<Transaction[], Error>({ queryKey: ['ledger-txns', tenant], queryFn: () => fetchTransactions(200, tenant) })

  const [search, setSearch] = useState('')
  const [channel, setChannel] = useState('all')
  const [status, setStatus] = useState('all')
  const [selected, setSelected] = useState<Transaction | null>(null)
  const [simBusy, setSimBusy] = useState(false)

  const all = txns.data ?? []
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return all.filter((t) =>
      (channel === 'all' || t.channel === channel) &&
      (status === 'all' || t.status === status) &&
      (!q || [t.txnRef, t.account, t.source, t.dest, t.id].some((f) => (f ?? '').toLowerCase().includes(q))),
    )
  }, [all, search, channel, status])

  const kpi = useMemo(() => {
    const total = all.length
    const volume = all.reduce((s, t) => s + t.jumlah, 0)
    const ok = all.filter((t) => t.status === 'sukses').length
    const byCh: Record<string, number> = {}
    all.forEach((t) => { byCh[t.channel] = (byCh[t.channel] ?? 0) + 1 })
    const topCh = Object.entries(byCh).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '—'
    return { total, volume, okRate: total ? Math.round((ok / total) * 100) : 0, topCh }
  }, [all])

  async function simulate() {
    setSimBusy(true)
    try {
      const r = await postRandomMirror()
      toast({ tone: r.alertRaised ? 'info' : 'success', title: r.scored ? `Transaksi diproses · skor ${r.score} (${r.band})` : r.outcome, description: r.alertRaised ? 'Memicu alert FDS' : 'Lolos FDS' })
      qc.invalidateQueries({ queryKey: ['ledger-txns'] }); qc.invalidateQueries({ queryKey: ['accounts'] })
    } catch (e) { toast({ tone: 'error', title: 'Gagal', description: (e as Error).message }) }
    finally { setSimBusy(false) }
  }

  function doExport() {
    exportCsv(`transaksi-${tenant}`, filtered, [
      { key: 'occurredAt', label: 'Waktu' }, { key: 'txnRef', label: 'Ref' }, { key: 'channel', label: 'Channel' },
      { key: 'account', label: 'Akun' }, { key: 'source', label: 'Pengirim' }, { key: 'dest', label: 'Penerima' },
      { key: 'jumlah', label: 'Nominal' }, { key: 'status', label: 'Status' },
    ])
    toast({ tone: 'success', title: `Export ${filtered.length} baris` })
  }

  return (
    <>
      <PageHeader icon={ArrowLeftRight} title="Transaksi / Ledger"
        subtitle="Aliran transaksi (Smart Router) + saldo akun double-entry"
        right={
          <>
            <Button variant="secondary" onClick={simulate} disabled={simBusy}><Play className="mr-1.5 h-4 w-4" />{simBusy ? 'Menjalankan…' : 'Simulasi transaksi'}</Button>
            <Button variant="ghost" onClick={doExport} disabled={!filtered.length}><Download className="mr-1.5 h-4 w-4" />Export CSV</Button>
          </>
        } />

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Total transaksi" value={formatInt(kpi.total)} sub="termuat" icon={Activity} />
        <StatCard label="Volume" value={formatRupiah(kpi.volume)} sub="nilai diproses" icon={Layers3} />
        <StatCard label="Success rate" value={`${kpi.okRate}%`} sub="status sukses" valueTone={kpi.okRate >= 90 ? 'success' : 'ink'} />
        <StatCard label="Channel teratas" value={kpi.topCh} sub="paling sering" />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="flex flex-col lg:col-span-2 lg:h-[660px]">
          <CardHeader title="Transaksi terbaru" action={<Activity aria-hidden="true" className="h-4 w-4 text-success" />} />
          <div className="border-b border-line px-4 pb-3">
            <FilterBar search={search} onSearch={setSearch} searchPlaceholder="Cari ref / akun / pengirim / penerima…"
              filters={[
                { label: 'Channel', value: channel, onChange: setChannel, options: [{ value: 'all', label: 'Semua' }, ...CHANNELS.map((c) => ({ value: c, label: c }))] },
                { label: 'Status', value: status, onChange: setStatus, options: STATUSES.map((s) => ({ value: s.v, label: s.l })) },
              ]} />
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {txns.isError ? <ErrorState onRetry={() => txns.refetch()} /> : txns.isPending ? <Loading rows={8} />
              : filtered.length === 0 ? <EmptyState icon={Activity} title="Tidak ada transaksi" description="Sesuaikan filter atau kirim transaksi simulasi." />
              : (
                <Table>
                  <THead><TR><TH>Waktu</TH><TH>Ref</TH><TH>Channel</TH><TH align="right">Jumlah</TH><TH>Status</TH></TR></THead>
                  <TBody>
                    {filtered.map((t) => (
                      <TR key={t.id} className="cursor-pointer hover:bg-bg" onClick={() => setSelected(t)}>
                        <TD numeric className="text-muted">{t.waktu}</TD>
                        <TD className="font-mono text-micro text-muted">{t.txnRef}</TD>
                        <TD>{t.channel}</TD>
                        <TD numeric align="right">{formatRupiah(t.jumlah)}</TD>
                        <TD><TxnStatusBadge status={t.status} /></TD>
                      </TR>
                    ))}
                  </TBody>
                </Table>
              )}
          </div>
        </Card>

        <Card className="flex flex-col lg:h-[660px]">
          <CardHeader title="Saldo Akun (Ledger)" action={<Wallet aria-hidden="true" className="h-4 w-4 text-muted" />} />
          <div className="min-h-0 flex-1 overflow-y-auto">
            {accounts.isError ? <ErrorState onRetry={() => accounts.refetch()} /> : accounts.isPending ? <Loading rows={6} />
              : accounts.data.length === 0 ? <EmptyState icon={Wallet} title="Belum ada saldo" description="Saldo muncul saat transaksi mengalir." />
              : (
                <Table>
                  <THead><TR><TH>Akun</TH><TH align="right">Saldo</TH><TH align="right">Txn</TH></TR></THead>
                  <TBody>
                    {accounts.data.map((a) => (
                      <TR key={a.account}>
                        <TD className="font-mono text-micro">{a.account}</TD>
                        <TD numeric align="right" className={a.balanceMinor < 0 ? 'text-danger' : 'text-ink'}>{formatRupiah(a.balanceMinor / 100)}</TD>
                        <TD numeric align="right" className="text-muted">{formatInt(a.txnCount)}</TD>
                      </TR>
                    ))}
                  </TBody>
                </Table>
              )}
          </div>
        </Card>
      </div>

      {/* Transaction trace drawer */}
      <Drawer open={!!selected} onClose={() => setSelected(null)} title={selected?.txnRef ?? ''} subtitle="Jejak transaksi end-to-end">
        {selected ? (
          <div className="space-y-5">
            <section>
              <h3 className="mb-1 text-micro font-semibold uppercase tracking-wide text-muted">Canonical event (ingest)</h3>
              <Field label="Event ID" mono>{selected.id}</Field>
              <Field label="Ref (partner)" mono>{selected.txnRef}</Field>
              <Field label="Waktu">{new Date(selected.occurredAt).toLocaleString('id-ID')}</Field>
              <Field label="Channel">{selected.channel}</Field>
              <Field label="Nominal">{formatRupiah(selected.jumlah)} {selected.currency}</Field>
              <Field label="Status upstream" mono>{selected.rawStatus}</Field>
            </section>
            <section>
              <h3 className="mb-1 text-micro font-semibold uppercase tracking-wide text-muted">Aliran (Smart Router)</h3>
              <div className="flex items-center justify-center gap-2 rounded-md bg-bg p-3 text-small">
                <span className="font-mono text-ink">{selected.source || '—'}</span>
                <ArrowRight className="h-4 w-4 text-muted" />
                <span className="font-mono text-ink">{selected.dest || '—'}</span>
              </div>
              <Field label="Akun (shard)" mono>{selected.account}</Field>
              <Field label="Status">{<TxnStatusBadge status={selected.status} />}</Field>
            </section>
            <section className="space-y-2">
              <Link to={`/fds/investigation?account=${encodeURIComponent(selected.account)}`}
                className="flex items-center justify-between rounded-md border border-line px-3 py-2.5 text-small font-medium text-ink hover:border-primary hover:bg-primary/5">
                <span className="flex items-center gap-2"><UserSearch className="h-4 w-4 text-primary" />Investigasi akun (Entity 360)</span>
                <ArrowRight className="h-4 w-4 text-muted" />
              </Link>
            </section>
          </div>
        ) : null}
      </Drawer>
    </>
  )
}

function Loading({ rows }: { rows: number }) {
  return <div className="space-y-2 p-4">{Array.from({ length: rows }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}</div>
}

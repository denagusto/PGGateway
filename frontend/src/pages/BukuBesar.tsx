import { BookOpen, ShieldCheck, Scale, Layers } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { PageHeader } from '../components/PageHeader'
import { Card, CardBody, CardHeader } from '../components/ui/Card'
import { Badge } from '../components/ui/Badge'
import { Skeleton } from '../components/ui/Skeleton'
import { EmptyState, ErrorState } from '../components/StateViews'
import { Table, TBody, THead, TH, TR, TD } from '../components/ui/Table'
import { formatRupiah } from '../lib/format'
import { useTenant } from '../lib/tenant'
import { fetchTrialBalance, fetchSafeguarding, fetchJournal } from '../lib/api'
import type { GlTrialBalance, GlSafeguarding, GlJournalEntry } from '../lib/api'

const rp = (minor: number) => formatRupiah(Math.round(minor / 100))

const TYPE_LABEL: Record<string, string> = {
  ASSET: 'Aset', LIABILITY: 'Kewajiban', EQUITY: 'Ekuitas', REVENUE: 'Pendapatan', EXPENSE: 'Beban',
}

export default function BukuBesar() {
  const { tenant } = useTenant()
  const sg = useQuery<GlSafeguarding, Error>({ queryKey: ['gl-safeguarding', tenant], queryFn: () => fetchSafeguarding(tenant) })
  const tb = useQuery<GlTrialBalance, Error>({ queryKey: ['gl-trial', tenant], queryFn: () => fetchTrialBalance(tenant) })
  const jr = useQuery<GlJournalEntry[], Error>({ queryKey: ['gl-journal', tenant], queryFn: () => fetchJournal(tenant, 30) })

  return (
    <>
      <PageHeader
        icon={BookOpen}
        title="Buku Besar"
        subtitle="Double-entry bertingkat: jurnal → buku besar → neraca saldo → fund safeguarding"
      />

      {/* Fund safeguarding hero */}
      {sg.isError ? (
        <Card className="mb-6"><ErrorState onRetry={() => sg.refetch()} /></Card>
      ) : sg.isPending ? (
        <Card className="mb-6"><CardBody><Skeleton className="h-24 w-full" /></CardBody></Card>
      ) : (
        <Safeguard data={sg.data} />
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        {/* Trial balance */}
        <Card className="lg:col-span-3">
          <CardHeader
            title="Neraca Saldo"
            action={
              tb.data ? (
                <Badge tone={tb.data.balanced ? 'success' : 'danger'}>
                  {tb.data.balanced ? 'Seimbang' : 'Tidak seimbang'}
                </Badge>
              ) : <Scale aria-hidden="true" className="h-4 w-4 text-muted" />
            }
          />
          {tb.isError ? (
            <ErrorState onRetry={() => tb.refetch()} />
          ) : tb.isPending ? (
            <div className="space-y-2 p-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}</div>
          ) : tb.data.lines.length === 0 ? (
            <EmptyState icon={Scale} title="Belum ada posting" description="Belum ada transaksi untuk tenant ini." />
          ) : (
            <Table>
              <THead>
                <TR><TH>Akun</TH><TH>Tipe</TH><TH align="right">Debit</TH><TH align="right">Kredit</TH></TR>
              </THead>
              <TBody>
                {tb.data.lines.map((l) => (
                  <TR key={l.code}>
                    <TD>
                      <span className="block text-ink">{l.name}</span>
                      <span className="font-mono text-micro text-muted">{l.code}</span>
                    </TD>
                    <TD><Badge tone="neutral">{TYPE_LABEL[l.type] ?? l.type}</Badge></TD>
                    <TD numeric align="right" className="text-ink">{l.debitMinor ? rp(l.debitMinor) : '—'}</TD>
                    <TD numeric align="right" className="text-ink">{l.creditMinor ? rp(l.creditMinor) : '—'}</TD>
                  </TR>
                ))}
                <TR className="border-t-2 border-line font-semibold">
                  <TD className="text-ink">Total</TD>
                  <TD />
                  <TD numeric align="right" className="text-ink">{rp(tb.data.totalDebitMinor)}</TD>
                  <TD numeric align="right" className="text-ink">{rp(tb.data.totalCreditMinor)}</TD>
                </TR>
              </TBody>
            </Table>
          )}
        </Card>

        {/* Journal */}
        <Card className="lg:col-span-2">
          <CardHeader title="Jurnal" action={<Layers aria-hidden="true" className="h-4 w-4 text-muted" />} />
          {jr.isError ? (
            <ErrorState onRetry={() => jr.refetch()} />
          ) : jr.isPending ? (
            <div className="space-y-2 p-4">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
          ) : jr.data.length === 0 ? (
            <EmptyState icon={Layers} title="Belum ada jurnal" description="Posting jurnal muncul saat transaksi masuk." />
          ) : (
            <ul className="divide-y divide-line">
              {jr.data.slice(0, 12).map((e) => (
                <li key={e.id} className="px-5 py-3">
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <span className="truncate text-small font-semibold text-ink">{e.description}</span>
                    <span className="font-mono text-micro text-muted">{e.txnRef}</span>
                  </div>
                  <div className="space-y-0.5">
                    {e.postings.map((p, i) => (
                      <div key={i} className="flex items-center justify-between gap-2 text-small">
                        <span className={p.debit ? 'text-ink' : 'pl-4 text-muted'}>
                          {p.debit ? '' : '↳ '}{p.accountName}
                        </span>
                        <span className={'tnum ' + (p.debit ? 'text-ink' : 'text-muted')}>
                          {p.debit ? rp(p.amountMinor) : `(${rp(p.amountMinor)})`}
                        </span>
                      </div>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  )
}

function Safeguard({ data }: { data: GlSafeguarding }) {
  const healthy = data.coveragePct >= 100
  return (
    <Card className="mb-6 overflow-hidden">
      <div className="grid grid-cols-1 gap-px bg-line sm:grid-cols-4">
        <div className="flex flex-col justify-center bg-gradient-to-br from-primary to-primary-700 p-5 text-white">
          <div className="flex items-center gap-2 text-small text-white/80">
            <ShieldCheck aria-hidden="true" className="h-4 w-4" /> Fund Safeguarding
          </div>
          <div className="mt-1 text-display font-bold tracking-tight">{data.coveragePct}%</div>
          <div className="text-small text-white/80">
            {healthy ? 'Dana nasabah terjamin penuh' : 'Coverage di bawah 100%'}
          </div>
        </div>
        <Metric label="Dana nasabah / merchant" value={rp(data.customerFundsMinor)} hint="Kewajiban (utang ke merchant)" />
        <Metric label="Aset penjamin" value={rp(data.backingAssetsMinor)} hint="Kas settlement + bank" />
        <Metric label="Surplus (pendapatan biaya)" value={rp(data.surplusMinor)} hint="Aset − kewajiban = fee" tone="success" />
      </div>
    </Card>
  )
}

function Metric({ label, value, hint, tone }: { label: string; value: string; hint: string; tone?: 'success' }) {
  return (
    <div className="bg-surface p-5">
      <div className="text-small text-muted">{label}</div>
      <div className={'mt-1 text-h1 font-bold tracking-tight ' + (tone === 'success' ? 'text-success' : 'text-ink')}>{value}</div>
      <div className="mt-0.5 text-micro text-muted">{hint}</div>
    </div>
  )
}

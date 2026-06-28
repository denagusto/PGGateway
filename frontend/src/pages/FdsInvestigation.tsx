import { useEffect, useState } from 'react'
import { Search, UserSearch, Ban, AlertTriangle, ShieldCheck, ArrowUpRight, ArrowDownLeft } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { Link, useSearchParams } from 'react-router-dom'
import { PageHeader } from '../components/PageHeader'
import { Card, CardBody, CardHeader } from '../components/ui/Card'
import { StatCard } from '../components/ui/StatCard'
import { Button } from '../components/ui/Button'
import { Badge } from '../components/ui/Badge'
import { Skeleton } from '../components/ui/Skeleton'
import { ErrorState } from '../components/StateViews'
import { fetchEntity, type Entity360 } from '../lib/api'

const rupiah = (minor: number) => 'Rp' + (minor / 100).toLocaleString('id-ID')
const ACTION_TONE = { BLOCK: 'danger', WARNING: 'warning', ALLOW: 'success' } as const
const ACTION_ICON = { BLOCK: Ban, WARNING: AlertTriangle, ALLOW: ShieldCheck }
const QUICK = ['ACC-mule-001', 'ACC-watch-77', 'ACC-payroll-gov', 'ACC-merchant']

function bandTone(band: string): 'danger' | 'warning' | 'neutral' {
  return band === 'CRITICAL' || band === 'HIGH' ? 'danger' : band === 'MEDIUM' ? 'warning' : 'neutral'
}
const STATUS_LABEL: Record<string, string> = { OPEN: 'Terbuka', CONFIRMED_FRAUD: 'Fraud', FALSE_POSITIVE: 'False-pos' }

export default function FdsInvestigation() {
  const [params] = useSearchParams()
  const [input, setInput] = useState('')
  const [account, setAccount] = useState<string | null>(null)
  const q = useQuery<Entity360, Error>({ queryKey: ['entity', account], queryFn: () => fetchEntity(account!), enabled: !!account })

  function search(a: string) { setInput(a); setAccount(a.trim()) }

  // Deep-link: /fds/investigation?account=ACC-xxx (from the Transaksi drawer, alerts, etc.)
  useEffect(() => {
    const a = params.get('account')
    if (a) search(a)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params])

  return (
    <>
      <PageHeader icon={UserSearch} title="FDS — Investigasi (Entity 360)"
        subtitle="Telusuri satu akun: transaksi, alert, status daftar, dan jaringan lawan transaksi" />

      <Card className="mb-6">
        <CardBody>
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative min-w-[260px] flex-1">
              <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
              <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && search(input)}
                placeholder="Masukkan nomor akun, mis. ACC-mule-001"
                className="h-9 w-full rounded-md border border-line bg-surface pl-9 pr-3 font-mono text-small text-ink focus:border-primary focus:outline-none" />
            </div>
            <Button variant="primary" onClick={() => search(input)} disabled={!input.trim()}><Search className="mr-1.5 h-4 w-4" />Telusuri</Button>
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-micro text-muted">Cepat:</span>
              {QUICK.map((a) => (
                <button key={a} type="button" onClick={() => search(a)} className="rounded border border-line bg-bg px-2 py-1 font-mono text-micro text-ink hover:border-primary hover:bg-primary/5">{a}</button>
              ))}
            </div>
          </div>
        </CardBody>
      </Card>

      {!account ? (
        <Card><CardBody><p className="py-10 text-center text-small text-muted">Telusuri sebuah akun untuk melihat profil 360°-nya.</p></CardBody></Card>
      ) : q.isError ? (
        <Card><ErrorState onRetry={() => q.refetch()} /></Card>
      ) : q.isPending ? (
        <Card className="p-6"><Skeleton className="h-40 w-full" /></Card>
      ) : (
        <EntityView e={q.data} onSelect={search} />
      )}
    </>
  )
}

function EntityView({ e, onSelect }: { e: Entity360; onSelect: (a: string) => void }) {
  const s = e.stats
  return (
    <div className="space-y-6">
      {/* Identity header */}
      <Card>
        <CardBody>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="font-mono text-h1 font-bold text-ink">{e.account}</div>
              <div className="mt-0.5 text-small text-muted">Lingkup: {e.tenant ?? 'semua PJP'}</div>
            </div>
            <div className="flex flex-wrap gap-2">
              {e.listHits.length === 0 ? (
                <Badge tone="neutral">Tidak ada di daftar mana pun</Badge>
              ) : e.listHits.map((h, i) => {
                const Icon = ACTION_ICON[h.action]
                return <span key={i} title={h.reason}><Badge tone={ACTION_TONE[h.action]} icon={Icon}>{h.action}</Badge></span>
              })}
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatCard label="Transaksi" value={String(s.txnCount)} sub={`${s.counterparties} lawan transaksi`} />
        <StatCard label="Masuk" value={rupiah(s.totalInMinor)} sub="total diterima" valueTone="success" />
        <StatCard label="Keluar" value={rupiah(s.totalOutMinor)} sub="total dikirim" valueTone="ink" />
        <StatCard label="Alert" value={String(s.alertCount)} sub="kasus terkait" subTone={s.alertCount ? 'warning' : 'muted'} valueTone={s.alertCount ? 'warning' : 'ink'} />
        <StatCard label="Fraud" value={String(s.confirmedFraud)} sub="terkonfirmasi" subTone={s.confirmedFraud ? 'danger' : 'muted'} valueTone={s.confirmedFraud ? 'danger' : 'ink'} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Counterparties (mule-ring view) */}
        <Card>
          <CardHeader title="Lawan transaksi" />
          <CardBody>
            {e.counterparties.length === 0 ? <p className="py-6 text-center text-small text-muted">Belum ada.</p> : (
              <ul className="space-y-1.5">
                {e.counterparties.map((c) => (
                  <li key={c.account} className="flex items-center justify-between rounded-md border border-line px-3 py-2 text-small">
                    <button type="button" onClick={() => { onSelect(c.account); window.scrollTo({ top: 0 }) }} className="font-mono text-ink hover:text-primary hover:underline">{c.account}</button>
                    <span className="flex items-center gap-2 text-muted">
                      {c.sentTo > 0 ? <span className="flex items-center gap-0.5"><ArrowUpRight className="h-3.5 w-3.5 text-danger" />{c.sentTo}</span> : null}
                      {c.receivedFrom > 0 ? <span className="flex items-center gap-0.5"><ArrowDownLeft className="h-3.5 w-3.5 text-success" />{c.receivedFrom}</span> : null}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>

        {/* Alerts */}
        <Card className="lg:col-span-2">
          <CardHeader title={`Alert terkait (${e.alerts.length})`} />
          <CardBody>
            {e.alerts.length === 0 ? <p className="py-6 text-center text-small text-muted">Tidak ada alert untuk akun ini.</p> : (
              <div className="overflow-x-auto">
                <table className="w-full text-small">
                  <thead>
                    <tr className="border-b border-line text-left text-micro uppercase tracking-wide text-muted">
                      <th className="py-2 pr-4 font-semibold">Skor</th>
                      <th className="py-2 pr-4 font-semibold">Band</th>
                      <th className="py-2 pr-4 font-semibold">Pemicu</th>
                      <th className="py-2 pr-4 font-semibold">Status</th>
                      <th className="py-2 pr-4 font-semibold"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {e.alerts.map((a) => (
                      <tr key={a.alertId} className="border-b border-line/60">
                        <td className="py-2 pr-4 tnum font-semibold text-ink">{a.score}</td>
                        <td className="py-2 pr-4"><Badge tone={bandTone(a.band)}>{a.band}</Badge></td>
                        <td className="py-2 pr-4 text-muted">{a.rule}{a.report ? ` · ${a.report}` : ''}</td>
                        <td className="py-2 pr-4 text-muted">{STATUS_LABEL[a.status] ?? a.status}</td>
                        <td className="py-2 pr-4"><Link to={`/fds/${a.alertId}`} className="font-semibold text-primary hover:underline">Buka</Link></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardBody>
        </Card>
      </div>

      {/* Transactions */}
      <Card>
        <CardHeader title={`Transaksi (${e.transactions.length})`} />
        <CardBody>
          {e.transactions.length === 0 ? <p className="py-6 text-center text-small text-muted">Tidak ada transaksi.</p> : (
            <div className="overflow-x-auto">
              <table className="w-full text-small">
                <thead>
                  <tr className="border-b border-line text-left text-micro uppercase tracking-wide text-muted">
                    <th className="py-2 pr-4 font-semibold">Arah</th>
                    <th className="py-2 pr-4 font-semibold">Ref</th>
                    <th className="py-2 pr-4 font-semibold">Channel</th>
                    <th className="py-2 pr-4 font-semibold text-right">Nominal</th>
                    <th className="py-2 pr-4 font-semibold">Lawan</th>
                  </tr>
                </thead>
                <tbody>
                  {e.transactions.slice(0, 100).map((t, i) => (
                    <tr key={i} className="border-b border-line/60">
                      <td className="py-2 pr-4">
                        {t.direction === 'OUT'
                          ? <span className="inline-flex items-center gap-1 text-danger"><ArrowUpRight className="h-3.5 w-3.5" />Keluar</span>
                          : <span className="inline-flex items-center gap-1 text-success"><ArrowDownLeft className="h-3.5 w-3.5" />Masuk</span>}
                      </td>
                      <td className="py-2 pr-4 font-mono text-micro text-muted">{t.txnRef}</td>
                      <td className="py-2 pr-4 text-muted">{t.channel}</td>
                      <td className="py-2 pr-4 text-right tnum font-semibold text-ink">{rupiah(t.amountMinor)}</td>
                      <td className="py-2 pr-4 font-mono text-micro text-muted">{t.counterparty ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  )
}

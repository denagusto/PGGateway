import { useState } from 'react'
import { Activity, CheckCircle2, XCircle, Send, AlertTriangle, RefreshCw } from 'lucide-react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { PageHeader } from '../components/PageHeader'
import { Card, CardBody, CardHeader } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Badge } from '../components/ui/Badge'
import { Skeleton } from '../components/ui/Skeleton'
import { EmptyState } from '../components/StateViews'
import { useToast } from '../components/ui/Toast'
import { fetchDevLogs, sendSignedIngest, sendUnsignedIngest, type IntegrationLogEntry } from '../lib/api'

const SAMPLE = JSON.stringify({
  externalId: 'MON-1', partnerReferenceNo: 'MON-1', transactionType: 'QRIS_MPM',
  amount: { value: '50000.00', currency: 'IDR' }, sourceAccountNo: 'ACC-buyer-01',
  beneficiaryAccountNo: 'ACC-merchant', latestTransactionStatus: '00',
})

export default function DeveloperLogs() {
  const qc = useQueryClient()
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const q = useQuery<IntegrationLogEntry[], Error>({ queryKey: ['dev-logs'], queryFn: () => fetchDevLogs(100), refetchInterval: 4000 })

  async function sendSigned() {
    setBusy(true)
    try {
      const body = JSON.stringify({ ...JSON.parse(SAMPLE), externalId: `MON-${Date.now()}`, partnerReferenceNo: `MON-${Date.now()}` })
      const r = await sendSignedIngest('pgk_sandbox_DEMOKEY', body)
      toast({ tone: r.status < 400 ? 'success' : 'error', title: `Terkirim · HTTP ${r.status}`, description: r.status < 400 ? 'Integrasi berhasil — cek monitor' : 'Ditolak' })
      qc.invalidateQueries({ queryKey: ['dev-logs'] })
    } catch (e) { toast({ tone: 'error', title: 'Gagal', description: (e as Error).message }) }
    finally { setBusy(false) }
  }

  async function sendUnsigned() {
    setBusy(true)
    try {
      const r = await sendUnsignedIngest(SAMPLE)
      toast({ tone: 'info', title: `HTTP ${r.status} (diharapkan gagal)`, description: 'Tanpa signature → ditolak. Lihat alasannya di monitor.' })
      qc.invalidateQueries({ queryKey: ['dev-logs'] })
    } catch (e) { toast({ tone: 'error', title: 'Gagal', description: (e as Error).message }) }
    finally { setBusy(false) }
  }

  const entries = q.data ?? []
  const ok = entries.filter((e) => e.status < 400).length
  const fail = entries.length - ok

  return (
    <>
      <PageHeader icon={Activity} title="Developer — Integration Monitor"
        subtitle="Pantau tiap pengiriman event: berhasil diterima atau ditolak, beserta alasannya"
        right={
          <>
            <Button variant="secondary" onClick={sendSigned} disabled={busy}><Send className="mr-1.5 h-4 w-4" />Kirim event uji (signed)</Button>
            <Button variant="ghost" onClick={sendUnsigned} disabled={busy}><AlertTriangle className="mr-1.5 h-4 w-4" />Kirim tanpa signature</Button>
          </>
        } />

      <div className="mb-6 grid grid-cols-3 gap-4">
        <StatMini label="Total percobaan" value={entries.length} tone="ink" icon={Activity} />
        <StatMini label="Berhasil" value={ok} tone="success" icon={CheckCircle2} />
        <StatMini label="Ditolak" value={fail} tone="danger" icon={XCircle} />
      </div>

      <Card>
        <CardHeader title="Log pengiriman (auto-refresh)" action={<RefreshCw aria-hidden="true" className={`h-4 w-4 text-muted ${q.isFetching ? 'animate-spin' : ''}`} />} />
        <CardBody>
          {q.isPending ? <Skeleton className="h-40 w-full" /> : entries.length === 0 ? (
            <EmptyState icon={Activity} title="Belum ada percobaan" description="Tekan “Kirim event uji” untuk melihat hasil integrasi di sini." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-small">
                <thead>
                  <tr className="border-b border-line text-left text-micro uppercase tracking-wide text-muted">
                    <th className="py-2 pr-4 font-semibold">Waktu</th>
                    <th className="py-2 pr-4 font-semibold">Hasil</th>
                    <th className="py-2 pr-4 font-semibold">Kode</th>
                    <th className="py-2 pr-4 font-semibold">Keterangan</th>
                    <th className="py-2 pr-4 font-semibold">Path</th>
                    <th className="py-2 pr-4 font-semibold">Key</th>
                    <th className="py-2 pr-4 font-semibold text-right">Latency</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((e, i) => {
                    const okRow = e.status < 400
                    return (
                      <tr key={i} className="border-b border-line/60">
                        <td className="py-2 pr-4 text-muted">{new Date(e.at).toLocaleTimeString('id-ID')}</td>
                        <td className="py-2 pr-4">
                          {okRow ? <Badge tone="success" icon={CheckCircle2}>{e.status}</Badge> : <Badge tone="danger" icon={XCircle}>{e.status}</Badge>}
                        </td>
                        <td className="py-2 pr-4 font-mono text-micro text-muted">{e.code}</td>
                        <td className={`py-2 pr-4 ${okRow ? 'text-ink' : 'text-danger'}`}>{e.message}</td>
                        <td className="py-2 pr-4 font-mono text-micro text-muted">{e.path}</td>
                        <td className="py-2 pr-4 font-mono text-micro text-muted">{e.clientKey}</td>
                        <td className="py-2 pr-4 text-right tnum text-muted">{e.latencyMs} ms</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>
    </>
  )
}

function StatMini({ label, value, tone, icon: Icon }: { label: string; value: number; tone: 'ink' | 'success' | 'danger'; icon: typeof Activity }) {
  const c = { ink: 'text-ink', success: 'text-success', danger: 'text-danger' }[tone]
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 text-micro font-semibold uppercase tracking-wide text-muted"><Icon className="h-3.5 w-3.5" />{label}</div>
      <div className={`mt-1 text-display font-bold ${c}`}>{value}</div>
    </Card>
  )
}

import { useState } from 'react'
import { Sparkles, BookOpen, Wand2, Copy, ShieldCheck } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { PageHeader } from '../components/PageHeader'
import { Card, CardBody, CardHeader } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Badge } from '../components/ui/Badge'
import { Skeleton } from '../components/ui/Skeleton'
import { useToast } from '../components/ui/Toast'
import { useTenant } from '../lib/tenant'
import { fetchTypologies, fetchAlertList, generateCopilot, type Typology, type CopilotResult } from '../lib/api'
import type { AlertRow } from '../data/types'

export default function FdsCopilot() {
  const toast = useToast()
  const { tenant } = useTenant()
  const typo = useQuery<Typology[], Error>({ queryKey: ['typologies'], queryFn: fetchTypologies })
  const alertsQ = useQuery<AlertRow[], Error>({ queryKey: ['copilot-alerts', tenant], queryFn: () => fetchAlertList('OPEN', 100, tenant) })
  const [alertId, setAlertId] = useState('')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<CopilotResult | null>(null)

  async function run() {
    if (!alertId) { toast({ title: 'Pilih alert dulu', tone: 'error' }); return }
    setBusy(true)
    try {
      const r = await generateCopilot(alertId)
      setResult(r)
      toast({ title: 'Copilot selesai', description: `${r.matchedTypologies.length} tipologi cocok · ${r.provider}`, tone: 'success' })
    } catch (e) { toast({ title: 'Copilot gagal', description: (e as Error).message, tone: 'error' }) }
    finally { setBusy(false) }
  }

  function copy(text: string) {
    navigator.clipboard?.writeText(text).then(() => toast({ title: 'Disalin', tone: 'info' })).catch(() => {})
  }

  const alerts = alertsQ.data ?? []

  return (
    <>
      <PageHeader icon={Sparkles} title="FDS — Copilot & Pustaka Tipologi"
        subtitle="Bantu analis: ringkas kasus & draf laporan, di-ground ke Pustaka Tipologi — semua on-premise"
        right={<Badge tone="success" icon={ShieldCheck}>On-prem · pelengkap (bukan pengambil keputusan)</Badge>} />

      {/* Copilot */}
      <Card className="mb-6">
        <CardHeader title="Copilot kasus" action={<Wand2 aria-hidden="true" className="h-4 w-4 text-muted" />} />
        <CardBody>
          <div className="flex flex-wrap items-end gap-3">
            <label className="flex min-w-[280px] flex-1 flex-col gap-1">
              <span className="text-micro font-semibold uppercase tracking-wide text-muted">Pilih alert (terbuka)</span>
              <select value={alertId} onChange={(e) => setAlertId(e.target.value)}
                className="h-9 w-full rounded-md border border-line bg-surface px-2.5 text-body text-ink focus:border-primary focus:outline-none">
                <option value="">— pilih alert —</option>
                {alerts.map((a) => (
                  <option key={a.id} value={a.id}>{a.account} · {a.band} · skor {a.score} · {a.id.slice(0, 8)}</option>
                ))}
              </select>
            </label>
            <Button variant="primary" onClick={run} disabled={busy || !alertId}><Sparkles className="mr-1.5 h-4 w-4" />{busy ? 'Memproses…' : 'Ringkas & draf laporan'}</Button>
          </div>

          {result ? (
            <div className="mt-5 space-y-4">
              <Block title="Ringkasan kasus" onCopy={() => copy(result.summary)}>
                <p className="text-body text-ink">{result.summary}</p>
              </Block>
              <Block title="Penjelasan sinyal">
                <pre className="whitespace-pre-wrap font-sans text-small text-ink">{result.explanation}</pre>
              </Block>
              <div>
                <div className="mb-2 text-micro font-semibold uppercase tracking-wide text-muted">Tipologi cocok (RAG)</div>
                {result.matchedTypologies.length === 0 ? (
                  <p className="text-small text-muted">Tidak ada tipologi pustaka yang cocok otomatis.</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {result.matchedTypologies.map((m) => (
                      <span key={m.code} className="rounded-md border border-line bg-bg px-3 py-2 text-small" title={m.matchedIndicators.join(', ')}>
                        <span className="font-semibold text-ink">{m.code}</span> · {m.name}
                        <span className="ml-2 tnum text-muted">{Math.round(m.score * 100)}%</span>
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <Block title="Draf laporan (LTKM/STR)" onCopy={() => copy(result.reportDraft)}>
                <pre className="whitespace-pre-wrap rounded-md bg-bg p-3 font-mono text-small text-ink">{result.reportDraft}</pre>
              </Block>
              <p className="text-micro text-muted">Dihasilkan oleh: <b className="text-ink">{result.provider}</b>. Draf wajib ditelaah & disetujui analis sebelum diajukan.</p>
            </div>
          ) : (
            <p className="mt-4 text-small text-muted">Pilih alert lalu jalankan — copilot meretrieve tipologi yang relevan dan menyusun draf laporan yang di-ground ke pustaka.</p>
          )}
        </CardBody>
      </Card>

      {/* Typology library (RAG corpus) */}
      <Card>
        <CardHeader title="Pustaka Tipologi (korpus RAG)" action={<BookOpen aria-hidden="true" className="h-4 w-4 text-muted" />} />
        <CardBody>
          {typo.isPending ? <Skeleton className="h-40 w-full" /> : typo.isError ? (
            <p className="text-small text-danger">Gagal memuat pustaka.</p>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {(typo.data ?? []).map((t) => (
                <div key={t.id} className="flex flex-col rounded-lg border border-line p-4">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-ink">{t.name}</span>
                    <Badge tone={t.category === 'AML' ? 'warning' : 'danger'}>{t.code}</Badge>
                  </div>
                  <p className="mt-2 flex-1 text-small text-muted">{t.description}</p>
                  <div className="mt-3 flex flex-wrap gap-1">
                    {t.indicators.slice(0, 6).map((ind) => (
                      <span key={ind} className="rounded bg-bg px-1.5 py-0.5 text-micro text-muted">{ind}</span>
                    ))}
                  </div>
                  <div className="mt-3 border-t border-line pt-2 text-micro text-muted">
                    <div><b className="text-ink">Regulasi:</b> {t.regulatoryMapping}</div>
                    <div className="mt-0.5"><b className="text-ink">Aksi:</b> {t.recommendedAction}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardBody>
      </Card>
    </>
  )
}

function Block({ title, children, onCopy }: { title: string; children: React.ReactNode; onCopy?: () => void }) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-micro font-semibold uppercase tracking-wide text-muted">{title}</span>
        {onCopy ? <button type="button" onClick={onCopy} className="inline-flex items-center gap-1 text-micro text-muted hover:text-primary"><Copy className="h-3.5 w-3.5" />Salin</button> : null}
      </div>
      {children}
    </div>
  )
}

import { useEffect, useState } from 'react'
import { Layers, History, Gauge, Save, RotateCcw } from 'lucide-react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { PageHeader } from '../components/PageHeader'
import { Card, CardBody, CardHeader } from '../components/ui/Card'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { Skeleton } from '../components/ui/Skeleton'
import { ErrorState } from '../components/StateViews'
import { useToast } from '../components/ui/Toast'
import { fetchScoringConfig, updateScoringConfig, type ScoringConfigSnapshot } from '../lib/api'

interface Detector {
  key: string // matches RiskSignal.category / config key
  name: string
  category: string
  baseWeight: string
  history: 'full' | 'partial' | 'none'
  desc: string
  tunable: boolean // false → managed elsewhere (regulatory rules live in "Rules & Daftar Pantau")
}

const DETECTORS: Detector[] = [
  { key: 'regulatory', name: 'Regulatory Rules', category: 'Aturan', baseWeight: 'per-rule (70–90)', history: 'partial', tunable: false,
    desc: 'Rule dinamis (SpEL) — LTKT/LTKM: ambang nominal, akumulasi harian, structuring, velocity. Bobot per-rule dikelola di "Rules & Daftar Pantau".' },
  { key: 'behavioral', name: 'Behavioral Anomaly', category: 'Perilaku', baseWeight: '55–95', history: 'full', tunable: true,
    desc: 'z-score nominal transaksi vs baseline akun (mean/σ dari riwayat). Menangkap account-takeover / lonjakan tak biasa.' },
  { key: 'velocity', name: 'Velocity Burst', category: 'Velocity', baseWeight: '55–72', history: 'full', tunable: true,
    desc: 'Frekuensi transaksi vs window 1m/10m/1j/24j dari riwayat akun. Menangkap bot / card-testing / cash-out.' },
  { key: 'network', name: 'Counterparty / Network', category: 'Jaringan', baseWeight: '55–85', history: 'full', tunable: true,
    desc: 'Lawan transaksi baru + fan-out (kirim ke banyak penerima dalam 24 jam) — pola mule, dari graph riwayat.' },
  { key: 'pattern', name: 'Pattern', category: 'Pola', baseWeight: '30–40', history: 'none', tunable: true,
    desc: 'Sinyal lemah-tapi-menumpuk: nominal bulat besar, transaksi di luar jam wajar (off-hours).' },
  { key: 'watchlist', name: 'Watchlist / Sanctions', category: 'Daftar', baseWeight: '95', history: 'none', tunable: true,
    desc: 'Pengirim/penerima ada di daftar pantau (mule, sanksi, DTTOT). Hampir pasti reportable.' },
]

const HISTORY_LABEL: Record<Detector['history'], { label: string; tone: 'success' | 'warning' | 'neutral' }> = {
  full: { label: 'Pakai riwayat', tone: 'success' },
  partial: { label: 'Sebagian riwayat', tone: 'warning' },
  none: { label: 'Per-transaksi', tone: 'neutral' },
}

type Draft = { layers: Record<string, { enabled: boolean; weight: number }>; medium: number; high: number; critical: number }

function toDraft(s: ScoringConfigSnapshot): Draft {
  const layers: Draft['layers'] = {}
  for (const d of DETECTORS) layers[d.key] = { enabled: s.layers[d.key]?.enabled ?? true, weight: s.layers[d.key]?.weight ?? 1 }
  return { layers, medium: s.mediumCutoff, high: s.highCutoff, critical: s.criticalCutoff }
}

export default function FdsDetectors() {
  const qc = useQueryClient()
  const toast = useToast()
  const q = useQuery<ScoringConfigSnapshot, Error>({ queryKey: ['scoring-config'], queryFn: fetchScoringConfig })
  const [draft, setDraft] = useState<Draft | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => { if (q.data) setDraft(toDraft(q.data)) }, [q.data])

  const dirty = !!(q.data && draft && JSON.stringify(draft) !== JSON.stringify(toDraft(q.data)))

  async function onSave() {
    if (!draft) return
    if (!(draft.medium < draft.high && draft.high < draft.critical)) {
      toast({ title: 'Band tidak valid', description: 'Harus MEDIUM < HIGH < CRITICAL.', tone: 'error' }); return
    }
    setSaving(true)
    try {
      await updateScoringConfig({
        layers: DETECTORS.map((d) => ({ category: d.key, enabled: draft.layers[d.key].enabled, weight: draft.layers[d.key].weight })),
        mediumCutoff: draft.medium, highCutoff: draft.high, criticalCutoff: draft.critical,
      })
      await qc.invalidateQueries({ queryKey: ['scoring-config'] })
      toast({ title: 'Konfigurasi tersimpan', description: 'Engine memakai bobot & band baru untuk transaksi berikutnya.', tone: 'success' })
    } catch (e) {
      toast({ title: 'Gagal menyimpan', description: (e as Error).message, tone: 'error' })
    } finally { setSaving(false) }
  }

  function setLayer(key: string, patch: Partial<{ enabled: boolean; weight: number }>) {
    setDraft((d) => d ? { ...d, layers: { ...d.layers, [key]: { ...d.layers[key], ...patch } } } : d)
  }

  return (
    <>
      <PageHeader icon={Layers} title="FDS — Detektor & Scoring"
        subtitle="Atur layer deteksi: aktif/nonaktif, bobot, dan ambang band — tersimpan & ber-audit"
        right={
          <>
            {dirty ? <Button variant="ghost" onClick={() => q.data && setDraft(toDraft(q.data))} disabled={saving}><RotateCcw className="mr-1.5 h-4 w-4" />Reset</Button> : null}
            <Button variant="primary" onClick={onSave} disabled={!dirty || saving}><Save className="mr-1.5 h-4 w-4" />{saving ? 'Menyimpan…' : 'Simpan konfigurasi'}</Button>
          </>
        } />

      {q.isError ? (
        <Card><ErrorState onRetry={() => q.refetch()} /></Card>
      ) : !draft ? (
        <Card className="p-6"><Skeleton className="h-40 w-full" /></Card>
      ) : (
        <>
          {/* Scoring model + configurable band cutoffs */}
          <Card className="mb-6">
            <CardHeader title="Model skoring (composite)" action={<Gauge aria-hidden="true" className="h-4 w-4 text-muted" />} />
            <CardBody>
              <p className="text-body text-ink">
                Tiap layer menghasilkan sinyal berbobot. Skor akhir = fusi <b>noisy-OR</b>:{' '}
                <code className="font-mono text-small">1 − Π(1 − pᵢ)</code>, di-cap 99. Bobot tiap layer ×faktor di bawah;
                <b> ambang band</b> menentukan prioritas triage:
              </p>
              <div className="mt-4 flex flex-wrap items-end gap-4">
                <BandInput label="MEDIUM ≥" color="#ca8a04" value={draft.medium} onChange={(v) => setDraft((d) => d ? { ...d, medium: v } : d)} />
                <BandInput label="HIGH ≥" color="#d97706" value={draft.high} onChange={(v) => setDraft((d) => d ? { ...d, high: v } : d)} />
                <BandInput label="CRITICAL ≥" color="#dc2626" value={draft.critical} onChange={(v) => setDraft((d) => d ? { ...d, critical: v } : d)} />
                <span className="pb-1.5 text-small text-muted">di bawah MEDIUM = <b className="text-ink">LOW</b> (tidak jadi alert)</span>
              </div>
            </CardBody>
          </Card>

          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
            {DETECTORS.map((d) => {
              const h = HISTORY_LABEL[d.history]
              const cfg = draft.layers[d.key]
              const off = !cfg.enabled
              return (
                <Card key={d.key} className={`flex flex-col p-5 transition-opacity ${off ? 'opacity-60' : ''}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="text-h2 font-semibold text-ink">{d.name}</div>
                      <Badge tone="neutral" className="mt-1">{d.category}</Badge>
                    </div>
                    <Badge tone={h.tone} icon={d.history === 'none' ? null : History}>{h.label}</Badge>
                  </div>
                  <p className="mt-3 flex-1 text-small text-muted">{d.desc}</p>

                  {/* Controls */}
                  <div className="mt-4 border-t border-line pt-3">
                    {d.tunable ? (
                      <>
                        <div className="flex items-center justify-between">
                          <Toggle checked={cfg.enabled} onChange={(v) => setLayer(d.key, { enabled: v })} label={cfg.enabled ? 'Aktif' : 'Nonaktif'} />
                          <span className="text-small text-muted">bobot ×<span className="tnum font-semibold text-ink">{cfg.weight.toFixed(1)}</span></span>
                        </div>
                        <input type="range" min={0} max={2} step={0.1} value={cfg.weight} disabled={off}
                          onChange={(e) => setLayer(d.key, { weight: Number(e.target.value) })}
                          className="mt-2 w-full accent-primary disabled:opacity-40" aria-label={`Bobot ${d.name}`} />
                        <div className="mt-1 text-micro uppercase tracking-wide text-muted">Bobot dasar: <span className="font-semibold text-ink">{d.baseWeight}</span></div>
                      </>
                    ) : (
                      <div className="flex items-center justify-between">
                        <Badge tone="info">dikelola di Rules</Badge>
                        <span className="text-micro uppercase tracking-wide text-muted">Bobot: <span className="font-semibold text-ink">{d.baseWeight}</span></span>
                      </div>
                    )}
                  </div>
                </Card>
              )
            })}
          </div>

          <Card className="mt-6">
            <CardBody>
              <div className="flex items-start gap-3">
                <History aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                <p className="text-small text-muted">
                  <b className="text-ink">Sumber riwayat:</b> FDS membaca transaksi sebelumnya lewat <i>feature store</i> per-akun
                  (window 24 jam + statistik all-time: baseline mean/σ, velocity multi-window, counterparty graph, akumulasi harian).
                  Perubahan di sini berlaku untuk transaksi berikutnya, tercatat di audit, dan sebaiknya diuji dulu di <b className="text-ink">Simulasi</b> sebelum dipakai produksi.
                </p>
              </div>
            </CardBody>
          </Card>
        </>
      )}
    </>
  )
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)}
      className="inline-flex items-center gap-2 text-small font-medium text-ink">
      <span className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${checked ? 'bg-primary' : 'bg-line'}`}>
        <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-4' : 'translate-x-0.5'}`} />
      </span>
      {label}
    </button>
  )
}

function BandInput({ label, value, color, onChange }: { label: string; value: number; color: string; onChange: (v: number) => void }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="inline-flex items-center gap-1.5 text-micro font-semibold uppercase tracking-wide text-muted">
        <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: color }} />{label}
      </span>
      <input type="number" min={1} max={99} value={value} onChange={(e) => onChange(Number(e.target.value))}
        className="tnum w-20 rounded-md border border-line bg-surface px-2.5 py-1.5 text-body font-semibold text-ink focus:border-primary focus:outline-none" />
    </label>
  )
}

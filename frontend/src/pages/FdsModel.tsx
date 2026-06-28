import { useState } from 'react'
import { BrainCircuit, GraduationCap, ArrowUpCircle, History, Database, Gauge, Cpu } from 'lucide-react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { PageHeader } from '../components/PageHeader'
import { Card, CardBody, CardHeader } from '../components/ui/Card'
import { StatCard } from '../components/ui/StatCard'
import { Button } from '../components/ui/Button'
import { Badge } from '../components/ui/Badge'
import { BarList } from '../components/ui/Charts'
import { Skeleton } from '../components/ui/Skeleton'
import { ErrorState } from '../components/StateViews'
import { useToast } from '../components/ui/Toast'
import { fetchModel, trainModel, promoteModel, type ModelSnapshot, type ModelMetrics } from '../lib/api'

const pct = (v: number) => `${Math.round(v * 100)}%`
const dec = (v: number) => v.toFixed(3)

export default function FdsModel() {
  const qc = useQueryClient()
  const toast = useToast()
  const [busy, setBusy] = useState<'train' | 'promote' | null>(null)
  const q = useQuery<ModelSnapshot, Error>({ queryKey: ['fds-model'], queryFn: fetchModel })

  async function onTrain() {
    setBusy('train')
    try {
      const run = await trainModel()
      if (run.status === 'INSUFFICIENT') {
        toast({ title: 'Belum cukup data', description: `Butuh ≥6 verdict dari kedua kelas (fraud & bukan). Saat ini ${run.samples} sampel.`, tone: 'info' })
      } else {
        toast({ title: `Model v${run.version} dilatih`, description: `${run.samples} sampel · AUC ${dec(run.metrics.auc)} · ${run.autoPromoted ? 'langsung dipromosikan' : 'menunggu promosi (challenger)'}`, tone: 'success' })
      }
      await qc.invalidateQueries({ queryKey: ['fds-model'] })
    } catch (e) {
      toast({ title: 'Gagal melatih', description: (e as Error).message, tone: 'error' })
    } finally { setBusy(null) }
  }

  async function onPromote() {
    setBusy('promote')
    try {
      const ok = await promoteModel()
      toast({ title: ok ? 'Challenger dipromosikan' : 'Tidak ada challenger', tone: ok ? 'success' : 'info' })
      await qc.invalidateQueries({ queryKey: ['fds-model'] })
    } catch (e) {
      toast({ title: 'Gagal promosi', description: (e as Error).message, tone: 'error' })
    } finally { setBusy(null) }
  }

  return (
    <>
      <PageHeader icon={BrainCircuit} title="FDS — Model & ML"
        subtitle="Model fraud terbimbing yang belajar dari verdict analis — terkalibrasi, explainable, auditable"
        right={
          <>
            {q.data?.challengerVersion ? (
              <Button variant="secondary" onClick={onPromote} disabled={busy !== null}>
                <ArrowUpCircle className="mr-1.5 h-4 w-4" />{busy === 'promote' ? 'Mempromosikan…' : `Promosikan challenger v${q.data.challengerVersion}`}
              </Button>
            ) : null}
            <Button variant="primary" onClick={onTrain} disabled={busy !== null}>
              <GraduationCap className="mr-1.5 h-4 w-4" />{busy === 'train' ? 'Melatih…' : 'Latih ulang model'}
            </Button>
          </>
        } />

      {q.isError ? (
        <Card><ErrorState onRetry={() => q.refetch()} /></Card>
      ) : q.isPending ? (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">{Array.from({ length: 4 }).map((_, i) => <Card key={i} className="p-5"><Skeleton className="h-20 w-full" /></Card>)}</div>
      ) : (
        <ModelView s={q.data} />
      )}
    </>
  )
}

function ModelView({ s }: { s: ModelSnapshot }) {
  const m = s.championMetrics
  const ch = s.challengerMetrics
  const weights = s.weights.map((w) => ({
    label: `${w.feature} ${w.weight >= 0 ? '↑' : '↓'}`,
    value: Math.round(Math.abs(w.weight) * 100) / 100 || 0.01,
    color: w.weight >= 0 ? '#dc2626' : '#16a34a',
  }))

  return (
    <div className="space-y-6">
      {/* Model card header */}
      <Card>
        <CardBody>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
            <div className="flex items-center gap-3">
              <div className="grid h-11 w-11 place-items-center rounded-xl bg-primary/10 text-primary"><Cpu className="h-6 w-6" /></div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-h2 font-semibold text-ink">{s.modelType}</span>
                  <Badge tone={s.trained ? 'success' : 'warning'}>{s.trained ? `champion v${s.championVersion}` : 'prior (belum dilatih)'}</Badge>
                </div>
                <div className="mt-0.5 text-small text-muted">{s.featureCount} fitur bernama · fusi linier + sigmoid · jalan in-process (data tak keluar box)</div>
              </div>
            </div>
            {s.challengerVersion ? (
              <Badge tone="info" icon={ArrowUpCircle}>challenger v{s.challengerVersion} menunggu promosi</Badge>
            ) : null}
          </div>
        </CardBody>
      </Card>

      {/* Performance KPIs */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatCard label="AUC (holdout)" value={s.trained ? dec(m.auc) : '—'} sub="pemisahan fraud vs sah" icon={Gauge} valueTone={m.auc >= 0.8 ? 'success' : m.auc >= 0.65 ? 'warning' : 'ink'} />
        <StatCard label="Precision" value={s.trained ? pct(m.precision) : '—'} sub="prediksi fraud yang benar" />
        <StatCard label="Recall" value={s.trained ? pct(m.recall) : '—'} sub="fraud yang tertangkap" />
        <StatCard label="F1" value={s.trained ? pct(m.f1) : '—'} sub="harmonik P·R" />
        <StatCard label="Akurasi" value={s.trained ? pct(m.accuracy) : '—'} sub={`n=${m.n} holdout`} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Feature importance — the explanation */}
        <Card className="lg:col-span-2">
          <CardHeader title="Bobot fitur (penjelasan model)" action={<span className="text-micro text-muted">↑ menaikkan risiko · ↓ menurunkan</span>} />
          <CardBody>
            {s.trained ? <BarList items={weights} /> : (
              <p className="py-6 text-center text-small text-muted">Model masih prior. Latih dengan verdict analis untuk melihat bobot yang dipelajari.</p>
            )}
          </CardBody>
        </Card>

        {/* Dataset + feedback loop */}
        <Card className="flex flex-col">
          <CardHeader title="Dataset pelatihan" action={<Database aria-hidden="true" className="h-4 w-4 text-muted" />} />
          <CardBody>
            <div className="space-y-2.5 text-body">
              <Row label="Berlabel (verdict)" value={String(s.labelledSamples)} strong />
              <Row label="Dikonfirmasi fraud" value={String(s.positives)} tone="danger" />
              <Row label="False-positive" value={String(s.negatives)} tone="success" />
              <Row label="Antre tanpa verdict" value={String(s.openUnlabelled)} tone="muted" />
            </div>
            <p className="mt-4 border-t border-line pt-3 text-small text-muted">
              <b className="text-ink">Feedback loop:</b> tiap verdict analis di Antrian Alert (fraud / false-positive)
              jadi satu baris berlabel. Tekan <i>Latih ulang</i> untuk fit model baru dari label terbaru.
            </p>
            {s.labelledSamples < 6 ? (
              <p className="mt-2 text-small text-warning">Butuh ≥6 verdict (kedua kelas) agar model bisa dilatih.</p>
            ) : null}
          </CardBody>
        </Card>
      </div>

      {/* Champion vs challenger */}
      {ch && s.challengerVersion ? (
        <Card>
          <CardHeader title={`Champion v${s.championVersion} vs Challenger v${s.challengerVersion}`} />
          <CardBody>
            <CompareTable champion={m} challenger={ch} />
          </CardBody>
        </Card>
      ) : null}

      {/* Training history */}
      <Card>
        <CardHeader title="Riwayat pelatihan" action={<History aria-hidden="true" className="h-4 w-4 text-muted" />} />
        <CardBody>
          {s.history.length === 0 ? (
            <p className="py-6 text-center text-small text-muted">Belum ada pelatihan. Tekan “Latih ulang model”.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-small">
                <thead>
                  <tr className="border-b border-line text-left text-micro uppercase tracking-wide text-muted">
                    <th className="py-2 pr-4 font-semibold">Versi</th>
                    <th className="py-2 pr-4 font-semibold">Waktu</th>
                    <th className="py-2 pr-4 font-semibold">Sampel</th>
                    <th className="py-2 pr-4 font-semibold">AUC</th>
                    <th className="py-2 pr-4 font-semibold">Precision</th>
                    <th className="py-2 pr-4 font-semibold">Recall</th>
                    <th className="py-2 pr-4 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {s.history.map((r, i) => (
                    <tr key={i} className="border-b border-line/60">
                      <td className="py-2 pr-4 font-semibold text-ink">{r.version ? `v${r.version}` : '—'}</td>
                      <td className="py-2 pr-4 text-muted">{new Date(r.trainedAt).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' })}</td>
                      <td className="py-2 pr-4 tnum">{r.samples} <span className="text-muted">({r.positives}/{r.negatives})</span></td>
                      <td className="py-2 pr-4 tnum">{r.status === 'TRAINED' ? dec(r.metrics.auc) : '—'}</td>
                      <td className="py-2 pr-4 tnum">{r.status === 'TRAINED' ? pct(r.metrics.precision) : '—'}</td>
                      <td className="py-2 pr-4 tnum">{r.status === 'TRAINED' ? pct(r.metrics.recall) : '—'}</td>
                      <td className="py-2 pr-4">
                        {r.status === 'INSUFFICIENT'
                          ? <Badge tone="warning">data kurang</Badge>
                          : r.autoPromoted ? <Badge tone="success">dipromosikan</Badge> : <Badge tone="info">challenger</Badge>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>

      {/* Complementary AI/RAG note */}
      <Card>
        <CardBody>
          <div className="flex items-start gap-3">
            <BrainCircuit aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
            <p className="text-small text-muted">
              <b className="text-ink">Catatan arsitektur:</b> inti deteksi = <b>ML (model ini) + aturan regulasi</b> —
              deterministik, real-time, dapat dijelaskan ke regulator. Lapisan <b>AI generatif/RAG</b> bersifat
              pelengkap dan <b>on-premise</b> (membantu analis meringkas kasus & menyusun draf laporan, bukan
              pengambil keputusan) — tidak ada data yang keluar dari lingkungan.
            </p>
          </div>
        </CardBody>
      </Card>
    </div>
  )
}

function Row({ label, value, tone = 'ink', strong }: { label: string; value: string; tone?: 'ink' | 'danger' | 'success' | 'muted'; strong?: boolean }) {
  const toneClass = { ink: 'text-ink', danger: 'text-danger', success: 'text-success', muted: 'text-muted' }[tone]
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted">{label}</span>
      <span className={`tnum ${strong ? 'text-h2 font-bold' : 'font-semibold'} ${toneClass}`}>{value}</span>
    </div>
  )
}

function CompareTable({ champion, challenger }: { champion: ModelMetrics; challenger: ModelMetrics }) {
  const rows: { k: string; c: string; n: string; better: boolean }[] = [
    { k: 'AUC', c: dec(champion.auc), n: dec(challenger.auc), better: challenger.auc >= champion.auc },
    { k: 'Precision', c: pct(champion.precision), n: pct(challenger.precision), better: challenger.precision >= champion.precision },
    { k: 'Recall', c: pct(champion.recall), n: pct(challenger.recall), better: challenger.recall >= champion.recall },
    { k: 'F1', c: pct(champion.f1), n: pct(challenger.f1), better: challenger.f1 >= champion.f1 },
  ]
  return (
    <table className="w-full text-body">
      <thead>
        <tr className="border-b border-line text-left text-micro uppercase tracking-wide text-muted">
          <th className="py-2 pr-4 font-semibold">Metrik</th>
          <th className="py-2 pr-4 font-semibold">Champion</th>
          <th className="py-2 pr-4 font-semibold">Challenger</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.k} className="border-b border-line/60">
            <td className="py-2 pr-4 font-medium text-ink">{r.k}</td>
            <td className="py-2 pr-4 tnum text-muted">{r.c}</td>
            <td className={`py-2 pr-4 tnum font-semibold ${r.better ? 'text-success' : 'text-danger'}`}>{r.n} {r.better ? '▲' : '▼'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

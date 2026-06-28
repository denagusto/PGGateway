import { Layers, History, Gauge } from 'lucide-react'
import { PageHeader } from '../components/PageHeader'
import { Card, CardBody, CardHeader } from '../components/ui/Card'
import { Badge } from '../components/ui/Badge'

interface Detector {
  name: string
  category: string
  weight: string
  history: 'full' | 'partial' | 'none'
  desc: string
}

const DETECTORS: Detector[] = [
  { name: 'Regulatory Rules', category: 'Aturan', weight: 'per-rule (70–90)', history: 'partial',
    desc: 'Rule dinamis (SpEL) — LTKT/LTKM: ambang nominal, akumulasi harian, structuring, velocity. Dikelola di "Rules & Daftar Pantau".' },
  { name: 'Behavioral Anomaly', category: 'Perilaku', weight: '55–95', history: 'full',
    desc: 'z-score nominal transaksi vs baseline akun (mean/σ dari riwayat). Menangkap account-takeover / lonjakan tak biasa.' },
  { name: 'Velocity Burst', category: 'Velocity', weight: '55–72', history: 'full',
    desc: 'Frekuensi transaksi vs window 1m/10m/1j/24j dari riwayat akun. Menangkap bot / card-testing / cash-out.' },
  { name: 'Counterparty / Network', category: 'Jaringan', weight: '55–85', history: 'full',
    desc: 'Lawan transaksi baru + fan-out (kirim ke banyak penerima dalam 24 jam) — pola mule, dari graph riwayat.' },
  { name: 'Pattern', category: 'Pola', weight: '30–40', history: 'none',
    desc: 'Sinyal lemah-tapi-menumpuk: nominal bulat besar, transaksi di luar jam wajar (off-hours).' },
  { name: 'Watchlist / Sanctions', category: 'Daftar', weight: '95', history: 'none',
    desc: 'Pengirim/penerima ada di daftar pantau (mule, sanksi, DTTOT). Hampir pasti reportable.' },
]

const HISTORY_LABEL: Record<Detector['history'], { label: string; tone: 'success' | 'warning' | 'neutral' }> = {
  full: { label: 'Pakai riwayat', tone: 'success' },
  partial: { label: 'Sebagian riwayat', tone: 'warning' },
  none: { label: 'Per-transaksi', tone: 'neutral' },
}

const BANDS = [
  { label: 'CRITICAL', range: '≥ 80', color: '#dc2626' },
  { label: 'HIGH', range: '60–79', color: '#d97706' },
  { label: 'MEDIUM', range: '40–59', color: '#ca8a04' },
  { label: 'LOW', range: '< 40', color: '#6b7185' },
]

export default function FdsDetectors() {
  return (
    <>
      <PageHeader icon={Layers} title="FDS — Detektor & Scoring"
        subtitle="Layer deteksi berlapis, sumber riwayat, dan model skoring komposit" />

      <Card className="mb-6">
        <CardHeader title="Model skoring (composite)" action={<Gauge aria-hidden="true" className="h-4 w-4 text-muted" />} />
        <CardBody>
          <p className="text-body text-ink">
            Tiap layer menghasilkan sinyal berbobot (0–99 = "seberapa kuat sinyal ini saja"). Skor akhir =
            fusi <b>noisy-OR</b>: <code className="font-mono text-small">1 − Π(1 − pᵢ)</code>, di-cap 99 (mesin tak
            pernah klaim 100% — analis pegang keputusan). Banyak sinyal saling menguatkan tanpa overflow.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {BANDS.map((b) => (
              <span key={b.label} className="inline-flex items-center gap-2 rounded-md border border-line px-3 py-1.5 text-small">
                <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: b.color }} />
                <span className="font-semibold text-ink">{b.label}</span>
                <span className="tnum text-muted">{b.range}</span>
              </span>
            ))}
          </div>
        </CardBody>
      </Card>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
        {DETECTORS.map((d) => {
          const h = HISTORY_LABEL[d.history]
          return (
            <Card key={d.name} className="flex flex-col p-5">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-h2 font-semibold text-ink">{d.name}</div>
                  <Badge tone="neutral" className="mt-1">{d.category}</Badge>
                </div>
                <Badge tone={h.tone} icon={d.history === 'none' ? null : History}>{h.label}</Badge>
              </div>
              <p className="mt-3 flex-1 text-small text-muted">{d.desc}</p>
              <div className="mt-3 border-t border-line pt-2 text-micro uppercase tracking-wide text-muted">
                Bobot sinyal: <span className="font-semibold text-ink">{d.weight}</span>
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
              Profil ini di-warm dari event store durable di produksi (Redis) — sehingga deteksi melihat konteks, bukan hanya transaksi tunggal.
            </p>
          </div>
        </CardBody>
      </Card>
    </>
  )
}

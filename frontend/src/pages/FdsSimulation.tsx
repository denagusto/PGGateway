import { useState } from 'react'
import { FlaskConical, Play, ShieldAlert, CheckCircle2 } from 'lucide-react'
import { PageHeader } from '../components/PageHeader'
import { Card, CardBody, CardHeader } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Badge } from '../components/ui/Badge'
import { RiskGauge } from '../components/ui/RiskGauge'
import { useToast } from '../components/ui/Toast'
import { simulateTxn, type SimulateResult } from '../lib/api'

const TYPES = ['TRANSFER_INTRABANK', 'QRIS_MPM', 'VIRTUAL_ACCOUNT', 'DIRECT_DEBIT']

interface Scenario { label: string; desc: string; src: string; dst: string; amount: number; type: string }
const SCENARIOS: Scenario[] = [
  { label: 'Normal', desc: 'transaksi wajar', src: 'ACC-budi-01', dst: 'ACC-merchant', amount: 75_000, type: 'QRIS_MPM' },
  { label: 'Akun blocklist', desc: 'pengirim di blocklist (seed ACC-mule-001)', src: 'ACC-mule-001', dst: 'ACC-dest', amount: 90_000, type: 'TRANSFER_INTRABANK' },
  { label: 'Warning list', desc: 'pengirim dipantau (seed ACC-watch-77)', src: 'ACC-watch-77', dst: 'ACC-dest', amount: 80_000, type: 'TRANSFER_INTRABANK' },
  { label: 'Allowlist', desc: 'akun tepercaya (seed ACC-payroll-gov)', src: 'ACC-payroll-gov', dst: 'ACC-staff', amount: 120_000, type: 'TRANSFER_INTRABANK' },
  { label: 'Nominal besar', desc: 'Rp150 jt (uji ambang LTKT)', src: 'ACC-corp-9', dst: 'ACC-vendor', amount: 150_000_000, type: 'TRANSFER_INTRABANK' },
]

const CAT_LABEL: Record<string, string> = {
  watchlist: 'Watchlist', regulatory: 'Regulasi', behavioral: 'Perilaku',
  velocity: 'Velocity', network: 'Jaringan', pattern: 'Pola', ml: 'ML',
}

interface RunRecord extends SimulateResult { label: string; at: string }

export default function FdsSimulation() {
  const toast = useToast()
  const [form, setForm] = useState({ type: 'QRIS_MPM', amount: 75_000, src: 'ACC-budi-01', dst: 'ACC-merchant' })
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<RunRecord | null>(null)
  const [history, setHistory] = useState<RunRecord[]>([])

  function applyScenario(s: Scenario) {
    setForm({ type: s.type, amount: s.amount, src: s.src, dst: s.dst })
  }

  async function run(label = 'Kustom') {
    setBusy(true)
    try {
      const n = Date.now()
      const res = await simulateTxn({
        externalId: `SIM-${n}`, partnerReferenceNo: `SIMREF-${n}`,
        transactionType: form.type, amount: { value: form.amount.toFixed(2), currency: 'IDR' },
        sourceAccountNo: form.src.trim(), beneficiaryAccountNo: form.dst.trim(),
        latestTransactionStatus: '00', seq: null,
      })
      const rec: RunRecord = { ...res, label, at: new Date().toLocaleTimeString('id-ID') }
      setResult(rec)
      setHistory((h) => [rec, ...h].slice(0, 12))
      toast({ tone: res.alertRaised ? 'info' : 'success', title: res.scored ? `Skor ${res.score} (${res.band})` : res.outcome, description: res.alertRaised ? 'Alert dibuat di antrian' : 'Tidak memicu alert' })
    } catch (e) { toast({ tone: 'error', title: 'Simulasi gagal', description: (e as Error).message }) }
    finally { setBusy(false) }
  }

  return (
    <>
      <PageHeader icon={FlaskConical} title="FDS — Simulasi"
        subtitle="Uji skenario transaksi ke engine sungguhan (config & daftar yang sedang aktif) sebelum dipakai produksi" />

      {/* Scenario presets */}
      <Card className="mb-6">
        <CardHeader title="Skenario cepat" />
        <CardBody>
          <div className="flex flex-wrap gap-2">
            {SCENARIOS.map((s) => (
              <button key={s.label} type="button" onClick={() => applyScenario(s)} title={s.desc}
                className="rounded-md border border-line bg-bg px-3 py-2 text-left text-small transition-colors hover:border-primary hover:bg-primary/5">
                <div className="font-semibold text-ink">{s.label}</div>
                <div className="text-micro text-muted">{s.desc}</div>
              </button>
            ))}
          </div>
        </CardBody>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Form */}
        <Card>
          <CardHeader title="Parameter transaksi" />
          <CardBody>
            <div className="space-y-4">
              <Field label="Jenis transaksi">
                <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}
                  className="h-9 w-full rounded-md border border-line bg-surface px-2.5 text-body text-ink focus:border-primary focus:outline-none">
                  {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </Field>
              <Field label="Nominal (Rp)">
                <input type="number" min={0} value={form.amount} onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })}
                  className="tnum h-9 w-full rounded-md border border-line bg-surface px-3 text-body text-ink focus:border-primary focus:outline-none" />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Akun pengirim">
                  <input value={form.src} onChange={(e) => setForm({ ...form, src: e.target.value })}
                    className="h-9 w-full rounded-md border border-line bg-surface px-3 font-mono text-small text-ink focus:border-primary focus:outline-none" />
                </Field>
                <Field label="Akun penerima">
                  <input value={form.dst} onChange={(e) => setForm({ ...form, dst: e.target.value })}
                    className="h-9 w-full rounded-md border border-line bg-surface px-3 font-mono text-small text-ink focus:border-primary focus:outline-none" />
                </Field>
              </div>
              <Button variant="primary" onClick={() => run()} disabled={busy} className="w-full">
                <Play className="mr-1.5 h-4 w-4" />{busy ? 'Menjalankan…' : 'Jalankan simulasi'}
              </Button>
            </div>
          </CardBody>
        </Card>

        {/* Result */}
        <Card>
          <CardHeader title="Hasil penilaian" />
          <CardBody>
            {!result ? (
              <p className="py-10 text-center text-small text-muted">Pilih skenario atau isi parameter, lalu jalankan.</p>
            ) : !result.scored ? (
              <p className="py-10 text-center text-small text-muted">Hasil: {result.outcome} (mungkin duplikat). Coba lagi.</p>
            ) : (
              <div className="flex flex-col items-center">
                <RiskGauge score={result.score} size={140} />
                <div className="mt-3 flex items-center gap-2">
                  <Badge tone={result.alertRaised ? 'danger' : 'success'} icon={result.alertRaised ? ShieldAlert : CheckCircle2}>
                    {result.alertRaised ? 'Alert dibuat' : 'Tidak memicu alert'}
                  </Badge>
                </div>
                <div className="mt-5 w-full">
                  <div className="mb-2 text-micro font-semibold uppercase tracking-wide text-muted">Sinyal yang menyala ({result.signals.length})</div>
                  {result.signals.length === 0 ? (
                    <p className="text-small text-muted">Tidak ada sinyal — transaksi tampak wajar.</p>
                  ) : (
                    <ul className="space-y-1.5">
                      {result.signals.map((s, i) => (
                        <li key={i} className="flex items-center justify-between rounded-md border border-line px-3 py-2 text-small">
                          <span className="flex items-center gap-2">
                            <Badge tone="neutral">{CAT_LABEL[s.category] ?? s.category}</Badge>
                            <span className="text-ink">{s.label}</span>
                          </span>
                          <span className="tnum font-semibold text-ink">+{s.points}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            )}
          </CardBody>
        </Card>
      </div>

      {/* History */}
      {history.length > 0 ? (
        <Card className="mt-6">
          <CardHeader title="Riwayat simulasi (sesi ini)" />
          <CardBody>
            <div className="overflow-x-auto">
              <table className="w-full text-small">
                <thead>
                  <tr className="border-b border-line text-left text-micro uppercase tracking-wide text-muted">
                    <th className="py-2 pr-4 font-semibold">Waktu</th>
                    <th className="py-2 pr-4 font-semibold">Skenario</th>
                    <th className="py-2 pr-4 font-semibold">Skor</th>
                    <th className="py-2 pr-4 font-semibold">Band</th>
                    <th className="py-2 pr-4 font-semibold">Alert</th>
                    <th className="py-2 pr-4 font-semibold">Sinyal</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((r, i) => (
                    <tr key={i} className="border-b border-line/60">
                      <td className="py-2 pr-4 text-muted">{r.at}</td>
                      <td className="py-2 pr-4 font-medium text-ink">{r.label}</td>
                      <td className="py-2 pr-4 tnum font-semibold text-ink">{r.scored ? r.score : '—'}</td>
                      <td className="py-2 pr-4">{r.scored ? <Badge tone={r.band === 'CRITICAL' || r.band === 'HIGH' ? 'danger' : r.band === 'MEDIUM' ? 'warning' : 'neutral'}>{r.band}</Badge> : '—'}</td>
                      <td className="py-2 pr-4">{r.alertRaised ? <Badge tone="danger">ya</Badge> : <span className="text-muted">tidak</span>}</td>
                      <td className="py-2 pr-4 text-muted">{r.signals.map((s) => s.label).join(', ') || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardBody>
        </Card>
      ) : null}
    </>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-micro font-semibold uppercase tracking-wide text-muted">{label}</span>
      {children}
    </label>
  )
}

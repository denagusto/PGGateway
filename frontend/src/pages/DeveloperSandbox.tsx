import { useState } from 'react'
import { FlaskConical, Play, Copy, KeyRound, ShieldCheck, Terminal } from 'lucide-react'
import { PageHeader } from '../components/PageHeader'
import { Card, CardBody, CardHeader } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Badge } from '../components/ui/Badge'
import { useToast } from '../components/ui/Toast'
import { simulateTxn, type SimulateResult } from '../lib/api'

const TYPES = ['QRIS_MPM', 'TRANSFER_INTRABANK', 'VIRTUAL_ACCOUNT', 'DIRECT_DEBIT']
const PRESETS = [
  { label: 'Pembayaran QRIS', type: 'QRIS_MPM', amount: 75_000, src: 'ACC-buyer-01', dst: 'ACC-merchant' },
  { label: 'Transfer besar', type: 'TRANSFER_INTRABANK', amount: 150_000_000, src: 'ACC-corp-1', dst: 'ACC-vendor' },
  { label: 'Uji fraud (blocklist)', type: 'TRANSFER_INTRABANK', amount: 90_000, src: 'ACC-mule-001', dst: 'ACC-x' },
]

export default function DeveloperSandbox() {
  const toast = useToast()
  const [form, setForm] = useState({ type: 'QRIS_MPM', amount: 75_000, src: 'ACC-buyer-01', dst: 'ACC-merchant' })
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<SimulateResult | null>(null)

  function copy(t: string) { navigator.clipboard?.writeText(t).then(() => toast({ title: 'Disalin', tone: 'info' })).catch(() => {}) }

  async function run() {
    setBusy(true)
    try {
      const n = Date.now()
      const r = await simulateTxn({
        externalId: `SBX-${n}`, partnerReferenceNo: `SBX-${n}`, transactionType: form.type,
        amount: { value: form.amount.toFixed(2), currency: 'IDR' }, sourceAccountNo: form.src.trim(),
        beneficiaryAccountNo: form.dst.trim(), latestTransactionStatus: '00', seq: null,
      })
      setResult(r)
      toast({ tone: r.alertRaised ? 'info' : 'success', title: r.scored ? `Diproses · skor ${r.score} (${r.band})` : r.outcome, description: r.alertRaised ? 'Memicu alert FDS' : 'Lolos FDS' })
    } catch (e) { toast({ tone: 'error', title: 'Gagal', description: (e as Error).message }) }
    finally { setBusy(false) }
  }

  const curl = `curl -X POST https://api.pggateway.id/api/ingest/mirror \\
  -H "X-CLIENT-KEY: pgk_sandbox_DEMOKEY" \\
  -H "X-TIMESTAMP: $(date -u +%Y-%m-%dT%H:%M:%S%z)" \\
  -H "X-SIGNATURE: <HMAC-SHA512(...)>" \\
  -H "Content-Type: application/json" \\
  -d '{"externalId":"SBX-1","partnerReferenceNo":"SBX-1","transactionType":"${form.type}",
       "amount":{"value":"${form.amount.toFixed(2)}","currency":"IDR"},
       "sourceAccountNo":"${form.src}","beneficiaryAccountNo":"${form.dst}","latestTransactionStatus":"00"}'`

  return (
    <>
      <PageHeader icon={FlaskConical} title="Developer — Sandbox"
        subtitle="Uji integrasi & skenario transaksi terhadap pipeline nyata, tanpa risiko"
        right={<Badge tone="warning">lingkungan sandbox</Badge>} />

      {/* Sandbox credentials */}
      <Card className="mb-6">
        <CardHeader title="Kredensial sandbox" action={<KeyRound aria-hidden="true" className="h-4 w-4 text-muted" />} />
        <CardBody>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Cred label="X-CLIENT-KEY" value="pgk_sandbox_DEMOKEY" onCopy={copy} />
            <Cred label="Client Secret" value="pgs_sandbox_DEMOSECRET" onCopy={copy} />
          </div>
          <p className="mt-3 text-small text-muted">Pakai kredensial ini untuk menandatangani request SNAP ke endpoint sandbox. Data sintetis, tidak memengaruhi produksi.</p>
        </CardBody>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Simulator */}
        <Card>
          <CardHeader title="Simulator transaksi" action={<Play aria-hidden="true" className="h-4 w-4 text-muted" />} />
          <CardBody>
            <div className="mb-4 flex flex-wrap gap-2">
              {PRESETS.map((p) => (
                <button key={p.label} type="button" onClick={() => setForm({ type: p.type, amount: p.amount, src: p.src, dst: p.dst })}
                  className="rounded-md border border-line bg-bg px-2.5 py-1.5 text-small text-ink hover:border-primary hover:bg-primary/5">{p.label}</button>
              ))}
            </div>
            <div className="space-y-3">
              <Row label="Jenis">
                <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}
                  className="h-9 w-full rounded-md border border-line bg-surface px-2.5 text-body text-ink focus:border-primary focus:outline-none">
                  {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </Row>
              <Row label="Nominal (Rp)">
                <input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })}
                  className="tnum h-9 w-full rounded-md border border-line bg-surface px-3 text-body text-ink focus:border-primary focus:outline-none" />
              </Row>
              <div className="grid grid-cols-2 gap-3">
                <Row label="Pengirim"><input value={form.src} onChange={(e) => setForm({ ...form, src: e.target.value })} className="h-9 w-full rounded-md border border-line bg-surface px-3 font-mono text-small text-ink focus:border-primary focus:outline-none" /></Row>
                <Row label="Penerima"><input value={form.dst} onChange={(e) => setForm({ ...form, dst: e.target.value })} className="h-9 w-full rounded-md border border-line bg-surface px-3 font-mono text-small text-ink focus:border-primary focus:outline-none" /></Row>
              </div>
              <Button variant="primary" onClick={run} disabled={busy} className="w-full"><Play className="mr-1.5 h-4 w-4" />{busy ? 'Mengirim…' : 'Kirim ke sandbox'}</Button>
            </div>

            {result ? (
              <div className="mt-4 rounded-md border border-line bg-bg p-3 text-small">
                <div className="flex items-center justify-between"><span className="text-muted">Outcome</span><span className="font-mono text-ink">{result.outcome}</span></div>
                <div className="mt-1 flex items-center justify-between"><span className="text-muted">Skor FDS</span><span className="font-semibold text-ink">{result.scored ? `${result.score} (${result.band})` : '—'}</span></div>
                <div className="mt-1 flex items-center justify-between"><span className="text-muted">Alert</span>{result.alertRaised ? <Badge tone="danger">dibuat</Badge> : <span className="text-success">tidak</span>}</div>
                {result.signals.length ? <div className="mt-2 text-micro text-muted">Sinyal: {result.signals.map((s) => `${s.label} (+${s.points})`).join(', ')}</div> : null}
              </div>
            ) : null}
          </CardBody>
        </Card>

        {/* Request snippet */}
        <Card>
          <CardHeader title="Contoh request (cURL)" action={<button type="button" onClick={() => copy(curl)} className="inline-flex items-center gap-1 text-micro text-muted hover:text-primary"><Copy className="h-3.5 w-3.5" />Salin</button>} />
          <CardBody>
            <pre className="overflow-x-auto rounded-md bg-ink/5 p-3 font-mono text-micro text-ink"><Terminal className="mb-2 h-4 w-4 text-muted" />{curl}</pre>
            <p className="mt-3 text-small text-muted">Tanda tangani <code className="font-mono">X-SIGNATURE</code> = Base64(HMAC-SHA512(stringToSign, secret)). Lihat tab Dokumentasi untuk format <code className="font-mono">stringToSign</code>.</p>
          </CardBody>
        </Card>
      </div>

      <Card className="mt-6">
        <CardBody>
          <div className="flex items-start gap-3">
            <ShieldCheck aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
            <p className="text-small text-muted">Sandbox memakai pipeline yang sama dengan produksi (ingest → scoring FDS → ledger), jadi kamu bisa menguji skenario sukses maupun fraud sebelum go-live. Minta kredensial production setelah integrasi lolos uji.</p>
          </div>
        </CardBody>
      </Card>
    </>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-micro font-semibold uppercase tracking-wide text-muted">{label}</span>
      {children}
    </label>
  )
}

function Cred({ label, value, onCopy }: { label: string; value: string; onCopy: (v: string) => void }) {
  return (
    <div className="rounded-md border border-line bg-bg p-3">
      <div className="text-micro font-semibold uppercase tracking-wide text-muted">{label}</div>
      <div className="mt-1 flex items-center justify-between gap-2">
        <code className="truncate font-mono text-small text-ink">{value}</code>
        <button type="button" onClick={() => onCopy(value)} aria-label="Salin" className="shrink-0 text-muted hover:text-primary"><Copy className="h-3.5 w-3.5" /></button>
      </div>
    </div>
  )
}

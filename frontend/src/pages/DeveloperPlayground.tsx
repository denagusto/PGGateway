import { useState } from 'react'
import { KeyRound, Wand2, Copy } from 'lucide-react'
import { PageHeader } from '../components/PageHeader'
import { Card, CardBody, CardHeader } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { useToast } from '../components/ui/Toast'
import { signSnap, type SignResult } from '../lib/api'

const SAMPLE_BODY = JSON.stringify({
  externalId: 'TX-1', partnerReferenceNo: 'TX-1', transactionType: 'QRIS_MPM',
  amount: { value: '50000.00', currency: 'IDR' }, sourceAccountNo: 'ACC-buyer-01',
  beneficiaryAccountNo: 'ACC-merchant', latestTransactionStatus: '00',
}, null, 2)

export default function DeveloperPlayground() {
  const toast = useToast()
  const [clientKey, setClientKey] = useState('pgk_sandbox_DEMOKEY')
  const [method, setMethod] = useState('POST')
  const [path, setPath] = useState('/api/ingest/mirror')
  const [body, setBody] = useState(SAMPLE_BODY)
  const [busy, setBusy] = useState(false)
  const [res, setRes] = useState<SignResult | null>(null)

  function copy(t: string) { navigator.clipboard?.writeText(t).then(() => toast({ title: 'Disalin', tone: 'info' })).catch(() => {}) }

  async function generate() {
    setBusy(true)
    try {
      const r = await signSnap({ clientKey, method, path, body })
      setRes(r)
      toast({ tone: 'success', title: 'Signature dibuat', description: 'Header siap dipakai (berlaku 5 menit)' })
    } catch (e) { toast({ tone: 'error', title: 'Gagal', description: (e as Error).message }) }
    finally { setBusy(false) }
  }

  const curl = res ? `curl -X ${method} https://api.pggateway.id${path} \\
${Object.entries(res.headers).map(([k, v]) => `  -H "${k}: ${v}"`).join(' \\\n')} \\
  -d '${body.replace(/\n\s*/g, '')}'` : ''

  return (
    <>
      <PageHeader icon={KeyRound} title="Developer — Signature Playground"
        subtitle="Tempel payload → dapat header SNAP bertanda tangan (HMAC-SHA512). Pakai logika yang sama dengan verifikasi server." />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Request" action={<Wand2 aria-hidden="true" className="h-4 w-4 text-muted" />} />
          <CardBody>
            <div className="space-y-3">
              <Row label="X-CLIENT-KEY"><input value={clientKey} onChange={(e) => setClientKey(e.target.value)} className="h-9 w-full rounded-md border border-line bg-surface px-3 font-mono text-small text-ink focus:border-primary focus:outline-none" /></Row>
              <div className="grid grid-cols-3 gap-3">
                <Row label="Method">
                  <select value={method} onChange={(e) => setMethod(e.target.value)} className="h-9 w-full rounded-md border border-line bg-surface px-2.5 text-body text-ink focus:border-primary focus:outline-none">
                    {['POST', 'PUT', 'GET'].map((m) => <option key={m} value={m}>{m}</option>)}
                  </select>
                </Row>
                <div className="col-span-2"><Row label="Path"><input value={path} onChange={(e) => setPath(e.target.value)} className="h-9 w-full rounded-md border border-line bg-surface px-3 font-mono text-small text-ink focus:border-primary focus:outline-none" /></Row></div>
              </div>
              <Row label="Body (JSON)">
                <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={9} className="w-full rounded-md border border-line bg-surface px-3 py-2 font-mono text-micro text-ink focus:border-primary focus:outline-none" />
              </Row>
              <Button variant="primary" onClick={generate} disabled={busy} className="w-full"><Wand2 className="mr-1.5 h-4 w-4" />{busy ? 'Membuat…' : 'Generate signature'}</Button>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Hasil" />
          <CardBody>
            {!res ? <p className="py-10 text-center text-small text-muted">Isi request lalu generate.</p> : (
              <div className="space-y-4">
                <Out label="X-TIMESTAMP" value={res.timestamp} onCopy={copy} />
                <Out label="Body SHA-256" value={res.bodyHashHex} onCopy={copy} mono />
                <Out label="stringToSign" value={res.stringToSign} onCopy={copy} mono />
                <Out label="X-SIGNATURE" value={res.signature} onCopy={copy} mono />
                <div>
                  <div className="mb-1.5 flex items-center justify-between">
                    <span className="text-micro font-semibold uppercase tracking-wide text-muted">cURL siap pakai</span>
                    <button type="button" onClick={() => copy(curl)} className="inline-flex items-center gap-1 text-micro text-muted hover:text-primary"><Copy className="h-3.5 w-3.5" />Salin</button>
                  </div>
                  <pre className="overflow-x-auto rounded-md bg-ink/5 p-3 font-mono text-micro text-ink">{curl}</pre>
                </div>
                <p className="text-micro text-muted">Kirim body persis sama dengan yang ditandatangani; timestamp valid 5 menit.</p>
              </div>
            )}
          </CardBody>
        </Card>
      </div>
    </>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="flex flex-col gap-1"><span className="text-micro font-semibold uppercase tracking-wide text-muted">{label}</span>{children}</label>
}

function Out({ label, value, onCopy, mono }: { label: string; value: string; onCopy: (v: string) => void; mono?: boolean }) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <span className="text-micro font-semibold uppercase tracking-wide text-muted">{label}</span>
        <button type="button" onClick={() => onCopy(value)} className="text-muted hover:text-primary"><Copy className="h-3.5 w-3.5" /></button>
      </div>
      <div className={`overflow-x-auto rounded-md border border-line bg-bg px-3 py-2 text-small text-ink ${mono ? 'font-mono text-micro' : ''}`}>{value}</div>
    </div>
  )
}

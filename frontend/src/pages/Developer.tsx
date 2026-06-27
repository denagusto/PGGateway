import { useState } from 'react'
import { KeyRound, Plus, Copy, Trash2, ExternalLink, BookOpen, ShieldAlert, ShieldCheck, Code2 } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { PageHeader } from '../components/PageHeader'
import { Card, CardBody, CardHeader } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Badge } from '../components/ui/Badge'
import { Input, Field } from '../components/ui/Input'
import { Select } from '../components/ui/Select'
import { Skeleton } from '../components/ui/Skeleton'
import { EmptyState, ErrorState } from '../components/StateViews'
import { fetchKeys, createKey, revokeKey, API_BASE } from '../lib/api'
import type { ApiKey, IssuedKey } from '../data/types'

const SCOPES = ['ingest:write', 'transactions:read', 'alerts:read', 'rules:read']

export default function Developer() {
  const qc = useQueryClient()
  const query = useQuery<ApiKey[], Error>({ queryKey: ['devkeys'], queryFn: fetchKeys })
  const [name, setName] = useState('')
  const [env, setEnv] = useState('sandbox')
  const [scopes, setScopes] = useState<string[]>(['ingest:write', 'alerts:read'])
  const [issued, setIssued] = useState<IssuedKey | null>(null)

  const create = useMutation({
    mutationFn: () => createKey({ name, env, scopes }),
    onSuccess: (res) => {
      setIssued(res)
      setName('')
      qc.invalidateQueries({ queryKey: ['devkeys'] })
    },
  })
  const revoke = useMutation({
    mutationFn: (id: string) => revokeKey(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['devkeys'] }),
  })

  const toggleScope = (s: string) =>
    setScopes((cur) => (cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s]))

  return (
    <>
      <PageHeader
        icon={Code2}
        title="Developer"
        subtitle="Integrasi PJP — kelola API key, dokumentasi, dan cara terhubung"
      />

      {/* one-time secret callout */}
      {issued ? (
        <Card className="mb-6 border-warning">
          <CardHeader title="Key dibuat — salin sekarang (tidak ditampilkan lagi)" />
          <CardBody>
            <Secret label="API Key" value={issued.apiKey} />
            <Secret label="Secret" value={issued.secret} />
            <p className="mt-2 text-small text-warning">
              Simpan di tempat aman. Secret tidak akan ditampilkan ulang.
            </p>
            <Button variant="secondary" className="mt-3" onClick={() => setIssued(null)}>Tutup</Button>
          </CardBody>
        </Card>
      ) : null}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* create */}
        <Card>
          <CardHeader title="Buat API Key" />
          <CardBody>
            <Field label="Nama">
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="mis. Integrasi App PJP" />
            </Field>
            <Field label="Environment" className="mt-3">
              <Select value={env} onChange={(e) => setEnv(e.target.value)}>
                <option value="sandbox">sandbox</option>
                <option value="production">production</option>
              </Select>
            </Field>
            <div className="mt-3">
              <span className="text-small text-muted">Scopes</span>
              <div className="mt-1 space-y-1">
                {SCOPES.map((s) => (
                  <label key={s} className="flex items-center gap-2 text-body text-ink">
                    <input type="checkbox" checked={scopes.includes(s)} onChange={() => toggleScope(s)} />
                    <code className="font-mono text-small">{s}</code>
                  </label>
                ))}
              </div>
            </div>
            {create.error ? <p className="mt-2 text-small text-danger">{create.error.message}</p> : null}
            <Button className="mt-4 w-full gap-1" onClick={() => create.mutate()} disabled={create.isPending || !name.trim() || scopes.length === 0}>
              <Plus aria-hidden="true" className="h-4 w-4" /> {create.isPending ? 'Membuat…' : 'Buat Key'}
            </Button>
          </CardBody>
        </Card>

        {/* list */}
        <Card className="lg:col-span-2">
          <CardHeader title="API Keys" action={<KeyRound aria-hidden="true" className="h-4 w-4 text-muted" />} />
          {query.isError ? (
            <ErrorState onRetry={() => query.refetch()} />
          ) : query.isPending ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : query.data.length === 0 ? (
            <EmptyState icon={ShieldAlert} title="Belum ada key" description="Buat API key untuk mulai integrasi." />
          ) : (
            <ul className="divide-y divide-line">
              {query.data.map((k) => (
                <li key={k.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-ink">{k.name || '(tanpa nama)'}</span>
                      <Badge tone="neutral">{k.env}</Badge>
                      <Badge tone={k.status === 'active' ? 'success' : 'danger'}>{k.status}</Badge>
                    </div>
                    <code className="block font-mono text-small text-muted">{k.prefix}••••••••</code>
                    <span className="text-micro text-muted">scopes: {k.scopes.join(', ')}</span>
                  </div>
                  {k.status === 'active' ? (
                    <Button variant="secondary" className="h-8 gap-1 px-2 text-small text-danger" onClick={() => revoke.mutate(k.id)}>
                      <Trash2 aria-hidden="true" className="h-3.5 w-3.5" /> Cabut
                    </Button>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {/* SNAP HMAC signing — the real, enforced auth on the ingest path */}
      <Card className="mt-6 border-accent/40">
        <CardHeader title="Tanda tangan SNAP (HMAC)" action={<ShieldCheck aria-hidden="true" className="h-4 w-4 text-accent" />} />
        <CardBody>
          <p className="text-body text-ink">
            Setiap request ke <code className="font-mono">/api/ingest/*</code> wajib ditandatangani.
            Gateway menghitung ulang signature dan menolak body yang diubah, request yang basi (di luar ±5 menit),
            atau signature yang dipakai ulang (<i>replay</i>). Tenant (PJP) ditentukan dari kredensial yang terverifikasi.
          </p>

          <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <span className="text-small text-muted">Header wajib</span>
              <ul className="mt-1 space-y-1 text-small text-ink">
                <li><code className="font-mono">X-CLIENT-KEY</code> — key <code className="font-mono">pgk_…</code> milik PJP</li>
                <li><code className="font-mono">X-TIMESTAMP</code> — ISO-8601 + offset (atau <code className="font-mono">Z</code>)</li>
                <li><code className="font-mono">X-SIGNATURE</code> — Base64(HMAC-SHA512)</li>
              </ul>
              <span className="mt-3 block text-small text-muted">String-to-sign</span>
              <pre className="mt-1 overflow-x-auto rounded-md bg-ink/5 p-2 font-mono text-micro text-ink">{`{METHOD}:{path}:{X-CLIENT-KEY}:
  {lowerHex(SHA-256(body))}:{X-TIMESTAMP}`}</pre>
            </div>
            <div>
              <span className="text-small text-muted">Kredensial sandbox (coba langsung)</span>
              <Secret label="X-CLIENT-KEY" value="pgk_sandbox_DEMOKEY" />
              <Secret label="Client Secret" value="pgs_sandbox_DEMOSECRET" />
              <p className="mt-2 text-micro text-muted">Sandbox · tenant <code className="font-mono">PJP-DEMO</code> · hanya untuk uji coba.</p>
            </div>
          </div>

          <p className="mt-4 text-small text-muted">Quickstart — kirim transaksi bertanda tangan (bash + openssl):</p>
          <pre className="mt-1 overflow-x-auto rounded-md bg-ink/5 p-3 font-mono text-small text-ink">{`KEY=pgk_sandbox_DEMOKEY
SECRET=pgs_sandbox_DEMOSECRET
TS=$(date -u +%Y-%m-%dT%H:%M:%SZ)
BODY='{"externalId":"REF-1","partnerReferenceNo":"REF-1","transactionType":"QRIS_MPM","amount":{"value":"75000.00","currency":"IDR"},"sourceAccountNo":"ACC-1"}'
HASH=$(printf '%s' "$BODY" | openssl dgst -sha256 | sed 's/^.* //')
STS="POST:/api/ingest/mirror:$KEY:$HASH:$TS"
SIG=$(printf '%s' "$STS" | openssl dgst -sha512 -hmac "$SECRET" -binary | base64)
curl -X POST ${API_BASE}/api/ingest/mirror \\
  -H "X-CLIENT-KEY: $KEY" -H "X-TIMESTAMP: $TS" -H "X-SIGNATURE: $SIG" \\
  -H "Content-Type: application/json" -d "$BODY"`}</pre>
          <p className="mt-2 text-micro text-muted">
            Resep mesin: <code className="font-mono">{API_BASE}/api/dev/snap-guide</code>
          </p>
        </CardBody>
      </Card>

      {/* docs + how to connect */}
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Dokumentasi API" action={<BookOpen aria-hidden="true" className="h-4 w-4 text-muted" />} />
          <CardBody>
            <a href={`${API_BASE}/swagger-ui.html`} target="_blank" rel="noreferrer"
               className="inline-flex items-center gap-1 text-accent hover:underline">
              Buka Swagger UI <ExternalLink aria-hidden="true" className="h-3.5 w-3.5" />
            </a>
            <p className="mt-1 text-small text-muted">Spec OpenAPI: <code className="font-mono">{API_BASE}/v3/api-docs</code> (sumber SDK).</p>
            <p className="mt-3 text-small text-muted">Cek kredensial — kirim key sebagai <code className="font-mono">X-API-Key</code>:</p>
            <pre className="mt-1 overflow-x-auto rounded-md bg-ink/5 p-3 font-mono text-small text-ink">{`curl ${API_BASE}/api/dev/ping \\
  -H "X-API-Key: <API_KEY_ANDA>"`}</pre>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Cara terhubung" />
          <CardBody>
            <ol className="list-decimal space-y-2 pl-5 text-body text-ink">
              <li>Buat API key (sandbox) di atas, simpan key + secret.</li>
              <li>Pilih jalur integrasi:
                <ul className="mt-1 list-disc pl-5 text-small text-muted">
                  <li><b>Mirror webhook</b> — forward salinan transaksi ke <code className="font-mono">/api/ingest/mirror</code>, ditandatangani dengan SNAP HMAC (lihat di atas).</li>
                  <li><b>Panggil API kita</b> (SNAP-compliant) dengan signature yang sama (+ mTLS untuk produksi).</li>
                </ul>
              </li>
              <li>Uji di sandbox (data sintetis), lalu minta key production.</li>
            </ol>
            <p className="mt-3 text-small text-muted">Detail: docs/developer-integration-plan.</p>
          </CardBody>
        </Card>
      </div>
    </>
  )
}

function Secret({ label, value }: { label: string; value: string }) {
  return (
    <div className="mt-2">
      <span className="text-small text-muted">{label}</span>
      <div className="flex items-center gap-2">
        <code className="flex-1 overflow-x-auto rounded-md bg-ink/5 px-3 py-2 font-mono text-small text-ink">{value}</code>
        <Button variant="secondary" className="h-9 gap-1 px-2 text-small" onClick={() => navigator.clipboard?.writeText(value)}>
          <Copy aria-hidden="true" className="h-3.5 w-3.5" /> Salin
        </Button>
      </div>
    </div>
  )
}

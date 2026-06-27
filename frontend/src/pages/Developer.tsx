import { useState } from 'react'
import { KeyRound, Plus, Copy, Trash2, ExternalLink, BookOpen, ShieldAlert } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { PageHeader } from '../components/PageHeader'
import { Card, CardBody, CardHeader } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Badge } from '../components/ui/Badge'
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

  const inputCls = 'w-full rounded-md border border-line bg-surface px-3 py-2 text-body text-ink'

  return (
    <>
      <PageHeader
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
            <label className="block">
              <span className="text-small text-muted">Nama</span>
              <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="mis. Integrasi App PJP" />
            </label>
            <label className="mt-3 block">
              <span className="text-small text-muted">Environment</span>
              <select className={inputCls} value={env} onChange={(e) => setEnv(e.target.value)}>
                <option value="sandbox">sandbox</option>
                <option value="production">production</option>
              </select>
            </label>
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
            <p className="mt-3 text-small text-muted">Quickstart — kirim transaksi (mirror):</p>
            <pre className="mt-1 overflow-x-auto rounded-md bg-ink/5 p-3 font-mono text-small text-ink">{`curl -X POST ${API_BASE}/api/ingest/mirror \\
  -H "X-API-Key: <API_KEY_ANDA>" \\
  -H "Content-Type: application/json" \\
  -d '{"externalId":"REF-1","partnerReferenceNo":"REF-1",
       "transactionType":"QRIS_MPM",
       "amount":{"value":"75000.00","currency":"IDR"},
       "sourceAccountNo":"ACC-1"}'`}</pre>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Cara terhubung" />
          <CardBody>
            <ol className="list-decimal space-y-2 pl-5 text-body text-ink">
              <li>Buat API key (sandbox) di atas, simpan key + secret.</li>
              <li>Pilih jalur integrasi:
                <ul className="mt-1 list-disc pl-5 text-small text-muted">
                  <li><b>Panggil API kita</b> (SNAP-compliant) dengan header <code className="font-mono">X-API-Key</code> (+ HMAC signing & mTLS untuk produksi).</li>
                  <li><b>Mirror webhook</b> — forward salinan transaksi ke <code className="font-mono">/api/ingest/mirror</code>.</li>
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

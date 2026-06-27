import { useState } from 'react'
import { Plus, Trash2, Pencil, Power, ShieldAlert, Ban } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { PageHeader } from '../components/PageHeader'
import { Card, CardBody, CardHeader } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Badge } from '../components/ui/Badge'
import { Input, Field } from '../components/ui/Input'
import { Skeleton } from '../components/ui/Skeleton'
import { EmptyState, ErrorState } from '../components/StateViews'
import {
  fetchRules, createRule, updateRule, deleteRule,
  fetchWatchlist, addWatchlist, removeWatchlist,
} from '../lib/api'
import type { FdsRule } from '../data/types'

const FEATURES = [
  '#amountMinor', '#amountRupiah', '#velocity10s', '#velocity1m', '#velocity10m',
  '#velocity1h', '#velocity24h', '#subThreshold24h', '#aggregate24hMinor',
  '#amountZScore', '#newCounterparty', '#fanOut24h', '#offHours', '#roundAmount',
  '#hourOfDayWib', '#channel', '#account',
]

type Draft = { name: string; report: string; score: number; expression: string }
const EMPTY: Draft = { name: '', report: '', score: 70, expression: '' }

export default function Rules() {
  const qc = useQueryClient()
  const query = useQuery<FdsRule[], Error>({ queryKey: ['rules'], queryFn: fetchRules })
  const [creating, setCreating] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['rules'] })
    qc.invalidateQueries({ queryKey: ['alerts'] })
  }

  const create = useMutation({
    mutationFn: (d: Draft) => createRule(d),
    onSuccess: () => { setCreating(false); invalidate() },
  })
  const update = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<FdsRule> }) => updateRule(id, patch),
    onSuccess: () => { setEditingId(null); invalidate() },
  })
  const remove = useMutation({
    mutationFn: (id: string) => deleteRule(id),
    onSuccess: invalidate,
  })

  return (
    <>
      <PageHeader
        title="FDS — Rules"
        subtitle="Aturan deteksi fraud/AML — formula dinamis (tambah, edit, hapus, aktif/nonaktif)"
        right={
          <Button onClick={() => { setCreating((c) => !c); setEditingId(null) }} className="gap-1">
            <Plus aria-hidden="true" className="h-4 w-4" /> Tambah Rule
          </Button>
        }
      />

      {creating ? (
        <Card className="mb-6">
          <CardHeader title="Rule baru" />
          <CardBody>
            <RuleForm
              initial={EMPTY}
              pending={create.isPending}
              error={create.error?.message ?? null}
              onCancel={() => setCreating(false)}
              onSubmit={(d) => create.mutate(d)}
            />
          </CardBody>
        </Card>
      ) : null}

      {query.isError ? (
        <Card><ErrorState onRetry={() => query.refetch()} /></Card>
      ) : query.isPending ? (
        <div className="space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}><div className="p-4"><Skeleton className="h-5 w-64" /><Skeleton className="mt-2 h-4 w-96" /></div></Card>
          ))}
        </div>
      ) : query.data.length === 0 ? (
        <Card>
          <EmptyState icon={ShieldAlert} title="Belum ada rule" description="Tambah rule pertama untuk mulai mendeteksi." />
        </Card>
      ) : (
        <div className="space-y-4">
          {query.data.map((r) =>
            editingId === r.id ? (
              <Card key={r.id} className="border-accent">
                <CardHeader title={`Edit: ${r.id}`} />
                <CardBody>
                  <RuleForm
                    initial={{ name: r.name, report: r.report, score: r.score, expression: r.expression }}
                    pending={update.isPending}
                    error={update.error?.message ?? null}
                    onCancel={() => setEditingId(null)}
                    onSubmit={(d) => update.mutate({ id: r.id, patch: d })}
                  />
                </CardBody>
              </Card>
            ) : (
              <RuleRow
                key={r.id}
                rule={r}
                onToggle={() => update.mutate({ id: r.id, patch: { enabled: !r.enabled } })}
                onEdit={() => { setEditingId(r.id); setCreating(false) }}
                onDelete={() => {
                  if (confirm(`Hapus rule "${r.name}"?`)) remove.mutate(r.id)
                }}
              />
            ),
          )}
        </div>
      )}

      <WatchlistCard />
    </>
  )
}

function WatchlistCard() {
  const qc = useQueryClient()
  const query = useQuery<string[], Error>({ queryKey: ['watchlist'], queryFn: fetchWatchlist })
  const [account, setAccount] = useState('')
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['watchlist'] })
    qc.invalidateQueries({ queryKey: ['alerts'] })
  }
  const add = useMutation({
    mutationFn: (a: string) => addWatchlist(a),
    onSuccess: () => { setAccount(''); invalidate() },
  })
  const remove = useMutation({ mutationFn: (a: string) => removeWatchlist(a), onSuccess: invalidate })

  return (
    <Card className="mt-6">
      <CardHeader
        title="Daftar Pantau (Watchlist)"
        action={<Ban aria-hidden="true" className="h-4 w-4 text-muted" />}
      />
      <CardBody>
        <p className="mb-3 text-small text-muted">
          Akun yang diblokir (mule, pihak tersanksi, DTTOT). Transaksi dari/ke akun ini langsung
          mendapat sinyal risiko tertinggi. Bisa ditambah/dihapus runtime — tanpa <i>redeploy</i>.
        </p>
        <form
          className="mb-4 flex gap-2"
          onSubmit={(e) => { e.preventDefault(); if (account.trim()) add.mutate(account.trim()) }}
        >
          <Input
            value={account}
            onChange={(e) => setAccount(e.target.value)}
            placeholder="mis. ACC-1234 atau nomor rekening"
          />
          <Button type="submit" className="gap-1 whitespace-nowrap" disabled={add.isPending || !account.trim()}>
            <Plus aria-hidden="true" className="h-4 w-4" /> Tambah
          </Button>
        </form>
        {add.error ? <p className="mb-2 text-small text-danger">{add.error.message}</p> : null}

        {query.isError ? (
          <ErrorState onRetry={() => query.refetch()} />
        ) : query.isPending ? (
          <div className="space-y-2">
            {Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-9 w-full" />)}
          </div>
        ) : query.data.length === 0 ? (
          <EmptyState icon={Ban} title="Daftar pantau kosong" description="Belum ada akun yang diblokir." />
        ) : (
          <ul className="divide-y divide-line">
            {query.data.map((acc) => (
              <li key={acc} className="flex items-center justify-between gap-2 py-2">
                <code className="font-mono text-body text-ink">{acc}</code>
                <Button
                  variant="secondary"
                  className="h-8 gap-1 px-2 text-small text-danger"
                  disabled={remove.isPending}
                  onClick={() => { if (confirm(`Hapus ${acc} dari daftar pantau?`)) remove.mutate(acc) }}
                >
                  <Trash2 aria-hidden="true" className="h-3.5 w-3.5" /> Hapus
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  )
}

function RuleRow({
  rule,
  onToggle,
  onEdit,
  onDelete,
}: {
  rule: FdsRule
  onToggle: () => void
  onEdit: () => void
  onDelete: () => void
}) {
  return (
    <Card className={rule.enabled ? '' : 'opacity-60'}>
      <div className="flex flex-wrap items-start justify-between gap-3 p-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-h2 font-semibold text-ink">{rule.name}</span>
            {rule.report ? <Badge tone="neutral">{rule.report}</Badge> : null}
            <span className="text-small text-muted">skor {rule.score}</span>
          </div>
          <code className="mt-1 block font-mono text-small text-muted">{rule.expression}</code>
          <span className="text-micro uppercase tracking-wide text-muted">id: {rule.id}</span>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={onToggle}
            className={
              'inline-flex h-8 items-center gap-1 rounded-md border px-2 text-small font-semibold ' +
              (rule.enabled
                ? 'border-success/30 bg-success-bg text-success'
                : 'border-line bg-surface text-muted')
            }
          >
            <Power aria-hidden="true" className="h-3.5 w-3.5" />
            {rule.enabled ? 'Aktif' : 'Nonaktif'}
          </button>
          <Button variant="secondary" className="h-8 gap-1 px-2 text-small" onClick={onEdit}>
            <Pencil aria-hidden="true" className="h-3.5 w-3.5" /> Edit
          </Button>
          <Button variant="secondary" className="h-8 gap-1 px-2 text-small text-danger" onClick={onDelete}>
            <Trash2 aria-hidden="true" className="h-3.5 w-3.5" /> Hapus
          </Button>
        </div>
      </div>
    </Card>
  )
}

function RuleForm({
  initial,
  pending,
  error,
  onCancel,
  onSubmit,
}: {
  initial: Draft
  pending: boolean
  error: string | null
  onCancel: () => void
  onSubmit: (d: Draft) => void
}) {
  const [d, setD] = useState<Draft>(initial)

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Field label="Nama" className="sm:col-span-2">
          <Input value={d.name} onChange={(e) => setD({ ...d, name: e.target.value })} placeholder="mis. QRIS besar tak wajar" />
        </Field>
        <Field label="Tag (opsional)">
          <Input value={d.report} onChange={(e) => setD({ ...d, report: e.target.value })} placeholder="mis. LTKM, mule, velocity" />
        </Field>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <Field label="Skor (0–100)">
          <Input type="number" min={0} max={100} value={d.score} onChange={(e) => setD({ ...d, score: Number(e.target.value) })} />
        </Field>
        <Field label="Formula (SpEL)" className="sm:col-span-3">
          <Input className="font-mono" value={d.expression} onChange={(e) => setD({ ...d, expression: e.target.value })} placeholder="#amountMinor >= 50000000000L" />
        </Field>
      </div>
      <div>
        <span className="mb-1.5 block text-small font-medium text-muted">Fitur tersedia (klik untuk menyisipkan)</span>
        <div className="flex flex-wrap gap-1.5">
          {FEATURES.map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setD((cur) => ({ ...cur, expression: (cur.expression + (cur.expression && !cur.expression.endsWith(' ') ? ' ' : '') + f) }))}
              className="rounded-md border border-line bg-bg px-2 py-1 font-mono text-micro text-muted transition-colors hover:border-accent hover:text-accent"
            >
              {f}
            </button>
          ))}
        </div>
      </div>
      {error ? <p className="text-small text-danger">{error}</p> : null}
      <div className="flex gap-2">
        <Button onClick={() => onSubmit(d)} disabled={pending || !d.name.trim() || !d.expression.trim()}>
          {pending ? 'Menyimpan…' : 'Simpan'}
        </Button>
        <Button variant="secondary" onClick={onCancel} disabled={pending}>Batal</Button>
      </div>
    </div>
  )
}

import { useMemo, useState } from 'react'
import { ListChecks, Ban, AlertTriangle, ShieldCheck, Plus, Trash2 } from 'lucide-react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { PageHeader } from '../components/PageHeader'
import { Card, CardBody } from '../components/ui/Card'
import { StatCard } from '../components/ui/StatCard'
import { Button } from '../components/ui/Button'
import { Badge } from '../components/ui/Badge'
import { Skeleton } from '../components/ui/Skeleton'
import { ErrorState } from '../components/StateViews'
import { useToast } from '../components/ui/Toast'
import { fetchLists, addListEntry, removeListEntry, type FdsListEntry, type ListAction, type ListEntityType } from '../lib/api'

const ACTIONS: { key: ListAction; label: string; tone: 'danger' | 'warning' | 'success'; icon: typeof Ban; hint: string }[] = [
  { key: 'BLOCK', label: 'Blocklist', tone: 'danger', icon: Ban, hint: 'mule / sanksi / DTTOT — sinyal kuat (95)' },
  { key: 'WARNING', label: 'Warning list', tone: 'warning', icon: AlertTriangle, hint: 'pemantauan — sinyal sedang (55)' },
  { key: 'ALLOW', label: 'Allowlist', tone: 'success', icon: ShieldCheck, hint: 'tepercaya — tekan noise (tak nyetak skor)' },
]
const ENTITY_TYPES: ListEntityType[] = ['ACCOUNT', 'BIN', 'DEVICE', 'IP', 'COUNTRY']
const ENTITY_LABEL: Record<ListEntityType, string> = { ACCOUNT: 'Akun', BIN: 'BIN kartu', DEVICE: 'Device', IP: 'Alamat IP', COUNTRY: 'Negara' }
const ACTION_TONE: Record<ListAction, 'danger' | 'warning' | 'success'> = { BLOCK: 'danger', WARNING: 'warning', ALLOW: 'success' }

export default function FdsLists() {
  const qc = useQueryClient()
  const toast = useToast()
  const q = useQuery<FdsListEntry[], Error>({ queryKey: ['fds-lists'], queryFn: fetchLists })
  const [tab, setTab] = useState<ListAction>('BLOCK')
  const [form, setForm] = useState<{ entityType: ListEntityType; value: string; reason: string }>({ entityType: 'ACCOUNT', value: '', reason: '' })
  const [busy, setBusy] = useState(false)

  const entries = q.data ?? []
  const counts = useMemo(() => ({
    BLOCK: entries.filter((e) => e.action === 'BLOCK').length,
    WARNING: entries.filter((e) => e.action === 'WARNING').length,
    ALLOW: entries.filter((e) => e.action === 'ALLOW').length,
  }), [entries])
  const shown = entries.filter((e) => e.action === tab)

  async function onAdd() {
    if (!form.value.trim()) { toast({ title: 'Nilai wajib diisi', tone: 'error' }); return }
    setBusy(true)
    try {
      await addListEntry({ action: tab, entityType: form.entityType, value: form.value.trim(), reason: form.reason.trim() })
      setForm({ ...form, value: '', reason: '' })
      await qc.invalidateQueries({ queryKey: ['fds-lists'] })
      toast({ title: 'Entri ditambahkan', description: `${form.entityType} ${form.value} → ${tab}`, tone: 'success' })
    } catch (e) { toast({ title: 'Gagal menambah', description: (e as Error).message, tone: 'error' }) }
    finally { setBusy(false) }
  }

  async function onRemove(en: FdsListEntry) {
    try {
      await removeListEntry(en.id)
      await qc.invalidateQueries({ queryKey: ['fds-lists'] })
      toast({ title: 'Entri dihapus', tone: 'info' })
    } catch (e) { toast({ title: 'Gagal menghapus', description: (e as Error).message, tone: 'error' }) }
  }

  return (
    <>
      <PageHeader icon={ListChecks} title="FDS — Daftar (Lists)"
        subtitle="Blocklist · warning list · allowlist — per akun, BIN, device, IP, negara. Dipakai engine saat scoring." />

      {q.isError ? (
        <Card><ErrorState onRetry={() => q.refetch()} /></Card>
      ) : q.isPending ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">{Array.from({ length: 3 }).map((_, i) => <Card key={i} className="p-5"><Skeleton className="h-20 w-full" /></Card>)}</div>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {ACTIONS.map((a) => (
              <StatCard key={a.key} label={a.label} value={String(counts[a.key])} sub={a.hint}
                subTone={a.tone === 'danger' ? 'danger' : a.tone === 'warning' ? 'warning' : 'success'} icon={a.icon} />
            ))}
          </div>

          {/* Tabs */}
          <div className="flex flex-wrap gap-1 border-b border-line">
            {ACTIONS.map((a) => (
              <button key={a.key} type="button" onClick={() => setTab(a.key)}
                className={`-mb-px flex items-center gap-2 border-b-2 px-4 py-2.5 text-body font-semibold transition-colors ${tab === a.key ? 'border-primary text-primary' : 'border-transparent text-muted hover:text-ink'}`}>
                <a.icon className="h-4 w-4" />{a.label}<span className="tnum text-small text-muted">({counts[a.key]})</span>
              </button>
            ))}
          </div>

          {/* Add form */}
          <Card>
            <CardBody>
              <div className="flex flex-wrap items-end gap-3">
                <Field label="Tipe entitas">
                  <select value={form.entityType} onChange={(e) => setForm({ ...form, entityType: e.target.value as ListEntityType })}
                    className="h-9 rounded-md border border-line bg-surface px-2.5 text-body text-ink focus:border-primary focus:outline-none">
                    {ENTITY_TYPES.map((t) => <option key={t} value={t}>{ENTITY_LABEL[t]}</option>)}
                  </select>
                </Field>
                <Field label="Nilai" grow>
                  <input value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })}
                    onKeyDown={(e) => e.key === 'Enter' && onAdd()} placeholder={form.entityType === 'COUNTRY' ? 'mis. KP' : form.entityType === 'IP' ? 'mis. 203.0.113.4' : 'mis. ACC-mule-001'}
                    className="h-9 w-full rounded-md border border-line bg-surface px-3 text-body text-ink focus:border-primary focus:outline-none" />
                </Field>
                <Field label="Alasan (audit)" grow>
                  <input value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })}
                    onKeyDown={(e) => e.key === 'Enter' && onAdd()} placeholder="mis. laporan PPATK / structuring"
                    className="h-9 w-full rounded-md border border-line bg-surface px-3 text-body text-ink focus:border-primary focus:outline-none" />
                </Field>
                <Button variant="primary" onClick={onAdd} disabled={busy}><Plus className="mr-1.5 h-4 w-4" />Tambah ke {ACTIONS.find((a) => a.key === tab)!.label}</Button>
              </div>
            </CardBody>
          </Card>

          {/* Table */}
          <Card>
            <CardBody>
              {shown.length === 0 ? (
                <p className="py-8 text-center text-small text-muted">Belum ada entri di {ACTIONS.find((a) => a.key === tab)!.label}.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-body">
                    <thead>
                      <tr className="border-b border-line text-left text-micro uppercase tracking-wide text-muted">
                        <th className="py-2 pr-4 font-semibold">Tipe</th>
                        <th className="py-2 pr-4 font-semibold">Nilai</th>
                        <th className="py-2 pr-4 font-semibold">Alasan</th>
                        <th className="py-2 pr-4 font-semibold text-right">Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {shown.map((e) => (
                        <tr key={e.id} className="border-b border-line/60">
                          <td className="py-2.5 pr-4"><Badge tone="neutral">{ENTITY_LABEL[e.entityType]}</Badge></td>
                          <td className="py-2.5 pr-4 font-mono text-small font-semibold text-ink">{e.value}</td>
                          <td className="py-2.5 pr-4 text-small text-muted">{e.reason || '—'}</td>
                          <td className="py-2.5 pr-4 text-right">
                            <button type="button" onClick={() => onRemove(e)} aria-label="Hapus"
                              className="inline-grid h-8 w-8 place-items-center rounded-md text-muted hover:bg-danger/10 hover:text-danger">
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardBody>
          </Card>

          <p className="text-small text-muted">
            <Badge tone={ACTION_TONE[tab]} className="mr-1">{tab}</Badge>
            {tab === 'BLOCK' ? 'Cocok di salah satu sisi transaksi → sinyal watchlist 95 (hampir pasti reportable).'
              : tab === 'WARNING' ? 'Cocok → sinyal watchlist 55, naik ke pemantauan tanpa langsung blokir.'
              : 'Akun tepercaya — sengaja tidak menaikkan skor agar analis tidak kebanjiran noise.'}
          </p>
        </div>
      )}
    </>
  )
}

function Field({ label, children, grow }: { label: string; children: React.ReactNode; grow?: boolean }) {
  return (
    <label className={`flex flex-col gap-1 ${grow ? 'min-w-[180px] flex-1' : ''}`}>
      <span className="text-micro font-semibold uppercase tracking-wide text-muted">{label}</span>
      {children}
    </label>
  )
}

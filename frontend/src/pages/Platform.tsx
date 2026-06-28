import { useState } from 'react'
import { Building2, UserPlus, Plus, LogIn, ShieldCheck } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { PageHeader } from '../components/PageHeader'
import { Card, CardBody, CardHeader } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Badge } from '../components/ui/Badge'
import { Input, Field } from '../components/ui/Input'
import { Select } from '../components/ui/Select'
import { Skeleton } from '../components/ui/Skeleton'
import { EmptyState, ErrorState } from '../components/StateViews'
import { Table, TBody, THead, TH, TR, TD } from '../components/ui/Table'
import { useToast } from '../components/ui/Toast'
import { useAuth } from '../lib/auth'
import {
  fetchAdminTenants, registerTenant, setTenantStatus,
  fetchAdminUsers, createAdminUser, impersonateTenant,
  type AdminTenant, type AdminUser,
} from '../lib/api'

export default function Platform() {
  const qc = useQueryClient()
  const toast = useToast()
  const { impersonate } = useAuth()
  const tenants = useQuery<AdminTenant[], Error>({ queryKey: ['admin-tenants'], queryFn: fetchAdminTenants })
  const users = useQuery<AdminUser[], Error>({ queryKey: ['admin-users'], queryFn: fetchAdminUsers })

  const [tId, setTId] = useState('')
  const [tName, setTName] = useState('')
  const [tEnv, setTEnv] = useState('sandbox')
  const [uName, setUName] = useState('')
  const [uPass, setUPass] = useState('')
  const [uDisplay, setUDisplay] = useState('')
  const [uRole, setURole] = useState('PJP')
  const [uTenant, setUTenant] = useState('')

  const regTenant = useMutation({
    mutationFn: () => registerTenant({ id: tId, name: tName, env: tEnv }),
    onSuccess: (t) => {
      toast({ tone: 'success', title: 'Tenant di-onboard', description: `${t.id} — ${t.name}` })
      setTId(''); setTName('')
      qc.invalidateQueries({ queryKey: ['admin-tenants'] }); qc.invalidateQueries({ queryKey: ['tenants'] })
    },
    onError: (e) => toast({ tone: 'error', title: 'Gagal', description: e.message }),
  })
  const toggleStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => setTenantStatus(id, status),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-tenants'] }),
  })
  const addUser = useMutation({
    mutationFn: () => createAdminUser({ username: uName, password: uPass, displayName: uDisplay, role: uRole, tenant: uRole === 'PJP' ? uTenant : null }),
    onSuccess: (u) => {
      toast({ tone: 'success', title: 'User dibuat', description: `${u.username} · ${u.role}` })
      setUName(''); setUPass(''); setUDisplay('')
      qc.invalidateQueries({ queryKey: ['admin-users'] })
    },
    onError: (e) => toast({ tone: 'error', title: 'Gagal', description: e.message }),
  })
  const loginAs = useMutation({
    mutationFn: (tenantId: string) => impersonateTenant(tenantId),
    onSuccess: (res) => {
      impersonate(res.token, { ...res.user })
      toast({ tone: 'info', title: 'Masuk sebagai tenant', description: res.user.tenantId ?? '' })
    },
    onError: (e) => toast({ tone: 'error', title: 'Gagal impersonate', description: e.message }),
  })

  const inputReady = tId.trim().length > 0
  const userReady = uName.trim() && uPass.length >= 4 && (uRole !== 'PJP' || uTenant)

  return (
    <>
      <PageHeader icon={ShieldCheck} title="Platform Administration"
        subtitle="Super-admin — onboarding tenant, kelola user, dan login-as untuk support" />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        {/* Tenants */}
        <Card>
          <CardHeader title="Tenant (PJP)" action={<Building2 aria-hidden="true" className="h-4 w-4 text-muted" />} />
          <CardBody>
            <form className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-4" onSubmit={(e) => { e.preventDefault(); if (inputReady) regTenant.mutate() }}>
              <Field label="ID tenant" className="sm:col-span-1"><Input value={tId} onChange={(e) => setTId(e.target.value)} placeholder="PJP-XXX" /></Field>
              <Field label="Nama PJP" className="sm:col-span-2"><Input value={tName} onChange={(e) => setTName(e.target.value)} placeholder="PT Contoh" /></Field>
              <Field label="Env"><Select value={tEnv} onChange={(e) => setTEnv(e.target.value)}><option value="sandbox">sandbox</option><option value="production">production</option></Select></Field>
              <div className="sm:col-span-4">
                <Button type="submit" className="gap-1" disabled={!inputReady || regTenant.isPending}>
                  <Plus aria-hidden="true" className="h-4 w-4" /> Onboard tenant
                </Button>
              </div>
            </form>
            {tenants.isError ? <ErrorState onRetry={() => tenants.refetch()} />
              : tenants.isPending ? <div className="space-y-2">{Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
              : (
                <Table>
                  <THead><TR><TH>Tenant</TH><TH>Env</TH><TH>Status</TH><TH></TH></TR></THead>
                  <TBody>
                    {tenants.data.map((t) => (
                      <TR key={t.id}>
                        <TD><span className="block font-semibold text-ink">{t.name}</span><span className="font-mono text-micro text-muted">{t.id}</span></TD>
                        <TD><Badge tone="neutral">{t.env}</Badge></TD>
                        <TD><Badge tone={t.status === 'active' ? 'success' : 'danger'}>{t.status}</Badge></TD>
                        <TD align="right">
                          <div className="flex justify-end gap-1.5">
                            <Button variant="secondary" className="h-8 gap-1 px-2 text-small" disabled={loginAs.isPending} onClick={() => loginAs.mutate(t.id)}>
                              <LogIn aria-hidden="true" className="h-3.5 w-3.5" /> Masuk sebagai
                            </Button>
                            <Button variant="secondary" className="h-8 px-2 text-small" onClick={() => toggleStatus.mutate({ id: t.id, status: t.status === 'active' ? 'suspended' : 'active' })}>
                              {t.status === 'active' ? 'Suspend' : 'Aktifkan'}
                            </Button>
                          </div>
                        </TD>
                      </TR>
                    ))}
                  </TBody>
                </Table>
              )}
          </CardBody>
        </Card>

        {/* Users */}
        <Card>
          <CardHeader title="User" action={<UserPlus aria-hidden="true" className="h-4 w-4 text-muted" />} />
          <CardBody>
            <form className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); if (userReady) addUser.mutate() }}>
              <Field label="Username"><Input value={uName} onChange={(e) => setUName(e.target.value)} placeholder="username" /></Field>
              <Field label="Password"><Input type="password" value={uPass} onChange={(e) => setUPass(e.target.value)} placeholder="min 4 karakter" /></Field>
              <Field label="Nama"><Input value={uDisplay} onChange={(e) => setUDisplay(e.target.value)} placeholder="Nama lengkap" /></Field>
              <Field label="Peran"><Select value={uRole} onChange={(e) => setURole(e.target.value)}><option value="PJP">PJP (operator tenant)</option><option value="ANALYST">Analis Fraud</option><option value="ADMIN">Platform Admin</option></Select></Field>
              {uRole === 'PJP' ? (
                <Field label="Tenant" className="sm:col-span-2">
                  <Select value={uTenant} onChange={(e) => setUTenant(e.target.value)}>
                    <option value="">— pilih tenant —</option>
                    {(tenants.data ?? []).map((t) => <option key={t.id} value={t.id}>{t.id} — {t.name}</option>)}
                  </Select>
                </Field>
              ) : null}
              <div className="sm:col-span-2">
                <Button type="submit" className="gap-1" disabled={!userReady || addUser.isPending}>
                  <UserPlus aria-hidden="true" className="h-4 w-4" /> Buat user
                </Button>
              </div>
            </form>
            {users.isError ? <ErrorState onRetry={() => users.refetch()} />
              : users.isPending ? <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
              : users.data.length === 0 ? <EmptyState icon={UserPlus} title="Belum ada user" description="" />
              : (
                <Table>
                  <THead><TR><TH>User</TH><TH>Peran</TH><TH>Tenant</TH></TR></THead>
                  <TBody>
                    {users.data.map((u) => (
                      <TR key={u.username}>
                        <TD><span className="block text-ink">{u.displayName}</span><span className="font-mono text-micro text-muted">{u.username}</span></TD>
                        <TD><Badge tone="neutral">{u.role}</Badge></TD>
                        <TD className="font-mono text-small text-muted">{u.tenantId ?? '— semua —'}</TD>
                      </TR>
                    ))}
                  </TBody>
                </Table>
              )}
          </CardBody>
        </Card>
      </div>
    </>
  )
}

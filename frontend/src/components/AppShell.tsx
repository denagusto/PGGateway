import { useState, type ReactNode } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import {
  ChevronDown, ShieldCheck, LogOut, ShieldAlert, SlidersHorizontal, Building2, Menu, BarChart3, Layers,
  BrainCircuit, ListChecks, FlaskConical, UserSearch, Sparkles, KeyRound, Wand2, Activity,
  GitCompareArrows, AlertTriangle, HeartPulse, Gauge, PanelLeftClose, type LucideIcon,
} from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { cn } from '../lib/cn'
import { useTenant } from '../lib/tenant'
import { useAuth } from '../lib/auth'
import { fetchTenants } from '../lib/api'

const ROLE_LABEL: Record<string, string> = { ADMIN: 'Platform Admin', PJP: 'Operator PJP', ANALYST: 'Analis Fraud' }

interface SubItem { to: string; label: string; icon: LucideIcon; end?: boolean; fraud?: boolean }
interface Module { label: string; base: string; to?: string; admin?: boolean; sub?: SubItem[] }

const MODULES: Module[] = [
  { label: 'Dashboard', base: '/', to: '/' },
  { label: 'Transaksi', base: '/transaksi', to: '/transaksi' },
  { label: 'Buku Besar', base: '/buku-besar', to: '/buku-besar' },
  {
    label: 'FDS', base: '/fds',
    sub: [
      { to: '/fds', label: 'Antrian Alert', icon: ShieldAlert, end: true },
      { to: '/fds/analytics', label: 'Analitik', icon: BarChart3, fraud: true },
      { to: '/fds/detectors', label: 'Detektor & Scoring', icon: Layers, fraud: true },
      { to: '/fds/model', label: 'Model & ML', icon: BrainCircuit, fraud: true },
      { to: '/fds/lists', label: 'Daftar (Lists)', icon: ListChecks, fraud: true },
      { to: '/fds/simulation', label: 'Simulasi', icon: FlaskConical, fraud: true },
      { to: '/fds/investigation', label: 'Investigasi', icon: UserSearch, fraud: true },
      { to: '/fds/copilot', label: 'Copilot & Tipologi', icon: Sparkles, fraud: true },
      { to: '/fds/rules', label: 'Rules & Daftar Pantau', icon: SlidersHorizontal, fraud: true },
    ],
  },
  {
    label: 'Rekonsiliasi', base: '/rekonsiliasi',
    sub: [
      { to: '/rekonsiliasi', label: 'Runs & Ringkasan', icon: GitCompareArrows, end: true },
      { to: '/rekonsiliasi/exceptions', label: 'Exceptions', icon: AlertTriangle },
    ],
  },
  {
    label: 'Monitoring', base: '/monitoring',
    sub: [
      { to: '/monitoring', label: 'Health', icon: HeartPulse, end: true },
      { to: '/monitoring/throughput', label: 'Throughput', icon: Gauge },
    ],
  },
  {
    label: 'Developer', base: '/developer',
    sub: [
      { to: '/developer', label: 'Ringkasan & API Keys', icon: KeyRound, end: true },
      { to: '/developer/sandbox', label: 'Sandbox', icon: FlaskConical },
      { to: '/developer/playground', label: 'Signature Playground', icon: Wand2 },
      { to: '/developer/logs', label: 'Integration Monitor', icon: Activity },
    ],
  },
  { label: 'Audit', base: '/audit', to: '/audit' },
  { label: 'Platform', base: '/platform', admin: true, sub: [{ to: '/platform', label: 'Tenant & User', icon: Building2 }] },
]

function activeModule(path: string): Module | undefined {
  let best: Module | undefined
  for (const m of MODULES) {
    if (m.base === '/') { if (path === '/') best = best && best.base.length > 1 ? best : m; continue }
    if (path === m.base || path.startsWith(m.base + '/')) {
      if (!best || m.base.length > best.base.length) best = m
    }
  }
  return best
}

function TopBar({ active, onToggle, hasSide }: { active?: Module; onToggle: () => void; hasSide: boolean }) {
  const { user } = useAuth()
  const isFraudTeam = user?.role === 'ADMIN' || user?.role === 'ANALYST'
  const canSeeSub = (s: SubItem) => !s.fraud || isFraudTeam
  const modules = MODULES.filter((m) => !m.admin || user?.role === 'ADMIN')
  const target = (m: Module) => m.to ?? (m.sub?.filter(canSeeSub)[0]?.to ?? m.base)

  return (
    <header className="fixed inset-x-0 top-0 z-40 flex h-14 items-center gap-2 bg-gradient-to-r from-primary-900 via-primary-700 to-primary px-4 text-white shadow-[0_1px_3px_rgba(16,24,40,0.18)]">
      {hasSide ? (
        <button type="button" onClick={onToggle} aria-label="Buka/tutup menu"
          className="grid h-9 w-9 shrink-0 place-items-center rounded-md text-white/80 hover:bg-white/10 hover:text-white">
          <Menu aria-hidden="true" className="h-5 w-5" />
        </button>
      ) : null}
      <div className="mr-2 flex items-center gap-2 font-bold">
        <div className="grid h-7 w-7 place-items-center rounded-lg bg-white/12 ring-1 ring-inset ring-white/15">
          <ShieldCheck aria-hidden="true" className="h-4 w-4 text-white" />
        </div>
        <span className="text-h2 tracking-tight">PGGateway</span>
      </div>
      <nav className="flex items-center gap-0.5" aria-label="Modul">
        {modules.map((m) => (
          <NavLink key={m.base} to={target(m)} end={m.base === '/'}
            className={cn('rounded-md px-3 py-1.5 text-body font-semibold transition-colors',
              active?.base === m.base ? 'bg-white/15 text-white shadow-inner' : 'text-white/65 hover:bg-white/8 hover:text-white')}>
            {m.label}
          </NavLink>
        ))}
      </nav>
      <div className="ml-auto flex items-center gap-3">
        <TenantSelect />
        <UserMenu />
      </div>
    </header>
  )
}

function SideNav({ module, onClose }: { module: Module; onClose: () => void }) {
  const { user } = useAuth()
  const isFraudTeam = user?.role === 'ADMIN' || user?.role === 'ANALYST'
  const subs = (module.sub ?? []).filter((s) => !s.fraud || isFraudTeam)
  return (
    <aside className="fixed bottom-0 left-0 top-14 z-30 flex w-60 flex-col overflow-y-auto border-r border-line bg-surface">
      <div className="flex items-center justify-between px-4 pb-1 pt-4">
        <span className="text-micro font-semibold uppercase tracking-[0.06em] text-muted">{module.label}</span>
        <button type="button" onClick={onClose} aria-label="Tutup panel" className="text-muted hover:text-ink">
          <PanelLeftClose aria-hidden="true" className="h-4 w-4" />
        </button>
      </div>
      <nav className="space-y-0.5 px-3 py-2" aria-label={`Sub-menu ${module.label}`}>
        {subs.map((s) => (
          <NavLink key={s.to} to={s.to} end={s.end}
            className={({ isActive }) => cn('flex items-center gap-3 rounded-md px-3 py-2 text-body font-medium transition-colors',
              isActive ? 'bg-primary/10 font-semibold text-primary' : 'text-ink/70 hover:bg-bg hover:text-ink')}>
            <s.icon aria-hidden="true" className="h-[18px] w-[18px] shrink-0" />
            <span className="truncate">{s.label}</span>
          </NavLink>
        ))}
      </nav>
    </aside>
  )
}

function TenantSelect() {
  const { tenant, setTenant } = useTenant()
  const { user } = useAuth()
  const { data } = useQuery<string[], Error>({ queryKey: ['tenants'], queryFn: fetchTenants })
  const tenants = data ?? []
  if (user && user.tenantId) {
    return (
      <div className="inline-flex items-center gap-2 rounded-md border border-white/15 bg-white/5 px-3 py-1.5 text-body font-semibold text-[#e8eef6]">
        <span aria-hidden="true" className="h-2 w-2 rounded-full bg-success" />{user.tenantId}
      </div>
    )
  }
  return (
    <div className="relative">
      <span aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-2 w-2 -translate-y-1/2 rounded-full bg-success" />
      <select value={tenant} onChange={(e) => setTenant(e.target.value)} aria-label="Lingkup tenant (PJP)"
        className="appearance-none rounded-md border border-white/15 bg-white/5 py-1.5 pl-7 pr-9 text-body font-semibold text-[#e8eef6] hover:bg-white/10 focus:outline-none">
        <option value="all" className="text-ink">Semua PJP</option>
        {tenants.map((t) => <option key={t} value={t} className="text-ink">{t}</option>)}
      </select>
      <ChevronDown aria-hidden="true" className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 opacity-80" />
    </div>
  )
}

function UserMenu() {
  const { user, logout } = useAuth()
  if (!user) return null
  return (
    <div className="flex items-center gap-2 border-l border-white/15 pl-3">
      <div className="hidden text-right leading-tight sm:block">
        <div className="text-small font-semibold text-white">{user.displayName}</div>
        <div className="text-micro text-white/60">{ROLE_LABEL[user.role] ?? user.role}</div>
      </div>
      <button type="button" onClick={logout} aria-label="Keluar" title="Keluar"
        className="grid h-8 w-8 place-items-center rounded-md text-white/70 hover:bg-white/10 hover:text-white">
        <LogOut aria-hidden="true" className="h-4 w-4" />
      </button>
    </div>
  )
}

export function AppShell({ children }: { children: ReactNode }) {
  const { impersonating, user, stopImpersonate } = useAuth()
  const loc = useLocation()
  const active = activeModule(loc.pathname)
  const isFraudTeam = user?.role === 'ADMIN' || user?.role === 'ANALYST'
  const visibleSubs = (active?.sub ?? []).filter((s) => !s.fraud || isFraudTeam)
  const hasSide = visibleSubs.length > 0
  const [sideOpen, setSideOpen] = useState(true)
  const showSide = hasSide && sideOpen

  return (
    <div className="min-h-screen bg-bg">
      <TopBar active={active} hasSide={hasSide} onToggle={() => setSideOpen((o) => !o)} />
      {showSide ? <SideNav module={active!} onClose={() => setSideOpen(false)} /> : null}
      {impersonating ? (
        <div className={cn('fixed right-0 top-14 z-20 flex items-center justify-center gap-3 bg-warning px-4 py-1.5 text-small font-semibold text-white transition-[left] duration-200', showSide ? 'left-60' : 'left-0')}>
          <span>Mode dukungan — Anda login sebagai tenant {user?.tenantId}</span>
          <button type="button" onClick={stopImpersonate} className="rounded bg-white/20 px-2 py-0.5 hover:bg-white/30">Keluar dari mode ini</button>
        </div>
      ) : null}
      <main className={cn('px-7 pb-12 transition-[margin] duration-200', showSide ? 'ml-60' : 'ml-0', impersonating ? 'pt-[104px]' : 'pt-[76px]')}>{children}</main>
    </div>
  )
}

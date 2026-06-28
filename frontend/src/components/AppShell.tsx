import { useState, type ReactNode } from 'react'
import { NavLink } from 'react-router-dom'
import {
  ChevronDown, ShieldCheck, LogOut, LayoutDashboard, ArrowLeftRight, BookOpen,
  ShieldAlert, SlidersHorizontal, GitCompareArrows, Code2, ScrollText, Building2, Menu, BarChart3,
  type LucideIcon,
} from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { cn } from '../lib/cn'
import { useTenant } from '../lib/tenant'
import { useAuth } from '../lib/auth'
import { fetchTenants } from '../lib/api'

const ROLE_LABEL: Record<string, string> = { ADMIN: 'Platform Admin', PJP: 'Operator PJP', ANALYST: 'Analis Fraud' }

interface NavLeaf { to: string; label: string; icon: LucideIcon; end?: boolean; admin?: boolean; fraud?: boolean }
interface NavGroup { group: string; admin?: boolean; fraud?: boolean; items: NavLeaf[] }
type NavNode = NavLeaf | NavGroup

const NAV: NavNode[] = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/transaksi', label: 'Transaksi & Ledger', icon: ArrowLeftRight },
  { to: '/buku-besar', label: 'Buku Besar', icon: BookOpen },
  {
    group: 'Fraud Detection',
    items: [
      { to: '/fds', label: 'Antrian Alert', icon: ShieldAlert, end: true },
      { to: '/fds/analytics', label: 'Analitik', icon: BarChart3, fraud: true },
      { to: '/fds/rules', label: 'Rules & Daftar Pantau', icon: SlidersHorizontal, fraud: true },
    ],
  },
  { to: '/rekonsiliasi', label: 'Rekonsiliasi', icon: GitCompareArrows },
  { to: '/developer', label: 'Developer', icon: Code2 },
  { to: '/audit', label: 'Audit Log', icon: ScrollText },
  {
    group: 'Platform',
    admin: true,
    items: [{ to: '/platform', label: 'Tenant & User', icon: Building2 }],
  },
]

function navItemClass(isActive: boolean) {
  return cn(
    'flex items-center gap-3 rounded-md px-3 py-2 text-body font-medium transition-colors',
    isActive ? 'bg-primary/10 font-semibold text-primary' : 'text-ink/70 hover:bg-bg hover:text-ink',
  )
}

function Sidebar({ open }: { open: boolean }) {
  const { user } = useAuth()
  const isFraudTeam = user?.role === 'ADMIN' || user?.role === 'ANALYST'
  const canSee = (n: { admin?: boolean; fraud?: boolean }) =>
    (!n.admin || user?.role === 'ADMIN') && (!n.fraud || isFraudTeam)

  const Leaf = ({ item }: { item: NavLeaf }) => (
    <NavLink to={item.to} end={item.end} className={({ isActive }) => navItemClass(isActive)}>
      <item.icon aria-hidden="true" className="h-[18px] w-[18px] shrink-0" />
      <span className="truncate">{item.label}</span>
    </NavLink>
  )

  return (
    <aside className={cn(
      'fixed bottom-0 left-0 top-14 z-30 w-60 overflow-y-auto border-r border-line bg-surface px-3 py-4 transition-transform duration-200',
      open ? 'translate-x-0' : '-translate-x-full',
    )}>
      <nav className="space-y-0.5" aria-label="Navigasi utama">
        {NAV.map((node, i) => {
          if ('group' in node) {
            if (!canSee(node)) return null
            const items = node.items.filter(canSee)
            if (items.length === 0) return null
            return (
              <div key={node.group} className="pt-3">
                <div className="px-3 pb-1 text-micro font-semibold uppercase tracking-[0.06em] text-muted">{node.group}</div>
                {items.map((it) => <Leaf key={it.to} item={it} />)}
              </div>
            )
          }
          return canSee(node) ? <Leaf key={node.to} item={node} /> : <span key={i} />
        })}
      </nav>
    </aside>
  )
}

function TopBar({ onToggle }: { onToggle: () => void }) {
  return (
    <header className="fixed inset-x-0 top-0 z-40 flex h-14 items-center gap-3 bg-gradient-to-r from-primary-900 via-primary-700 to-primary px-4 text-white shadow-[0_1px_3px_rgba(16,24,40,0.18)]">
      <button type="button" onClick={onToggle} aria-label="Buka/tutup menu"
        className="grid h-9 w-9 shrink-0 place-items-center rounded-md text-white/80 hover:bg-white/10 hover:text-white">
        <Menu aria-hidden="true" className="h-5 w-5" />
      </button>
      <div className="flex items-center gap-2 font-bold">
        <div className="grid h-7 w-7 place-items-center rounded-lg bg-white/12 ring-1 ring-inset ring-white/15">
          <ShieldCheck aria-hidden="true" className="h-4 w-4 text-white" />
        </div>
        <span className="text-h2 tracking-tight">PGGateway</span>
      </div>
      <div className="ml-auto flex items-center gap-3">
        <TenantSelect />
        <UserMenu />
      </div>
    </header>
  )
}

/** Tenant scope selector — re-scopes the whole dashboard to one PJP (or all). */
function TenantSelect() {
  const { tenant, setTenant } = useTenant()
  const { user } = useAuth()
  const { data } = useQuery<string[], Error>({ queryKey: ['tenants'], queryFn: fetchTenants })
  const tenants = data ?? []

  if (user && user.tenantId) {
    return (
      <div className="inline-flex items-center gap-2 rounded-md border border-white/15 bg-white/5 py-1.5 px-3 text-body font-semibold text-[#e8eef6]">
        <span aria-hidden="true" className="h-2 w-2 rounded-full bg-success" />
        {user.tenantId}
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
  const [navOpen, setNavOpen] = useState(true)
  return (
    <div className="min-h-screen bg-bg">
      <TopBar onToggle={() => setNavOpen((o) => !o)} />
      <Sidebar open={navOpen} />
      {impersonating ? (
        <div className={cn('fixed right-0 top-14 z-20 flex items-center justify-center gap-3 bg-warning px-4 py-1.5 text-small font-semibold text-white transition-[left] duration-200', navOpen ? 'left-60' : 'left-0')}>
          <span>Mode dukungan — Anda login sebagai tenant {user?.tenantId}</span>
          <button type="button" onClick={stopImpersonate} className="rounded bg-white/20 px-2 py-0.5 hover:bg-white/30">Keluar dari mode ini</button>
        </div>
      ) : null}
      <main className={cn('px-7 pb-12 transition-[margin] duration-200', navOpen ? 'ml-60' : 'ml-0', impersonating ? 'pt-[104px]' : 'pt-[76px]')}>{children}</main>
    </div>
  )
}

import type { ReactNode } from 'react'
import { NavLink } from 'react-router-dom'
import { ChevronDown, ShieldCheck, LogOut } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { cn } from '../lib/cn'
import { useTenant } from '../lib/tenant'
import { useAuth } from '../lib/auth'
import { fetchTenants } from '../lib/api'

const ROLE_LABEL: Record<string, string> = { ADMIN: 'Platform Admin', PJP: 'Operator PJP', ANALYST: 'Analis Fraud' }

/**
 * App shell. DESIGN.md §6/§9:
 * fixed navy top bar, brand, nav links (Bahasa Indonesia), read-only tenant chip.
 */

const NAV: { to: string; label: string; admin?: boolean }[] = [
  { to: '/', label: 'Dashboard' },
  { to: '/transaksi', label: 'Transaksi' },
  { to: '/buku-besar', label: 'Buku Besar' },
  { to: '/fds', label: 'FDS' },
  { to: '/fds/rules', label: 'Rules' },
  { to: '/rekonsiliasi', label: 'Rekonsiliasi' },
  { to: '/developer', label: 'Developer' },
  { to: '/audit', label: 'Audit' },
  { to: '/platform', label: 'Platform', admin: true },
]

function TopBar() {
  const { user } = useAuth()
  const nav = NAV.filter((n) => !n.admin || user?.role === 'ADMIN')
  return (
    <header className="fixed inset-x-0 top-0 z-40 h-14 bg-gradient-to-r from-primary-900 via-primary-700 to-primary text-white shadow-[0_1px_3px_rgba(16,24,40,0.18)]">
      <div className="flex h-full w-full items-center gap-7 px-6">
        <div className="flex items-center gap-2 font-bold">
          <div className="grid h-7 w-7 place-items-center rounded-lg bg-white/12 ring-1 ring-inset ring-white/15">
            <ShieldCheck aria-hidden="true" className="h-4 w-4 text-white" />
          </div>
          <span className="text-h2 tracking-tight">PGGateway</span>
        </div>

        <nav className="flex items-center gap-0.5" aria-label="Navigasi utama">
          {nav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/' || item.to === '/fds'}
              className={({ isActive }) =>
                cn(
                  'rounded-md px-3 py-1.5 text-body font-semibold transition-colors',
                  isActive
                    ? 'bg-white/15 text-white shadow-inner'
                    : 'text-white/65 hover:bg-white/8 hover:text-white',
                )
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-3">
          <TenantSelect />
          <UserMenu />
        </div>
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

  // A tenant-locked operator (PJP) can't switch scope — show a static chip of their PJP.
  if (user && user.tenantId) {
    return (
      <div className="inline-flex items-center gap-2 rounded-md border border-white/15 bg-white/5 py-1.5 pl-3 pr-3 text-body font-semibold text-[#e8eef6]">
        <span aria-hidden="true" className="h-2 w-2 rounded-full bg-success" />
        {user.tenantId}
      </div>
    )
  }

  return (
    <div className="relative">
      <span
        aria-hidden="true"
        className="pointer-events-none absolute left-3 top-1/2 h-2 w-2 -translate-y-1/2 rounded-full bg-success"
      />
      <select
        value={tenant}
        onChange={(e) => setTenant(e.target.value)}
        aria-label="Lingkup tenant (PJP)"
        className="appearance-none rounded-md border border-white/15 bg-white/5 py-1.5 pl-7 pr-9 text-body font-semibold text-[#e8eef6] hover:bg-white/10 focus:outline-none"
      >
        <option value="all" className="text-ink">Semua PJP</option>
        {tenants.map((t) => (
          <option key={t} value={t} className="text-ink">{t}</option>
        ))}
      </select>
      <ChevronDown
        aria-hidden="true"
        className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 opacity-80"
      />
    </div>
  )
}

/** Current user + sign out. */
function UserMenu() {
  const { user, logout } = useAuth()
  if (!user) return null
  return (
    <div className="flex items-center gap-2 border-l border-white/15 pl-3">
      <div className="hidden text-right leading-tight sm:block">
        <div className="text-small font-semibold text-white">{user.displayName}</div>
        <div className="text-micro text-white/60">{ROLE_LABEL[user.role] ?? user.role}</div>
      </div>
      <button
        type="button"
        onClick={logout}
        aria-label="Keluar"
        title="Keluar"
        className="grid h-8 w-8 place-items-center rounded-md text-white/70 hover:bg-white/10 hover:text-white"
      >
        <LogOut aria-hidden="true" className="h-4 w-4" />
      </button>
    </div>
  )
}

export function AppShell({ children }: { children: ReactNode }) {
  const { impersonating, user, stopImpersonate } = useAuth()
  return (
    <div className="min-h-screen bg-bg">
      <TopBar />
      {impersonating ? (
        <div className="fixed inset-x-0 top-14 z-30 flex items-center justify-center gap-3 bg-warning px-4 py-1.5 text-small font-semibold text-white">
          <span>Mode dukungan — Anda login sebagai tenant {user?.tenantId}</span>
          <button type="button" onClick={stopImpersonate} className="rounded bg-white/20 px-2 py-0.5 hover:bg-white/30">
            Keluar dari mode ini
          </button>
        </div>
      ) : null}
      <main className={'w-full px-6 pb-12 ' + (impersonating ? 'pt-[104px]' : 'pt-[76px]')}>{children}</main>
    </div>
  )
}

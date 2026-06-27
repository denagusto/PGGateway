import type { ReactNode } from 'react'
import { NavLink } from 'react-router-dom'
import { ChevronDown, ShieldCheck } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { cn } from '../lib/cn'
import { useTenant } from '../lib/tenant'
import { fetchTenants } from '../lib/api'

/**
 * App shell. DESIGN.md §6/§9:
 * fixed navy top bar, brand, nav links (Bahasa Indonesia), read-only tenant chip.
 */

const NAV: { to: string; label: string }[] = [
  { to: '/', label: 'Dashboard' },
  { to: '/transaksi', label: 'Transaksi' },
  { to: '/fds', label: 'FDS' },
  { to: '/fds/rules', label: 'Rules' },
  { to: '/rekonsiliasi', label: 'Rekonsiliasi' },
  { to: '/developer', label: 'Developer' },
  { to: '/audit', label: 'Audit' },
]

function TopBar() {
  return (
    <header className="fixed inset-x-0 top-0 z-40 h-14 border-b border-white/5 bg-primary text-white">
      <div className="flex h-full w-full items-center gap-6 px-6">
        <div className="flex items-center gap-2 font-bold">
          <ShieldCheck aria-hidden="true" className="h-5 w-5 text-[#e8eef6]" />
          <span className="text-h2 tracking-tight">PGGateway</span>
        </div>

        <nav className="flex items-center gap-1" aria-label="Navigasi utama">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/' || item.to === '/fds'}
              className={({ isActive }) =>
                cn(
                  'rounded-md px-3 py-1.5 text-body font-semibold transition-colors',
                  isActive
                    ? 'bg-white/10 text-white'
                    : 'text-[#c7d2e3] hover:bg-white/5 hover:text-white',
                )
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="ml-auto">
          <TenantSelect />
        </div>
      </div>
    </header>
  )
}

/** Tenant scope selector — re-scopes the whole dashboard to one PJP (or all). */
function TenantSelect() {
  const { tenant, setTenant } = useTenant()
  const { data } = useQuery<string[], Error>({ queryKey: ['tenants'], queryFn: fetchTenants })
  const tenants = data ?? []
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

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-bg">
      <TopBar />
      <main className="w-full px-6 pb-12 pt-[76px]">{children}</main>
    </div>
  )
}

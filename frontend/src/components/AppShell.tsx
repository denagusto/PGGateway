import type { ReactNode } from 'react'
import { NavLink } from 'react-router-dom'
import { ChevronDown, ShieldCheck } from 'lucide-react'
import { cn } from '../lib/cn'

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
  { to: '/audit', label: 'Audit' },
]

function TopBar() {
  return (
    <header className="fixed inset-x-0 top-0 z-40 h-14 bg-primary text-white">
      <div className="mx-auto flex h-full max-w-[1180px] items-center gap-6 px-4">
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
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-md border border-white/15 bg-white/5 px-3 py-1.5 text-body font-semibold text-[#e8eef6] hover:bg-white/10"
            aria-label="Tenant aktif: PT Dompet Cepat (PJP)"
          >
            <span
              aria-hidden="true"
              className="h-2 w-2 rounded-full bg-success"
            />
            <span className="text-[#c7d2e3]">Tenant:</span>
            <span>PT Dompet Cepat (PJP)</span>
            <ChevronDown aria-hidden="true" className="h-4 w-4 opacity-80" />
          </button>
        </div>
      </div>
    </header>
  )
}

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-bg">
      <TopBar />
      <main className="mx-auto max-w-[1180px] px-4 pb-12 pt-[72px]">{children}</main>
    </div>
  )
}

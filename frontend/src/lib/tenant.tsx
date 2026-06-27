import { createContext, useContext, useState, type ReactNode } from 'react'

/**
 * Global tenant scope. 'all' = platform-wide view (every PJP); otherwise a specific PJP id.
 * The selection is threaded into every data query as ?tenant=, so switching it re-scopes the
 * whole dashboard. Persisted to localStorage so the scope survives a reload.
 */
type TenantCtx = { tenant: string; setTenant: (t: string) => void }

const Ctx = createContext<TenantCtx>({ tenant: 'all', setTenant: () => {} })

export function TenantProvider({ children }: { children: ReactNode }) {
  const [tenant, setTenantState] = useState<string>(() => {
    try {
      return localStorage.getItem('pg.tenant') || 'all'
    } catch {
      return 'all'
    }
  })
  const setTenant = (t: string) => {
    setTenantState(t)
    try {
      localStorage.setItem('pg.tenant', t)
    } catch {
      /* ignore storage failures */
    }
  }
  return <Ctx.Provider value={{ tenant, setTenant }}>{children}</Ctx.Provider>
}

export function useTenant(): TenantCtx {
  return useContext(Ctx)
}

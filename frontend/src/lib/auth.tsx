import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { API_BASE, setAuthToken, setUnauthorizedHandler } from './api'

export interface User {
  username: string
  displayName: string
  role: string // ADMIN | PJP | ANALYST
  tenantId: string | null // null = platform-wide
}

interface AuthCtx {
  user: User | null
  ready: boolean
  impersonating: boolean
  login: (username: string, password: string) => Promise<void>
  logout: () => void
  impersonate: (token: string, user: User) => void
  stopImpersonate: () => void
}

const Ctx = createContext<AuthCtx>({
  user: null, ready: false, impersonating: false,
  login: async () => {}, logout: () => {}, impersonate: () => {}, stopImpersonate: () => {},
})
const TOKEN_KEY = 'pg.token'
const BACKUP_KEY = 'pg.admin_backup'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [ready, setReady] = useState(false)
  const [impersonating, setImpersonating] = useState(() => !!localStorage.getItem(BACKUP_KEY))

  useEffect(() => {
    // a 401 anywhere drops the session back to the login screen
    setUnauthorizedHandler(() => {
      setAuthToken(null)
      localStorage.removeItem(TOKEN_KEY)
      setUser(null)
    })
    const token = localStorage.getItem(TOKEN_KEY)
    if (!token) { setReady(true); return }
    setAuthToken(token)
    fetch(`${API_BASE}/api/auth/me`)
      .then(async (r) => {
        if (r.ok) setUser((await r.json()) as User)
        else { setAuthToken(null); localStorage.removeItem(TOKEN_KEY) }
      })
      .catch(() => {})
      .finally(() => setReady(true))
  }, [])

  const login = async (username: string, password: string) => {
    const r = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    })
    if (!r.ok) {
      const body = (await r.json().catch(() => ({}))) as { error?: string }
      throw new Error(body.error ?? `Login gagal (${r.status})`)
    }
    const data = (await r.json()) as { token: string; user: User }
    localStorage.setItem(TOKEN_KEY, data.token)
    setAuthToken(data.token)
    setUser(data.user)
  }

  const logout = () => {
    setAuthToken(null)
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(BACKUP_KEY)
    setImpersonating(false)
    setUser(null)
  }

  // Super-admin "login as" a tenant — back up the admin session so it can be restored.
  const impersonate = (token: string, asUser: User) => {
    const adminToken = localStorage.getItem(TOKEN_KEY)
    if (adminToken && user) {
      localStorage.setItem(BACKUP_KEY, JSON.stringify({ token: adminToken, user }))
    }
    localStorage.setItem(TOKEN_KEY, token)
    setAuthToken(token)
    setUser(asUser)
    setImpersonating(true)
  }

  const stopImpersonate = () => {
    const raw = localStorage.getItem(BACKUP_KEY)
    if (!raw) return
    const { token, user: adminUser } = JSON.parse(raw) as { token: string; user: User }
    localStorage.setItem(TOKEN_KEY, token)
    localStorage.removeItem(BACKUP_KEY)
    setAuthToken(token)
    setUser(adminUser)
    setImpersonating(false)
  }

  return (
    <Ctx.Provider value={{ user, ready, impersonating, login, logout, impersonate, stopImpersonate }}>
      {children}
    </Ctx.Provider>
  )
}

export function useAuth(): AuthCtx {
  return useContext(Ctx)
}

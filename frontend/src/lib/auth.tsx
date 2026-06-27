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
  login: (username: string, password: string) => Promise<void>
  logout: () => void
}

const Ctx = createContext<AuthCtx>({ user: null, ready: false, login: async () => {}, logout: () => {} })
const TOKEN_KEY = 'pg.token'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [ready, setReady] = useState(false)

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
    setUser(null)
  }

  return <Ctx.Provider value={{ user, ready, login, logout }}>{children}</Ctx.Provider>
}

export function useAuth(): AuthCtx {
  return useContext(Ctx)
}

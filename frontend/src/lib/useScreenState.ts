import { useSearchParams } from 'react-router-dom'

/**
 * Demo state driver. DESIGN.md §8 — every screen implements
 * empty / loading / error (+ ready). Toggle via ?state=empty|loading|error.
 * Default = ready (normal data).
 */
export type ScreenState = 'ready' | 'empty' | 'loading' | 'error'

const VALID: ScreenState[] = ['ready', 'empty', 'loading', 'error']

export function useScreenState(): {
  state: ScreenState
  setState: (s: ScreenState) => void
} {
  const [params, setParams] = useSearchParams()
  const raw = params.get('state') as ScreenState | null
  const state: ScreenState = raw && VALID.includes(raw) ? raw : 'ready'

  const setState = (s: ScreenState) => {
    const next = new URLSearchParams(params)
    if (s === 'ready') next.delete('state')
    else next.set('state', s)
    setParams(next, { replace: true })
  }

  return { state, setState }
}

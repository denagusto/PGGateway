import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { API_BASE } from './api'

/**
 * Subscribe to the server's SSE stream and refetch the affected lists the instant something
 * changes — true server push, no manual refresh. Each event names a resource that changed; we
 * invalidate just those queries (TanStack then refetches authoritative data over REST). EventSource
 * reconnects automatically; the global 15s polling backstop covers any gap while a connection is down.
 */
const MAP: Record<string, string[][]> = {
  transactions: [['transactions'], ['ledger-txns'], ['stats']],
  alerts: [['alerts'], ['alert-queue'], ['stats']],
  accounts: [['accounts'], ['stats']],
  ledger: [['gl-trial'], ['gl-safeguarding'], ['gl-journal']],
}

export function useLiveStream() {
  const qc = useQueryClient()
  useEffect(() => {
    const es = new EventSource(`${API_BASE}/api/stream`)
    es.addEventListener('change', (ev) => {
      const keys = MAP[(ev as MessageEvent).data]
      if (!keys) {
        qc.invalidateQueries()
        return
      }
      keys.forEach((queryKey) => qc.invalidateQueries({ queryKey }))
    })
    return () => es.close()
  }, [qc])
}

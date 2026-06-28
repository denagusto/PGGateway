import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'
import { CheckCircle2, AlertTriangle, Info, X } from 'lucide-react'

type Tone = 'success' | 'error' | 'info'
interface Toast { id: number; title: string; description?: string; tone: Tone }
interface ToastInput { title: string; description?: string; tone?: Tone }

const ToastCtx = createContext<(t: ToastInput) => void>(() => {})
let nextId = 1

const TONE: Record<Tone, { icon: typeof CheckCircle2; ring: string; text: string }> = {
  success: { icon: CheckCircle2, ring: 'ring-success/30', text: 'text-success' },
  error: { icon: AlertTriangle, ring: 'ring-danger/30', text: 'text-danger' },
  info: { icon: Info, ring: 'ring-accent/30', text: 'text-accent' },
}

/** App-wide toast notifications — enterprise feedback for every action. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const dismiss = useCallback((id: number) => setToasts((ts) => ts.filter((t) => t.id !== id)), [])
  const toast = useCallback(
    (t: ToastInput) => {
      const id = nextId++
      setToasts((ts) => [...ts, { id, tone: 'info', ...t }])
      setTimeout(() => dismiss(id), 4200)
    },
    [dismiss],
  )
  return (
    <ToastCtx.Provider value={toast}>
      {children}
      <div className="pointer-events-none fixed bottom-5 right-5 z-[60] flex w-[22rem] max-w-[calc(100vw-2.5rem)] flex-col gap-2.5">
        {toasts.map((t) => {
          const { icon: Icon, ring, text } = TONE[t.tone]
          return (
            <div
              key={t.id}
              className={
                'pointer-events-auto flex animate-slide-fade-in items-start gap-3 rounded-xl border border-line bg-surface p-3.5 shadow-popover ring-1 ' +
                ring
              }
              role="status"
            >
              <Icon aria-hidden="true" className={'mt-0.5 h-5 w-5 shrink-0 ' + text} />
              <div className="min-w-0 flex-1">
                <div className="text-body font-semibold text-ink">{t.title}</div>
                {t.description ? <div className="mt-0.5 text-small text-muted">{t.description}</div> : null}
              </div>
              <button
                type="button"
                onClick={() => dismiss(t.id)}
                aria-label="Tutup"
                className="grid h-6 w-6 shrink-0 place-items-center rounded-md text-muted hover:bg-bg hover:text-ink"
              >
                <X aria-hidden="true" className="h-4 w-4" />
              </button>
            </div>
          )
        })}
      </div>
    </ToastCtx.Provider>
  )
}

export function useToast() {
  return useContext(ToastCtx)
}

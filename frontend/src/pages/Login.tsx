import { useState, type FormEvent } from 'react'
import { ShieldCheck, LogIn } from 'lucide-react'
import { Card, CardBody } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Input, Field } from '../components/ui/Input'
import { useAuth } from '../lib/auth'

const DEMO = [
  { u: 'admin', label: 'Platform admin — semua PJP' },
  { u: 'demo', label: 'Operator PJP-DEMO' },
  { u: 'analyst', label: 'Analis fraud' },
]

export default function Login() {
  const { login } = useAuth()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      await login(username.trim(), password)
    } catch (x) {
      setError(x instanceof Error ? x.message : 'Login gagal')
    } finally {
      setBusy(false)
    }
  }

  const quick = (u: string) => { setUsername(u); setPassword(u + '123') }

  return (
    <div className="grid min-h-screen place-items-center bg-gradient-to-br from-primary-900 via-primary-700 to-primary px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center justify-center gap-2 text-white">
          <div className="grid h-9 w-9 place-items-center rounded-lg bg-white/12 ring-1 ring-inset ring-white/20">
            <ShieldCheck aria-hidden="true" className="h-5 w-5" />
          </div>
          <span className="text-xl font-bold tracking-tight">PGGateway</span>
        </div>

        <Card>
          <CardBody className="p-6">
            <h1 className="text-h1 font-bold text-ink">Masuk</h1>
            <p className="mt-0.5 text-small text-muted">Ledger &amp; Fraud Detection untuk PJP</p>

            <form className="mt-5 space-y-4" onSubmit={submit}>
              <Field label="Username">
                <Input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="username" autoFocus />
              </Field>
              <Field label="Password">
                <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
              </Field>
              {error ? <p className="text-small text-danger">{error}</p> : null}
              <Button type="submit" className="w-full gap-1.5" disabled={busy || !username.trim() || !password}>
                <LogIn aria-hidden="true" className="h-4 w-4" /> {busy ? 'Memproses…' : 'Masuk'}
              </Button>
            </form>

            <div className="mt-5 border-t border-line pt-4">
              <p className="mb-2 text-micro uppercase tracking-wide text-muted">Akun demo (klik untuk isi)</p>
              <div className="space-y-1">
                {DEMO.map((d) => (
                  <button
                    key={d.u}
                    type="button"
                    onClick={() => quick(d.u)}
                    className="flex w-full items-center justify-between rounded-md border border-line px-3 py-1.5 text-left text-small hover:border-accent hover:bg-bg"
                  >
                    <span className="font-mono text-ink">{d.u} / {d.u}123</span>
                    <span className="text-micro text-muted">{d.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  )
}

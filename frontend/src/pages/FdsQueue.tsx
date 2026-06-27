import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ShieldCheck } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { PageHeader } from '../components/PageHeader'
import { Card } from '../components/ui/Card'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { Skeleton } from '../components/ui/Skeleton'
import { EmptyState, ErrorState } from '../components/StateViews'
import { Table, TBody, THead, TH, TR, TD } from '../components/ui/Table'
import { cn } from '../lib/cn'
import { formatRupiah } from '../lib/format'
import { scoreMeta, bandMeta } from '../lib/score'
import { fetchAlertList } from '../lib/api'
import { useTenant } from '../lib/tenant'
import type { AlertRow } from '../data/types'

const FILTERS: { key: string; label: string }[] = [
  { key: 'OPEN', label: 'Terbuka' },
  { key: 'CONFIRMED_FRAUD', label: 'Fraud' },
  { key: 'FALSE_POSITIVE', label: 'False-positive' },
  { key: 'ALL', label: 'Semua' },
]

function statusBadge(status: string) {
  if (status === 'CONFIRMED_FRAUD') return <Badge tone="danger">fraud</Badge>
  if (status === 'FALSE_POSITIVE') return <Badge tone="neutral">false-positive</Badge>
  return <Badge tone="danger">terbuka</Badge>
}

export default function FdsQueue() {
  const navigate = useNavigate()
  const { tenant } = useTenant()
  const [status, setStatus] = useState('OPEN')
  const query = useQuery<AlertRow[], Error>({
    queryKey: ['alert-queue', status, tenant],
    queryFn: () => fetchAlertList(status, 100, tenant),
  })

  return (
    <>
      <PageHeader
        title="FDS — Antrian Alert"
        subtitle="Semua alert fraud/AML dari rule engine"
        right={
          <div className="inline-flex rounded-md border border-line bg-surface p-0.5">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                type="button"
                onClick={() => setStatus(f.key)}
                className={cn(
                  'rounded px-2.5 py-1 text-small font-semibold',
                  status === f.key ? 'bg-primary text-white' : 'text-muted hover:text-ink',
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
        }
      />

      <Card>
        {query.isError ? (
          <ErrorState onRetry={() => query.refetch()} />
        ) : query.isPending ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-9 w-full" />)}
          </div>
        ) : query.data.length === 0 ? (
          <EmptyState icon={ShieldCheck} title="Tidak ada alert" description="Tidak ada alert untuk filter ini. Sistem memantau." />
        ) : (
          <Table>
            <THead>
              <TR>
                <TH>Waktu</TH><TH>Aturan</TH><TH>Akun</TH>
                <TH align="right">Jumlah</TH><TH align="right">Skor</TH><TH>Status</TH><TH></TH>
              </TR>
            </THead>
            <TBody>
              {query.data.map((a) => {
                const meta = scoreMeta(a.score)
                return (
                  <TR key={a.id}>
                    <TD numeric className="text-muted">{a.waktu}</TD>
                    <TD>
                      <span className="block text-ink">{a.ruleName}</span>
                      {a.report ? <span className="text-micro uppercase tracking-wide text-muted">{a.report}</span> : null}
                    </TD>
                    <TD numeric>{a.account}</TD>
                    <TD numeric align="right">{formatRupiah(a.amount)}</TD>
                    <TD numeric align="right">
                      <span className="font-semibold tnum" style={{ color: meta.color }}>{a.score}</span>
                      <span
                        className="ml-2 inline-block rounded px-1.5 py-0.5 text-micro font-bold"
                        style={{ color: bandMeta(a.band).color, backgroundColor: bandMeta(a.band).color + '1a' }}
                      >
                        {bandMeta(a.band).label}
                      </span>
                    </TD>
                    <TD>{statusBadge(a.status)}</TD>
                    <TD>
                      <Button variant="secondary" className="h-8 px-2 text-small" onClick={() => navigate(`/fds/${a.id}`)}>
                        Tinjau
                      </Button>
                    </TD>
                  </TR>
                )
              })}
            </TBody>
          </Table>
        )}
      </Card>
    </>
  )
}

import { ScrollText } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { PageHeader } from '../components/PageHeader'
import { Card } from '../components/ui/Card'
import { Badge } from '../components/ui/Badge'
import { Skeleton } from '../components/ui/Skeleton'
import { EmptyState, ErrorState } from '../components/StateViews'
import { Table, TBody, THead, TH, TR, TD } from '../components/ui/Table'
import { fetchAudit } from '../lib/api'
import type { AuditEntry } from '../data/types'

const ACTION_LABEL: Record<string, string> = {
  'alert.verdict': 'Verdict alert',
  'rule.create': 'Buat rule',
  'rule.update': 'Ubah rule',
  'rule.delete': 'Hapus rule',
  'key.create': 'Buat API key',
  'key.revoke': 'Cabut API key',
  'recon.resolve': 'Selesaikan rekonsiliasi',
}

export default function Audit() {
  const query = useQuery<AuditEntry[], Error>({ queryKey: ['audit'], queryFn: () => fetchAudit(100) })

  return (
    <>
      <PageHeader title="Audit Log" subtitle="Jejak aksi sensitif — siapa, apa, kapan (immutable)" />
      <Card>
        {query.isError ? (
          <ErrorState onRetry={() => query.refetch()} />
        ) : query.isPending ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-9 w-full" />)}
          </div>
        ) : query.data.length === 0 ? (
          <EmptyState
            icon={ScrollText}
            title="Belum ada aktivitas"
            description="Aksi sensitif (verdict alert, ubah rule, buat/cabut API key, resolve rekonsiliasi) akan tercatat di sini."
          />
        ) : (
          <Table>
            <THead>
              <TR><TH>Waktu</TH><TH>Aksi</TH><TH>Target</TH><TH>Detail</TH><TH>Aktor</TH></TR>
            </THead>
            <TBody>
              {query.data.map((e) => (
                <TR key={e.id}>
                  <TD numeric className="text-muted">{new Date(e.timestamp).toLocaleString('id-ID', { hour12: false })}</TD>
                  <TD><Badge tone="neutral">{ACTION_LABEL[e.action] ?? e.action}</Badge></TD>
                  <TD numeric className="font-mono text-small">{e.target}</TD>
                  <TD className="text-muted">{e.detail || '—'}</TD>
                  <TD className="text-muted">{e.actor}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </Card>
    </>
  )
}

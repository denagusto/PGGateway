import { Wallet, Activity } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { PageHeader } from '../components/PageHeader'
import { Card, CardHeader } from '../components/ui/Card'
import { Skeleton } from '../components/ui/Skeleton'
import { EmptyState, ErrorState } from '../components/StateViews'
import { TxnStatusBadge } from '../components/StatusBadge'
import { Table, TBody, THead, TH, TR, TD } from '../components/ui/Table'
import { formatRupiah, formatInt } from '../lib/format'
import { fetchAccounts, fetchTransactions } from '../lib/api'
import type { AccountBalance, Transaction } from '../data/types'

export default function Ledger() {
  const accounts = useQuery<AccountBalance[], Error>({ queryKey: ['accounts'], queryFn: () => fetchAccounts(50) })
  const txns = useQuery<Transaction[], Error>({ queryKey: ['ledger-txns'], queryFn: () => fetchTransactions(20) })

  return (
    <>
      <PageHeader title="Transaksi / Ledger" subtitle="Saldo akun (double-entry) + transaksi terbaru" />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Saldo Akun (Ledger)" action={<Wallet aria-hidden="true" className="h-4 w-4 text-muted" />} />
          {accounts.isError ? (
            <ErrorState onRetry={() => accounts.refetch()} />
          ) : accounts.isPending ? (
            <Loading rows={6} />
          ) : accounts.data.length === 0 ? (
            <EmptyState icon={Wallet} title="Belum ada saldo" description="Saldo muncul saat transaksi mengalir." />
          ) : (
            <Table>
              <THead>
                <TR><TH>Akun</TH><TH align="right">Saldo</TH><TH align="right">Txn</TH></TR>
              </THead>
              <TBody>
                {accounts.data.map((a) => (
                  <TR key={a.account}>
                    <TD>{a.account}</TD>
                    <TD numeric align="right" className={a.balanceMinor < 0 ? 'text-danger' : 'text-ink'}>
                      {formatRupiah(a.balanceMinor / 100)}
                    </TD>
                    <TD numeric align="right" className="text-muted">{formatInt(a.txnCount)}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </Card>

        <Card>
          <CardHeader title="Transaksi terbaru" action={<Activity aria-hidden="true" className="h-4 w-4 text-success" />} />
          {txns.isError ? (
            <ErrorState onRetry={() => txns.refetch()} />
          ) : txns.isPending ? (
            <Loading rows={6} />
          ) : txns.data.length === 0 ? (
            <EmptyState icon={Activity} title="Belum ada transaksi" description="Transaksi masuk akan muncul di sini." />
          ) : (
            <Table>
              <THead>
                <TR><TH>Waktu</TH><TH>Channel</TH><TH align="right">Jumlah</TH><TH>Status</TH></TR>
              </THead>
              <TBody>
                {txns.data.map((t) => (
                  <TR key={t.id}>
                    <TD numeric className="text-muted">{t.waktu}</TD>
                    <TD>{t.channel}</TD>
                    <TD numeric align="right">{formatRupiah(t.jumlah)}</TD>
                    <TD><TxnStatusBadge status={t.status} /></TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </Card>
      </div>
    </>
  )
}

function Loading({ rows }: { rows: number }) {
  return (
    <div className="space-y-2 p-4">
      {Array.from({ length: rows }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}
    </div>
  )
}

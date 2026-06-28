import { GitCompareArrows, AlertTriangle, ShieldCheck, Banknote, Clock } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { PageHeader } from '../components/PageHeader'
import { Card, CardHeader, CardBody } from '../components/ui/Card'
import { StatCard } from '../components/ui/StatCard'
import { Badge } from '../components/ui/Badge'
import { Skeleton } from '../components/ui/Skeleton'
import { ErrorState } from '../components/StateViews'
import { Table, TBody, THead, TH, TR, TD } from '../components/ui/Table'
import { formatRupiahCompact, formatInt } from '../lib/format'
import { fetchReconRuns, fetchReconWorkspaceSummary, type ReconRun, type ReconWorkspaceSummary } from '../lib/api'

export default function Reconciliation() {
  const summary = useQuery<ReconWorkspaceSummary, Error>({ queryKey: ['recon-ws-summary'], queryFn: fetchReconWorkspaceSummary })
  const runs = useQuery<ReconRun[], Error>({ queryKey: ['recon-runs'], queryFn: fetchReconRuns })

  return (
    <>
      <PageHeader icon={GitCompareArrows} title="Rekonsiliasi — Runs & Ringkasan"
        subtitle="Pencocokan ledger PGGateway vs sumber settlement, per siklus" />

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {summary.isPending || summary.isError ? Array.from({ length: 4 }).map((_, i) => <Card key={i} className="p-5"><Skeleton className="h-16 w-full" /></Card>) : (
          <>
            <StatCard label="Match rate (rata2)" value={`${summary.data.avgMatchRatePct.toFixed(2)}%`} sub="lintas sumber" icon={ShieldCheck} valueTone={summary.data.avgMatchRatePct >= 99 ? 'success' : 'ink'} />
            <StatCard label="Breaks terbuka" value={formatInt(summary.data.openBreaks)} sub="perlu ditangani" subTone={summary.data.openBreaks ? 'warning' : 'success'} valueTone={summary.data.openBreaks ? 'warning' : 'success'} icon={AlertTriangle} />
            <StatCard label="Value at risk" value={formatRupiahCompact(summary.data.valueAtRiskMinor / 100)} sub="nilai belum terekonsiliasi" subTone="danger" valueTone="danger" icon={Banknote} />
            <StatCard label="Break tertua" value={`>7h: ${summary.data.agingOver7d}`} sub={`${summary.data.aging3to7d} di 3–7h`} subTone={summary.data.agingOver7d ? 'danger' : 'muted'} icon={Clock} />
          </>
        )}
      </div>

      {/* Aging breakdown */}
      {summary.data ? (
        <Card className="mb-6">
          <CardHeader title="Aging breaks terbuka" />
          <CardBody>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Aging label="0–1 hari" value={summary.data.aging0to1d} tone="success" />
              <Aging label="1–3 hari" value={summary.data.aging1to3d} tone="ink" />
              <Aging label="3–7 hari" value={summary.data.aging3to7d} tone="warning" />
              <Aging label="> 7 hari" value={summary.data.agingOver7d} tone="danger" />
            </div>
          </CardBody>
        </Card>
      ) : null}

      <Card>
        <CardHeader title="Recon runs (siklus 2026-06-27)" action={<Link to="/rekonsiliasi/exceptions" className="text-small font-semibold text-primary hover:underline">Lihat exceptions →</Link>} />
        <CardBody>
          {runs.isError ? <ErrorState onRetry={() => runs.refetch()} /> : runs.isPending ? <Skeleton className="h-40 w-full" /> : (
            <div className="overflow-x-auto">
              <Table>
                <THead>
                  <TR><TH>Sumber</TH><TH>Status</TH><TH align="right">Match rate</TH><TH align="right">Cocok / total</TH><TH align="right">Breaks</TH><TH align="right">Terekonsiliasi</TH><TH align="right">At risk</TH></TR>
                </THead>
                <TBody>
                  {runs.data.map((r) => (
                    <TR key={r.id}>
                      <TD className="font-medium text-ink">{r.source}</TD>
                      <TD><Badge tone={r.status === 'COMPLETED' ? 'success' : 'warning'}>{r.status}</Badge></TD>
                      <TD numeric align="right" className={r.matchRatePct >= 99.5 ? 'text-success' : 'text-ink'}>{r.matchRatePct.toFixed(2)}%</TD>
                      <TD numeric align="right" className="text-muted">{formatInt(r.matched)} / {formatInt(r.total)}</TD>
                      <TD numeric align="right" className={r.breakCount ? 'text-warning' : 'text-muted'}>{formatInt(r.breakCount)}</TD>
                      <TD numeric align="right">{formatRupiahCompact(r.valueReconciledMinor / 100)}</TD>
                      <TD numeric align="right" className={r.valueAtRiskMinor ? 'text-danger' : 'text-muted'}>{formatRupiahCompact(r.valueAtRiskMinor / 100)}</TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </div>
          )}
        </CardBody>
      </Card>
    </>
  )
}

function Aging({ label, value, tone }: { label: string; value: number; tone: 'success' | 'ink' | 'warning' | 'danger' }) {
  const c = { success: 'text-success', ink: 'text-ink', warning: 'text-warning', danger: 'text-danger' }[tone]
  return (
    <div className="rounded-md border border-line bg-bg p-3 text-center">
      <div className={`text-display font-bold ${c}`}>{value}</div>
      <div className="mt-0.5 text-micro uppercase tracking-wide text-muted">{label}</div>
    </div>
  )
}

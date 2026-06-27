import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { ShieldCheck } from 'lucide-react'
import { PageHeader } from '../components/PageHeader'
import { StateToggle } from '../components/StateToggle'
import { Card, CardBody, CardHeader } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Badge } from '../components/ui/Badge'
import { Skeleton } from '../components/ui/Skeleton'
import { RiskGauge } from '../components/ui/RiskGauge'
import { EmptyState, ErrorState } from '../components/StateViews'
import { useScreenState } from '../lib/useScreenState'
import { useMockQuery } from '../lib/useMockQuery'
import { formatRupiah } from '../lib/format'
import { scoreMeta } from '../lib/score'
import { getAlertDetail } from '../data/mock'
import type { AlertDetail as AlertDetailT } from '../data/types'

export default function AlertDetail() {
  const { id = 'A-20431' } = useParams()
  const { state, setState } = useScreenState()
  const [note, setNote] = useState('')
  const [resolved, setResolved] = useState<null | 'fraud' | 'fp'>(null)

  const detail = getAlertDetail(id)
  const query = useMockQuery<AlertDetailT | null>(
    ['alert', id],
    detail ?? null,
    null,
    state,
  )

  return (
    <>
      <PageHeader
        title="FDS — Detail Alert"
        subtitle="Konteks kasus, alasan penandaan, dan tindakan analyst"
        right={<StateToggle state={state} onChange={setState} />}
      />

      {query.isError ? (
        <Card>
          <ErrorState onRetry={() => query.refetch()} />
        </Card>
      ) : query.isPending ? (
        <LoadingDetail />
      ) : !query.data ? (
        <Card>
          <EmptyState
            icon={ShieldCheck}
            title="Alert tidak ditemukan"
            description="Alert ini mungkin sudah ditutup atau di luar lingkup tenant Anda."
          />
        </Card>
      ) : (
        <ReadyDetail
          d={query.data}
          note={note}
          setNote={setNote}
          resolved={resolved}
          onResolve={setResolved}
        />
      )}
    </>
  )
}

function ReadyDetail({
  d,
  note,
  setNote,
  resolved,
  onResolve,
}: {
  d: AlertDetailT
  note: string
  setNote: (s: string) => void
  resolved: null | 'fraud' | 'fp'
  onResolve: (r: 'fraud' | 'fp') => void
}) {
  const meta = scoreMeta(d.score)
  return (
    <>
      {/* Alert header card */}
      <Card className="mb-6">
        <div className="flex flex-wrap items-start justify-between gap-3 p-4">
          <div>
            <h2 className="text-h2 font-semibold text-ink">
              Alert #{d.id} — {d.judul}
            </h2>
            <p className="mt-0.5 text-small text-muted tnum">
              {d.channel} · {formatRupiah(d.jumlah)} · {d.waktuRingkas}
            </p>
          </div>
          {d.status === 'terbuka' ? (
            <Badge tone="danger">TERBUKA · prioritas {d.prioritas}</Badge>
          ) : (
            <Badge tone="neutral">DITUTUP</Badge>
          )}
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Col 1 — Konteks transaksi */}
        <Card>
          <CardHeader title="Konteks transaksi" />
          <CardBody>
            <dl className="space-y-2">
              <Row label="Jumlah" value={formatRupiah(d.konteks.jumlah)} strong numeric />
              <Row label="Channel" value={d.konteks.channel} />
              <Row label="Merchant" value={d.konteks.merchant} />
              <Row label="Akun sumber" value={d.konteks.akunSumber} />
              <Row label="Waktu" value={d.konteks.waktu} numeric />
              <Row label="txnRef" value={d.konteks.txnRef} numeric />
            </dl>
          </CardBody>
        </Card>

        {/* Col 2 — Kenapa ini ditandai (gauge + reasons) */}
        <Card>
          <CardHeader title="Kenapa ini ditandai" />
          <CardBody>
            <div className="flex items-start gap-4">
              <RiskGauge score={d.score} />
              <div className="flex-1">
                <Badge tone="neutral" className="mb-2">{d.rule}</Badge>
                <ul className="space-y-1.5">
                  {d.alasan.map((r) => (
                    <li key={r} className="flex items-center gap-2 text-body text-ink">
                      <span
                        aria-hidden="true"
                        className="h-1.5 w-1.5 shrink-0 rounded-full"
                        style={{ backgroundColor: meta.color }}
                      />
                      {r}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </CardBody>
        </Card>

        {/* Col 3 — Tindakan */}
        <Card>
          <CardHeader title="Tindakan" />
          <CardBody>
            {resolved ? (
              <Badge tone={resolved === 'fraud' ? 'danger' : 'neutral'} className="mb-3">
                {resolved === 'fraud' ? 'Ditandai fraud' : 'Ditandai false-positive'}
              </Badge>
            ) : null}
            <div className="space-y-2">
              <Button
                variant="destructive"
                className="h-10 w-full"
                disabled={resolved !== null}
                onClick={() => onResolve('fraud')}
              >
                Konfirmasi Fraud
              </Button>
              <Button
                variant="secondary"
                className="h-10 w-full"
                disabled={resolved !== null}
                onClick={() => onResolve('fp')}
              >
                Tandai False-Positive
              </Button>
            </div>
            <label className="mt-3 block">
              <span className="sr-only">Catatan kasus</span>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Catatan kasus…"
                rows={3}
                className="w-full rounded-md border border-line bg-surface px-3 py-2 text-body text-ink placeholder:text-muted"
              />
            </label>
            <p className="mt-2 text-small text-muted">
              Aksi tercatat di Audit Log + jadi feedback untuk detektor.
            </p>
          </CardBody>
        </Card>
      </div>
    </>
  )
}

function Row({
  label,
  value,
  strong,
  numeric,
}: {
  label: string
  value: string
  strong?: boolean
  numeric?: boolean
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-line pb-2 last:border-b-0 last:pb-0">
      <dt className="text-small text-muted">{label}</dt>
      <dd
        className={
          'text-right text-body text-ink' +
          (strong ? ' font-semibold' : '') +
          (numeric ? ' tnum' : '')
        }
      >
        {value}
      </dd>
    </div>
  )
}

function LoadingDetail() {
  return (
    <>
      <Card className="mb-6">
        <div className="p-4">
          <Skeleton className="h-5 w-72" />
          <Skeleton className="mt-2 h-3 w-48" />
        </div>
      </Card>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i}>
            <div className="border-b border-line px-4 py-3">
              <Skeleton className="h-4 w-40" />
            </div>
            <div className="space-y-2 p-4">
              {Array.from({ length: 5 }).map((__, j) => (
                <Skeleton key={j} className="h-6 w-full" />
              ))}
            </div>
          </Card>
        ))}
      </div>
    </>
  )
}

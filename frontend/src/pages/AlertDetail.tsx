import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { ShieldCheck, ShieldAlert } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { PageHeader } from '../components/PageHeader'
import { StateToggle } from '../components/StateToggle'
import { Card, CardBody, CardHeader } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Badge } from '../components/ui/Badge'
import { Skeleton } from '../components/ui/Skeleton'
import { RiskGauge } from '../components/ui/RiskGauge'
import { EmptyState, ErrorState } from '../components/StateViews'
import { useScreenState } from '../lib/useScreenState'
import { Textarea } from '../components/ui/Input'
import { formatRupiah } from '../lib/format'
import { scoreMeta, bandMeta } from '../lib/score'
import { fetchAlertDetail, postAlertVerdict } from '../lib/api'
import type { AlertDetail as AlertDetailT } from '../data/types'

export default function AlertDetail() {
  const { id = '' } = useParams()
  const { state, setState } = useScreenState()
  const [note, setNote] = useState('')
  const qc = useQueryClient()

  const query = useQuery<AlertDetailT | null, Error>({
    queryKey: ['alert', id, state],
    queryFn: async () => {
      if (state === 'loading') {
        await new Promise((r) => setTimeout(r, 100000))
        return null
      }
      if (state === 'error') throw new Error('Simulated API 5xx')
      if (state === 'empty') return null
      return fetchAlertDetail(id)
    },
    staleTime: 0,
    gcTime: 0,
  })

  const verdict = useMutation({
    mutationFn: (v: 'confirm_fraud' | 'false_positive') => postAlertVerdict(id, v),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['alert', id] })
      qc.invalidateQueries({ queryKey: ['alerts'] })
    },
  })

  const resolved: null | 'fraud' | 'fp' =
    query.data && query.data.status === 'ditutup'
      ? 'fraud'
      : verdict.isSuccess
        ? verdict.variables === 'confirm_fraud'
          ? 'fraud'
          : 'fp'
        : null

  return (
    <>
      <PageHeader
        icon={ShieldAlert}
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
          pending={verdict.isPending}
          onResolve={(r) => verdict.mutate(r === 'fraud' ? 'confirm_fraud' : 'false_positive')}
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
  pending,
  onResolve,
}: {
  d: AlertDetailT
  note: string
  setNote: (s: string) => void
  resolved: null | 'fraud' | 'fp'
  pending: boolean
  onResolve: (r: 'fraud' | 'fp') => void
}) {
  const meta = scoreMeta(d.score)
  return (
    <>
      <Card className="mb-6">
        <div className="flex flex-wrap items-start justify-between gap-3 p-4">
          <div>
            <h2 className="text-h2 font-semibold text-ink">
              Alert #{d.id.slice(0, 8)} — {d.judul}
            </h2>
            <p className="mt-0.5 text-small text-muted tnum">
              {d.channel} · {formatRupiah(d.jumlah)} · {d.waktuRingkas}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {d.report ? <Badge tone="neutral">{d.report}</Badge> : null}
            {d.status === 'terbuka' && resolved === null ? (
              <Badge tone="danger">TERBUKA · prioritas {d.prioritas}</Badge>
            ) : (
              <Badge tone="neutral">DITUTUP</Badge>
            )}
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
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

        <Card>
          <CardHeader title="Kenapa ini ditandai" />
          <CardBody>
            <div className="flex items-start gap-4">
              <RiskGauge score={d.score} />
              <div className="flex-1">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span
                    className="rounded px-2 py-0.5 text-micro font-bold"
                    style={{ color: bandMeta(d.band).color, backgroundColor: bandMeta(d.band).color + '1a' }}
                  >
                    {bandMeta(d.band).label} · skor {d.score}
                  </span>
                  <Badge tone="neutral">{d.rule}</Badge>
                </div>
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
                disabled={resolved !== null || pending}
                onClick={() => onResolve('fraud')}
              >
                {pending ? 'Menyimpan…' : 'Konfirmasi Fraud'}
              </Button>
              <Button
                variant="secondary"
                className="h-10 w-full"
                disabled={resolved !== null || pending}
                onClick={() => onResolve('fp')}
              >
                Tandai False-Positive
              </Button>
            </div>
            <label className="mt-3 block">
              <span className="sr-only">Catatan kasus</span>
              <Textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Catatan kasus…"
                rows={3}
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

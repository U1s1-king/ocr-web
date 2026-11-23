import { useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { resultsApi, type QuestionDetail, type ResultDetail } from '../api'
import { IcAlert, IcCheck, IcFile, IcSpark, IcX } from '../icons'
import { Card, DemoTag, ErrorBar, Page, Ring, Skeleton, fmtTime, useLoad } from '../ui'
import { useToast } from '../../components/Toast'
import { scanFromResultDetail } from '../../lib/scanRecord'
import { EXPORT_FORMATS, downloadScan } from '../../lib/export'

export default function ResultDetailPage() {
  const { id } = useParams()
  const rid = Number(id)
  const nav = useNavigate()
  const toast = useToast()

  const load = useLoad<ResultDetail>(
    () => resultsApi.get(rid),
    { id: rid, examId: 0, paperId: 0, fileId: 0, uTime: 0, candidateNumber: null, score: 0, maxScore: 0, details: {} },
    [rid],
  )

  const details = useMemo(() => {
    const entries = Object.entries(load.data.details ?? {})
    return entries.sort((a, b) => num(a[0]) - num(b[0]))
  }, [load.data.details])

  const maxScore = load.data.maxScore ?? sumPoints(details)
  const pct = maxScore ? Math.round((load.data.score / maxScore) * 100) : 0
  const correct = details.filter(([, d]) => d.correct).length
  const wrong = details.filter(([, d]) => d.correct === false).length
  const uncertain = details.filter(([, d]) => d.uncertain).length

  return (
    <Page
      title="成绩详情"
      sub={`RESULT #${rid}`}
      back
      actions={load.demo ? <DemoTag /> : undefined}
    >
      {load.error && <ErrorBar text={load.error} onRetry={load.reload} />}

      {load.loading ? (
        <div className="space-y-3">
          <Skeleton h={150} r={24} />
          <Skeleton h={220} r={22} />
        </div>
      ) : (
        <>
          <section className="mo-hero">
            <div className="relative z-10 flex items-center gap-4">
              <div>
                <p className="text-[10px] font-extrabold tracking-[.18em] text-white/70">
                  {load.data.examName ?? `考试 #${load.data.examId}`}
                </p>
                <p className="mo-num mt-1 text-[34px] font-black leading-none">
                  {load.data.score}
                  <span className="ml-1 text-[13px] font-bold text-white/70">/ {maxScore || '—'}</span>
                </p>
                <p className="mt-1.5 text-[10px] font-bold text-white/75">
                  考号 {load.data.candidateNumber ?? '未识别'} · {fmtTime(load.data.uTime)}
                </p>
              </div>
              <div className="ml-auto">
                <Ring value={pct} max={100} size={74} stroke={8} label={`${pct}%`} sub="得分率" />
              </div>
            </div>
          </section>

          <div className="mt-3 grid grid-cols-3 gap-2">
            <MiniTile num={correct} label="答对" tone="ok" />
            <MiniTile num={wrong} label="答错" tone="bad" />
            <MiniTile num={uncertain} label="存疑" tone="warn" />
          </div>

          <Card className="mt-3 flex items-center gap-2 !py-3">
            <IcFile style={{ fontSize: 15 }} className="text-brand-600" />
            <span className="mo-muted min-w-0 flex-1 truncate">
              {load.data.paperName ?? '答题卡'} · 文件 #{load.data.fileId}
            </span>
            <button
              type="button"
              className="flex-none text-[10.5px] font-extrabold text-brand-700"
              onClick={() => nav(`/m/papers/${load.data.paperId}`)}
            >
              看试卷
            </button>
          </Card>

          <Card className="mt-3 !p-3">
            <p className="mo-eyebrow mb-2">导出成绩单</p>
            <div className="grid grid-cols-3 gap-2">
              {EXPORT_FORMATS.map((f) => (
                <button
                  key={f.key}
                  type="button"
                  className="mo-btn mo-btn-ghost mo-btn-sm"
                  onClick={() => {
                    downloadScan(scanFromResultDetail(load.data), f.key)
                    toast(`已导出 ${f.label}`, 'ok')
                  }}
                >
                  <IcFile style={{ fontSize: 13 }} /> {f.label}
                </button>
              ))}
            </div>
          </Card>

          <p className="mo-eyebrow mt-5 mb-2">逐题明细</p>
          {details.length === 0 ? (
            <div className="mo-empty">
              <div className="mo-empty-ico">
                <IcAlert style={{ fontSize: 24 }} />
              </div>
              <p className="text-[13px] font-extrabold">没有题目明细</p>
              <p className="mo-muted mx-auto mt-1.5 max-w-[240px]">这份记录可能只保存了总分</p>
            </div>
          ) : (
            <div className="space-y-1.5">
              {details.map(([qid, d], i) => (
                <QuestionRow key={qid} qid={qid} d={d} delay={i} />
              ))}
            </div>
          )}

          <button
            type="button"
            className="mt-4 w-full rounded-xl bg-brand-50 px-3 py-2 text-[11.5px] font-extrabold text-brand-700"
            onClick={() => nav('/m/reviews')}
          >
            去人工复核
          </button>
          <p className="mt-2 flex items-center justify-center gap-1.5 text-[10px] text-ink-soft/50">
            <IcSpark style={{ fontSize: 11 }} /> 存疑题建议人工复核
          </p>
        </>
      )}
    </Page>
  )
}

function QuestionRow({ qid, d, delay }: { qid: string; d: QuestionDetail; delay: number }) {
  const state = d.correct === true ? 'ok' : d.correct === false ? 'bad' : 'warn'
  return (
    <div
      className="mo-card mo-stagger flex items-center gap-2.5 !rounded-2xl !px-3 !py-2.5"
      style={{ '--i': delay } as React.CSSProperties}
    >
      <span className="grid h-7 w-7 flex-none place-items-center rounded-lg bg-brand-100 text-[10px] font-black text-brand-800">
        {qid.replace(/^q/i, '')}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className="text-[11.5px] font-extrabold">
            你的答案 <span className="text-brand-800">{d.answer ?? '空'}</span>
          </span>
          {d.uncertain && <span className="mo-badge" data-tone="warn">存疑</span>}
        </span>
        <span className="mo-muted block">
          标准 {d.expected ?? '—'} · 得分 {d.score ?? 0}/{d.points ?? 0}
        </span>
      </span>
      <span
        className="grid h-6 w-6 flex-none place-items-center rounded-full"
        style={
          state === 'ok'
            ? { background: '#e8f8f1', color: '#1a7a55' }
            : state === 'bad'
              ? { background: '#fff1f1', color: '#d94a4a' }
              : { background: '#fff5e2', color: '#9a6413' }
        }
      >
        {state === 'ok' ? <IcCheck style={{ fontSize: 13 }} /> : <IcX style={{ fontSize: 12 }} />}
      </span>
    </div>
  )
}

function MiniTile({ num, label, tone }: { num: number; label: string; tone: 'ok' | 'bad' | 'warn' }) {
  const color = tone === 'ok' ? '#1a7a55' : tone === 'bad' ? '#d94a4a' : '#9a6413'
  const bg = tone === 'ok' ? '#f2fdf8' : tone === 'bad' ? '#fff6f8' : '#fffaf0'
  return (
    <div className="rounded-2xl border border-brand-100 px-2 py-2.5 text-center" style={{ background: bg }}>
      <p className="mo-num text-[19px] font-black leading-none" style={{ color }}>
        {num}
      </p>
      <p className="mt-1 text-[9.5px] font-bold text-ink-soft/70">{label}</p>
    </div>
  )
}

function num(qid: string): number {
  const m = qid.match(/(\d+)/)
  return m ? Number(m[1]) : 0
}

function sumPoints(details: [string, QuestionDetail][]): number {
  return details.reduce((s, [, d]) => s + (d.points ?? 0), 0)
}

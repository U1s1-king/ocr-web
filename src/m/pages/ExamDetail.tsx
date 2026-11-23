import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useConfirm } from '../../components/Confirm'
import { useToast } from '../../components/Toast'
import {
  examsApi,
  type ExamResults,
  type ExamSummary,
  type GradeResponse,
} from '../api'
import { IcAlert, IcCalendar, IcCamera, IcFile, IcLayers, IcTrash, IcUpload, IcX } from '../icons'
import { FilePicker } from '../pickers'
import { Bar, Btn, DemoTag, Empty, ErrorBar, ListSkeleton, Page, Ring, Skeleton, StatTile, fmtTime, useLoad } from '../ui'

export default function ExamDetail() {
  const { id } = useParams()
  const eid = Number(id)
  const nav = useNavigate()
  const toast = useToast()
  const confirm = useConfirm()

  const emptyExam: ExamSummary = { id: eid, name: '', paperId: 0, paperName: '', uTime: 0, resultCount: 0 }
  const exam = useLoad<ExamSummary>(() => examsApi.get(eid), emptyExam, [eid])
  const results = useLoad<ExamResults>(
    () => examsApi.results(eid),
    { examId: eid, examName: '', paperId: 0, paperName: '', results: [] },
    [eid],
  )

  const [pickOpen, setPickOpen] = useState(false)
  const [grading, setGrading] = useState(false)
  const [grade, setGrade] = useState<GradeResponse | null>(null)

  const rows = results.data.results ?? []
  const scored = rows.filter((r) => (r.maxScore ?? 0) > 0)
  const maxScore = scored[0]?.maxScore ?? 0
  const avg = rows.length ? rows.reduce((s, r) => s + r.score, 0) / rows.length : 0
  const best = rows.reduce((m, r) => Math.max(m, r.score), 0)

  async function runGrade(ids: number[]) {
    setGrading(true)
    try {
      const res = await examsApi.grade(eid, ids)
      setGrade(res)
      results.reload()
      exam.reload()
      toast(`批改完成 ${res.successCount}/${res.total}`, res.failureCount ? 'err' : 'ok')
    } catch (err) {
      setGrade({
        examId: eid,
        examName: exam.data.name,
        paperId: (exam.data as { paperId?: number }).paperId ?? 0,
        paperName: (exam.data as { paperName?: string }).paperName ?? '',
        totalScore: 0,
        total: ids.length,
        successCount: 0,
        failureCount: ids.length,
        results: ids.map((fileId) => ({
          fileId,
          success: false,
          code: 'CHECK_FAILED',
          error: err instanceof Error ? err.message : '批改失败',
        })),
      })
      toast(err instanceof Error ? err.message : '批改失败', 'err')
    } finally {
      setGrading(false)
    }
  }

  async function remove() {
    const ok = await confirm({
      title: `删除「${exam.data.name}」？`,
      description: '这场考试的全部成绩记录会一起删除，试卷和文件不受影响。',
      confirmText: '删除考试',
      tone: 'danger',
    })
    if (!ok) return
    try {
      await examsApi.remove(eid)
      toast('考试已删除', 'ok')
      nav('/m/exams', { replace: true })
    } catch (err) {
      toast(err instanceof Error ? err.message : '删除失败', 'err')
    }
  }

  return (
    <Page
      title={exam.data.name}
      sub={`EXAM #${eid}`}
      back
      actions={
        <div className="flex gap-2">
          {(exam.demo || results.demo) && <DemoTag />}
          <button type="button" className="mo-chip" onClick={() => nav(`/m/capture?examId=${eid}`)}>
            <IcCamera style={{ fontSize: 14 }} /> 拍照批改
          </button>
          <button type="button" className="mo-icon-btn" aria-label="删除考试" onClick={remove}>
            <IcTrash style={{ fontSize: 16 }} />
          </button>
        </div>
      }
    >
      {(exam.error || results.error) && (
        <ErrorBar text={exam.error || results.error} onRetry={() => { exam.reload(); results.reload() }} />
      )}

      {exam.loading ? (
        <Skeleton h={120} r={24} />
      ) : (
        <section className="mo-hero">
          <div className="relative z-10">
            <p className="text-[10px] font-extrabold tracking-[.18em] text-white/70">成绩概览</p>
            <div className="mt-2 flex items-end gap-3">
              <div>
                <p className="mo-num text-[36px] font-black leading-none">{rows.length ? Math.round(avg) : '—'}</p>
                <p className="mt-1 text-[10px] font-bold text-white/75">
                  平均分 · 共 {rows.length} 份 · 最高 {best}
                </p>
              </div>
              <div className="ml-auto">
                <Ring
                  value={maxScore ? Math.round((best / maxScore) * 100) : 0}
                  max={100}
                  size={64}
                  stroke={7}
                  label={`${maxScore ? Math.round((best / maxScore) * 100) : 0}%`}
                  sub="最高得分率"
                />
              </div>
            </div>
            <div className="mt-3 flex items-center gap-2 text-[10px] font-bold text-white/75">
              <IcLayers style={{ fontSize: 12 }} /> {exam.data.paperName}
              <span className="opacity-50">·</span>
              {fmtTime(exam.data.uTime)}
            </div>
          </div>
        </section>
      )}

      <div className="mt-3 flex gap-2">
        <Btn block disabled={grading} onClick={() => setPickOpen(true)}>
          <IcUpload style={{ fontSize: 16 }} /> {grading ? '批改中…' : '批量批改'}
        </Btn>
        <Btn block variant="ghost" onClick={() => nav('/m/capture')}>
          <IcCamera style={{ fontSize: 16 }} /> 拍照
        </Btn>
      </div>

      <div className="mo-tiles mt-3">
        <StatTile num={rows.length} label="成绩记录" delay={1} />
        <StatTile num={maxScore || '—'} label="单张满分" delay={2} />
      </div>

      <div className="mt-5 mb-2 flex items-center justify-between">
        <p className="mo-eyebrow">成绩列表</p>
        <button
          type="button"
          className="text-[10px] font-extrabold text-brand-700/70"
          onClick={() => nav(`/m/results?examId=${eid}`)}
        >
          在成绩页查看
        </button>
      </div>

      {results.loading ? (
        <ListSkeleton rows={4} />
      ) : rows.length === 0 ? (
        <Empty
          icon={<IcFile style={{ fontSize: 24 }} />}
          title="这场考试还没有成绩"
          tip="把答题卡照片上传成文件，再点「批量批改」"
          action={
            <Btn onClick={() => setPickOpen(true)}>
              <IcUpload style={{ fontSize: 16 }} /> 选文件批改
            </Btn>
          }
        />
      ) : (
        <div className="space-y-2">
          {rows.map((r, i) => {
            const pct = (r.maxScore ?? maxScore) ? Math.round((r.score / (r.maxScore ?? maxScore)) * 100) : 0
            return (
              <button
                key={r.id}
                type="button"
                className="mo-card mo-stagger w-full !p-3.5 text-left"
                style={{ '--i': i } as React.CSSProperties}
                onClick={() => nav(`/m/results/${r.id}`)}
              >
                <div className="flex items-center gap-2">
                  <span className="mo-row-ico">
                    <IcCalendar style={{ fontSize: 16 }} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[12.5px] font-extrabold">
                      {r.candidateNumber ?? '未知考号'}
                    </span>
                    <span className="mo-muted block">{fmtTime(r.uTime)} · 文件 #{r.fileId}</span>
                  </span>
                  <span className="mo-num text-[16px] font-black text-brand-800">{r.score}</span>
                </div>
                <div className="mt-2.5">
                  <Bar pct={pct} delay={i * 50} />
                </div>
              </button>
            )
          })}
        </div>
      )}

      <button
        type="button"
        className="mt-4 w-full text-center text-[11px] font-bold text-brand-700/60"
        onClick={() => nav(`/m/papers/${exam.data.paperId}`)}
      >
        查看使用的试卷
      </button>

      <FilePicker open={pickOpen} onClose={() => setPickOpen(false)} onPick={(ids) => void runGrade(ids)} />

      {grade && (
        <>
          <div className="mo-backdrop" onClick={() => setGrade(null)} />
          <div className="mo-sheet" role="dialog" aria-modal="true">
            <div className="mo-sheet-grip" />
            <div className="mo-sheet-head">
              <h2 className="mo-h2">批改结果</h2>
              <button type="button" className="mo-icon-btn" aria-label="关闭" onClick={() => setGrade(null)} style={{ width: 32, height: 32 }}>
                <IcX style={{ fontSize: 15 }} />
              </button>
            </div>
            <div className="mo-sheet-body">
              <div className="flex items-center gap-2 rounded-2xl bg-brand-50 p-3">
                <span className="mo-badge" data-tone={grade.failureCount ? 'warn' : 'ok'}>
                  成功 {grade.successCount}
                </span>
                <span className="mo-badge">失败 {grade.failureCount}</span>
                <span className="ml-auto text-[11px] font-extrabold text-brand-800">总分 {grade.totalScore}</span>
              </div>
              <div className="mt-3 space-y-2">
                {grade.results.map((g) => (
                  <div key={g.fileId} className="rounded-2xl border border-brand-200 bg-white p-3">
                    <div className="flex items-center gap-2">
                      <IcFile style={{ fontSize: 13 }} className="text-brand-600" />
                      <span className="truncate text-[11.5px] font-extrabold">文件 #{g.fileId}</span>
                      <span className="ml-auto text-[10px] font-bold" style={{ color: g.success ? '#1a7a55' : '#b5643a' }}>
                        {g.success ? `${g.score}/${g.maxScore ?? '—'}` : '失败'}
                      </span>
                    </div>
                    {g.success ? (
                      <p className="mo-muted mt-1">
                        考号 {g.candidateNumber ?? '未识别'} · 正确 {g.correctCount ?? 0}/{g.gradedCount ?? 0}
                      </p>
                    ) : (
                      <p className="mo-muted mt-1">{g.error ?? g.code ?? '批改失败'}</p>
                    )}
                    {g.success && g.resultId && (
                      <button
                        type="button"
                        className="mt-2 text-[10.5px] font-extrabold text-brand-700"
                        onClick={() => {
                          setGrade(null)
                          nav(`/m/results/${g.resultId}`)
                        }}
                      >
                        查看这份成绩
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}

      {exam.demo && (
        <p className="mt-5 flex items-center gap-1.5 text-[10px] text-ink-soft/50">
          <IcAlert style={{ fontSize: 12 }} /> 演示模式：批改需要后端在线
        </p>
      )}
    </Page>
  )
}

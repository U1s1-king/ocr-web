import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useConfirm } from '../../components/Confirm'
import { useToast } from '../../components/Toast'
import { papersApi, type CheckResponse, type PaperDetail as PD, type PaperJson } from '../api'
import { IcAlert, IcCheck, IcFile, IcLayers, IcPen, IcTarget, IcTrash, IcX } from '../icons'
import { FilePicker, PaperPreview } from '../pickers'
import { Btn, Card, Chip, DemoTag, ErrorBar, Page, Skeleton, StatTile, fmtTime, useLoad } from '../ui'

export default function PaperDetail() {
  const { id } = useParams()
  const pid = Number(id)
  const nav = useNavigate()
  const toast = useToast()
  const confirm = useConfirm()

  const fallback: PD = { id: pid, name: `试卷 #${pid}`, paper: {} }
  const load = useLoad<PD>(() => papersApi.get(pid), fallback, [pid])

  const paper = (load.data.paper ?? {}) as PaperJson
  const questions = paper.questions ?? []
  const answerKey = paper.answerKey ?? {}

  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [editOpen, setEditOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [pickOpen, setPickOpen] = useState(false)
  const [check, setCheck] = useState<CheckResponse | null>(null)

  useEffect(() => {
    setAnswers(answerKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load.data.id, Object.keys(answerKey).length])

  const filled = useMemo(() => Object.values(answers).filter(Boolean).length, [answers])

  async function saveAnswers() {
    setSaving(true)
    try {
      await papersApi.setAnswers(pid, answers)
      toast('标准答案已保存', 'ok')
      setEditOpen(false)
      load.reload()
    } catch (err) {
      toast(err instanceof Error ? err.message : '保存失败', 'err')
    } finally {
      setSaving(false)
    }
  }

  async function runCheck(ids: number[]) {
    try {
      const res = await papersApi.check(pid, ids)
      setCheck(res)
    } catch (err) {
      const text = err instanceof Error ? err.message : '识别失败'
      setCheck({
        paperId: pid,
        total: ids.length,
        successCount: 0,
        failureCount: ids.length,
        results: ids.map((fileId) => ({ fileId, success: false, code: 'CHECK_FAILED', error: text })),
      })
    }
  }

  async function remove() {
    const ok = await confirm({
      title: `删除「${load.data.name}」？`,
      description: '引用这张试卷的考试不会自动删除，但将无法再批改。',
      confirmText: '删除试卷',
      tone: 'danger',
    })
    if (!ok) return
    try {
      await papersApi.remove(pid)
      toast('试卷已删除', 'ok')
      nav(-1)
    } catch (err) {
      toast(err instanceof Error ? err.message : '删除失败', 'err')
    }
  }

  return (
    <Page
      title={load.data.name}
      sub={`PAPER #${pid}`}
      back
      actions={load.demo ? <DemoTag /> : undefined}
    >
      {load.error && <ErrorBar text={load.error} onRetry={load.reload} />}

      {load.loading ? (
        <div className="space-y-3">
          <Skeleton h={220} r={22} />
          <Skeleton h={64} r={18} />
        </div>
      ) : (
        <>
          <Card className="!p-3">
            <PaperPreview paper={paper} tall />
            <div className="mt-3 flex items-center gap-2">
              <span className="mo-muted flex items-center gap-1">
                <IcFile style={{ fontSize: 12 }} /> 试卷 #{pid}
              </span>
              <span className="mo-muted ml-auto">更新于 {fmtTime((load.data as { uTime?: number }).uTime)}</span>
            </div>
          </Card>

          <div className="mo-tiles mt-3">
            <StatTile num={questions.length} label="题目区域" />
            <StatTile num={`${filled}/${questions.length}`} label="标准答案" />
          </div>

          <p className="mo-eyebrow mt-5 mb-2">操作</p>
          <div className="space-y-2">
            <ActionRow
              icon={<IcLayers style={{ fontSize: 17 }} />}
              title="编辑题目区域"
              sub={questions.length ? `已配 ${questions.length} 个区域，可再调` : '批量生成题目框和四角标定'}
              onClick={() => nav(`/m/papers/${pid}/edit`)}
            />
            <ActionRow
              icon={<IcPen style={{ fontSize: 17 }} />}
              title="设置标准答案"
              sub={filled === questions.length && questions.length > 0 ? '已全部填好' : `还差 ${Math.max(0, questions.length - filled)} 题`}
              onClick={() => setEditOpen(true)}
            />
            <ActionRow
              icon={<IcTarget style={{ fontSize: 17 }} />}
              title="批改测试"
              sub="选几张已上传的答题卡，只看识别结果"
              onClick={() => setPickOpen(true)}
            />
            <ActionRow
              icon={<IcTrash style={{ fontSize: 17 }} />}
              title="删除试卷"
              sub="不可恢复，考试记录会保留"
              danger
              onClick={remove}
            />
          </div>

          {check && (
            <Card className="mo-pop mt-4">
              <div className="flex items-center gap-2">
                <p className="text-[13px] font-extrabold">识别结果</p>
                <span className="mo-badge" data-tone={check.failureCount ? 'warn' : 'ok'}>
                  {check.successCount}/{check.total} 成功
                </span>
                <button type="button" className="ml-auto" aria-label="关闭" onClick={() => setCheck(null)}>
                  <IcX style={{ fontSize: 15 }} className="text-ink-soft/50" />
                </button>
              </div>
              <div className="mt-3 space-y-2">
                {check.results.map((r) => (
                  <div key={r.fileId} className="rounded-xl bg-brand-50/70 p-2.5">
                    <div className="flex items-center gap-2">
                      <IcFile style={{ fontSize: 13 }} className="text-brand-600" />
                      <span className="truncate text-[11.5px] font-extrabold">文件 #{r.fileId}</span>
                      <span className="ml-auto text-[10px] font-bold" style={{ color: r.success ? '#1a7a55' : '#b5643a' }}>
                        {r.success ? '识别成功' : '失败'}
                      </span>
                    </div>
                    {r.success ? (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {Object.entries(r.answers ?? {}).slice(0, 12).map(([qid, ans]) => (
                          <span key={qid} className="rounded-lg bg-white px-2 py-0.5 text-[10px] font-bold text-brand-800">
                            {qid.replace(/^q/, '')}:{ans ?? '—'}
                          </span>
                        ))}
                        {Object.keys(r.answers ?? {}).length === 0 && <span className="mo-muted">没有读出答案</span>}
                      </div>
                    ) : (
                      <p className="mo-muted mt-1">{r.error ?? r.code ?? '识别失败'}</p>
                    )}
                  </div>
                ))}
              </div>
            </Card>
          )}

          {load.demo && (
            <p className="mt-4 flex items-center gap-1.5 text-[10px] text-ink-soft/50">
              <IcAlert style={{ fontSize: 12 }} /> 演示模式：写操作需要后端在线
            </p>
          )}
        </>
      )}

      {/* 答案编辑 */}
      {editOpen && (
        <>
          <div className="mo-backdrop" onClick={() => setEditOpen(false)} />
          <div className="mo-sheet" role="dialog" aria-modal="true">
            <div className="mo-sheet-grip" />
            <div className="mo-sheet-head">
              <h2 className="mo-h2">设置标准答案</h2>
              <button type="button" className="mo-icon-btn" aria-label="关闭" onClick={() => setEditOpen(false)} style={{ width: 32, height: 32 }}>
                <IcX style={{ fontSize: 15 }} />
              </button>
            </div>
            <div className="mo-sheet-body">
              {questions.length === 0 ? (
                <div className="py-6 text-center">
                  <p className="mo-muted">这张试卷还没有题目区域</p>
                  <div className="mt-3 flex justify-center">
                    <Btn
                      sm
                      onClick={() => {
                        setEditOpen(false)
                        nav(`/m/papers/${pid}/edit`)
                      }}
                    >
                      去编辑区域
                    </Btn>
                  </div>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {questions.map((q) => {
                    const letters = q.choices?.length
                      ? q.choices.map((c) => c.value)
                      : ['A', 'B', 'C', 'D']
                    return (
                      <div key={q.id} className="rounded-2xl border border-brand-200 bg-white p-2.5">
                        <div className="flex items-center gap-2">
                          <span className="grid h-6 w-6 place-items-center rounded-lg bg-brand-100 text-[10px] font-black text-brand-800">
                            {q.displayNumber ?? q.id.replace(/^q/, '')}
                          </span>
                          <span className="mo-muted">#{q.id}</span>
                          <span className="ml-auto text-[10px] font-bold text-brand-700">
                            {answers[q.id] ?? '未设'}
                          </span>
                        </div>
                        <div className="mt-2 flex gap-1.5">
                          {letters.map((l) => (
                            <Chip
                              key={l}
                              active={answers[q.id] === l}
                              onClick={() =>
                                setAnswers((prev) => ({ ...prev, [q.id]: prev[q.id] === l ? '' : l }))
                              }
                            >
                              {l}
                            </Chip>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
            <div className="px-[18px] pb-5 pt-2">
              <Btn block disabled={saving || questions.length === 0} onClick={saveAnswers}>
                {saving ? '保存中…' : `保存答案 · ${filled}/${questions.length}`}
              </Btn>
            </div>
          </div>
        </>
      )}

      <FilePicker
        open={pickOpen}
        onClose={() => setPickOpen(false)}
        onPick={(ids) => void runCheck(ids)}
        selected={[]}
      />
    </Page>
  )
}

function ActionRow({
  icon,
  title,
  sub,
  onClick,
  danger,
}: {
  icon: React.ReactNode
  title: string
  sub: string
  onClick: () => void
  danger?: boolean
}) {
  return (
    <button
      type="button"
      className="flex w-full items-center gap-3 rounded-2xl border border-brand-200 bg-white p-3.5 text-left active:scale-[.99]"
      onClick={onClick}
    >
      <span
        className="grid h-9 w-9 flex-none place-items-center rounded-xl"
        style={danger ? { background: '#fff1f1', color: '#d94a4a' } : { background: '#f2f4f7', color: '#3f4650' }}
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[12.5px] font-extrabold">{title}</span>
        <span className="mo-muted block">{sub}</span>
      </span>
      <IcCheck style={{ fontSize: 14, opacity: 0 }} />
    </button>
  )
}

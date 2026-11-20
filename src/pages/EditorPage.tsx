import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { errorText } from '../api/client'
import { getExam, putExam } from '../api/exams'
import type { Block, ExamContent, Question } from '../api/types'
import { useConfirm } from '../components/Confirm'
import { ExamCanvas } from '../components/ExamCanvas'
import { useToast } from '../components/Toast'
import { ArrowLeftIcon, PlusIcon, SaveIcon, TrashIcon } from '../components/icons'
import { Badge, Button, Card, Field, SectionTitle, Spinner, inputCls } from '../components/ui'
import { createBlankExam, isBlank, uid, validateExamContent } from '../lib/exam'
import { upsertIndex } from './ExamsPage'

const LS_DRAFT = 'ac.draft.'

export default function EditorPage() {
  const { id } = useParams()
  const examId = Number(id)
  const toast = useToast()
  const nav = useNavigate()
  const confirm = useConfirm()

  const [content, setContent] = useState<ExamContent | null>(null)
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [selected, setSelected] = useState<string | null>(null)
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    let alive = true
    async function load() {
      setLoading(true)
      try {
        const e = await getExam(examId)
        if (!alive) return
        setName(e.name)
        upsertIndex(e.id, e.name)
        if (isBlank(e.exam)) {
          const draft = localStorage.getItem(LS_DRAFT + examId)
          setContent(draft ? (JSON.parse(draft) as ExamContent) : createBlankExam())
        } else {
          setContent(e.exam as ExamContent)
        }
      } catch (err) {
        toast(errorText(err), 'err')
      } finally {
        if (alive) setLoading(false)
      }
    }
    if (Number.isFinite(examId)) void load()
    return () => {
      alive = false
    }
  }, [examId, toast])

  function patch(updater: (c: ExamContent) => ExamContent) {
    setContent((c) => (c ? updater(c) : c))
    setDirty(true)
  }

  const errors = useMemo(() => (content ? validateExamContent(content) : []), [content])

  async function handleSave() {
    if (!content) return
    if (errors.length) {
      toast(`还有 ${errors.length} 处问题需要修正`, 'err')
      return
    }
    setSaving(true)
    try {
      await putExam(examId, content)
      localStorage.removeItem(LS_DRAFT + examId)
      setDirty(false)
      toast('试卷已保存', 'ok')
    } catch (err) {
      toast(errorText(err), 'err')
    } finally {
      setSaving(false)
    }
  }

  function saveDraft() {
    if (!content) return
    localStorage.setItem(LS_DRAFT + examId, JSON.stringify(content))
    toast('已暂存到本机草稿', 'info')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-24 text-sm text-ink-soft">
        <Spinner /> 正在读取试卷…
      </div>
    )
  }

  if (!content) {
    return (
      <Card className="py-16 text-center">
        <p className="text-sm font-bold text-ink">无法加载试卷 #{id}</p>
        <p className="mt-2 text-xs text-ink-soft">请确认 id 正确，并检查接口地址与令牌。</p>
        <Button className="mt-5" onClick={() => nav('/exams')}>
          返回试卷管理
        </Button>
      </Card>
    )
  }

  return (
    <div className="anim-page-in space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <Link
          to="/exams"
          className="flex items-center gap-1.5 rounded-xl border border-brand-200 bg-white px-3 py-2 text-xs font-semibold text-ink-soft transition hover:bg-brand-50"
        >
          <ArrowLeftIcon className="h-3.5 w-3.5" />
          返回
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg font-black text-ink">{name || `试卷 #${examId}`}</h1>
          <p className="font-mono text-[11px] text-ink-soft/50">id #{examId}</p>
        </div>
        <div className="flex items-center gap-2">
          {dirty && <Badge tone="warn">未保存</Badge>}
          {errors.length > 0 ? (
            <Badge tone="err">{errors.length} 处待修正</Badge>
          ) : (
            <Badge tone="ok">校验通过</Badge>
          )}
          <Button variant="ghost" size="sm" onClick={saveDraft}>
            暂存草稿
          </Button>
          <Button onClick={handleSave} disabled={saving} size="sm">
            {saving ? <Spinner /> : <SaveIcon className="h-4 w-4" />}
            保存
          </Button>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-4">
          <ExamCanvas content={content} selectedId={selected} onSelect={setSelected} />
          {errors.length > 0 && (
            <Card className="border-red-200 bg-red-50/60">
              <ul className="space-y-1 text-xs text-red-600">
                {errors.slice(0, 8).map((e, i) => (
                  <li key={i}>· {e}</li>
                ))}
                {errors.length > 8 && <li className="text-red-400">…共 {errors.length} 条</li>}
              </ul>
            </Card>
          )}
        </div>

        <div className="space-y-4">
          <CanvasPanel content={content} patch={patch} />
          <MarkerPanel content={content} patch={patch} />
          <BlockPanel content={content} patch={patch} selected={selected} setSelected={setSelected} />
          <QuestionPanel
            content={content}
            patch={patch}
            selected={selected}
            setSelected={setSelected}
            onDelete={(qid) => {
              void (async () => {
                const ok = await confirm({ title: `删除小题 ${qid}？`, tone: 'danger', confirmText: '删除' })
                if (!ok) return
                patch((c) => {
                  const answerKey = { ...(c.answerKey ?? {}) }
                  delete answerKey[qid]
                  return { ...c, questions: c.questions.filter((q) => q.id !== qid), answerKey }
                })
              })()
            }}
          />
          <AnswerKeyPanel content={content} patch={patch} />
          <BarcodePanel content={content} patch={patch} />
        </div>
      </div>
    </div>
  )
}

/* ---------------- 画布 ---------------- */

function Num({
  value,
  onChange,
  step = 0.1,
  min,
  max,
}: {
  value: number
  onChange: (v: number) => void
  step?: number
  min?: number
  max?: number
}) {
  return (
    <input
      type="number"
      className={inputCls}
      value={Number.isFinite(value) ? value : 0}
      step={step}
      min={min}
      max={max}
      onChange={(e) => {
        const v = Number(e.target.value)
        onChange(Number.isFinite(v) ? v : 0)
      }}
    />
  )
}

function CanvasPanel({ content, patch }: { content: ExamContent; patch: (u: (c: ExamContent) => ExamContent) => void }) {
  return (
    <Card>
      <SectionTitle extra={<Badge tone="mute">unit: canvas</Badge>}>画布</SectionTitle>
      <div className="grid grid-cols-2 gap-3">
        <Field label="宽度">
          <Num
            value={content.canvas.width}
            min={10}
            onChange={(v) => patch((c) => ({ ...c, canvas: { ...c.canvas, width: v } }))}
          />
        </Field>
        <Field label="高度">
          <Num
            value={content.canvas.height}
            min={10}
            onChange={(v) => patch((c) => ({ ...c, canvas: { ...c.canvas, height: v } }))}
          />
        </Field>
      </div>
      <div className="mt-3 flex gap-2">
        <Button variant="ghost" size="sm" onClick={() => patch((c) => ({ ...c, canvas: { width: 300, height: 424.26 } }))}>
          A4 比例
        </Button>
        <Button variant="ghost" size="sm" onClick={() => patch((c) => ({ ...c, canvas: { width: 300, height: 300 } }))}>
          正方形
        </Button>
      </div>
    </Card>
  )
}

/* ---------------- 定位块 ---------------- */

function MarkerPanel({ content, patch }: { content: ExamContent; patch: (u: (c: ExamContent) => ExamContent) => void }) {
  return (
    <Card>
      <SectionTitle extra={<Badge tone={content.markers?.length === 4 ? 'ok' : 'err'}>{content.markers?.length ?? 0}/4</Badge>}>
        四角定位块
      </SectionTitle>
      <p className="mb-3 text-[11px] leading-relaxed text-ink-soft/70">
        扫描时用于透视校正。四个 id 必须齐全且不重复。
      </p>
      <div className="space-y-2">
        {(content.markers ?? []).map((m, i) => (
          <div key={m.id} className="grid grid-cols-[1fr_1fr_1fr_auto] items-center gap-2">
            <span className="truncate text-[11px] font-semibold text-ink-soft">{m.id}</span>
            <Num value={m.x} onChange={(v) => patch((c) => { const a = [...c.markers]; a[i] = { ...a[i], x: v }; return { ...c, markers: a } })} />
            <Num value={m.y} onChange={(v) => patch((c) => { const a = [...c.markers]; a[i] = { ...a[i], y: v }; return { ...c, markers: a } })} />
            <Num value={m.size} min={1} onChange={(v) => patch((c) => { const a = [...c.markers]; a[i] = { ...a[i], size: v }; return { ...c, markers: a } })} />
          </div>
        ))}
        <div className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2 text-[10px] text-ink-soft/45">
          <span>id</span>
          <span>x</span>
          <span>y</span>
          <span>size</span>
        </div>
      </div>
    </Card>
  )
}

/* ---------------- 题目 ---------------- */

function QuestionPanel({
  content,
  patch,
  selected,
  setSelected,
  onDelete,
}: {
  content: ExamContent
  patch: (u: (c: ExamContent) => ExamContent) => void
  selected: string | null
  setSelected: (id: string | null) => void
  onDelete: (id: string) => void
}) {
  const [newId, setNewId] = useState('')

  function addQuestion(type: 'mark' | 'subjective') {
    const qid = newId.trim() || uid('q')
    if (content.questions.some((q) => q.id === qid) || content.blocks?.some((b) => b.id === qid)) {
      return
    }
    const lastY = content.questions.reduce((m, q) => Math.max(m, q.region.y + q.region.height), 60)
    const y = Math.min(lastY + 6, content.canvas.height - 30)
    const q: Question =
      type === 'mark'
        ? {
            id: qid,
            displayNumber: content.questions.length + 1,
            type: 'mark',
            region: { x: 18, y, width: 120, height: 10 },
            choices: ['A', 'B', 'C', 'D'].map((v, i) => ({
              value: v,
              region: { x: i * 0.25, y: 0, width: 0.2, height: 1 },
            })),
          }
        : {
            id: qid,
            displayNumber: content.questions.length + 1,
            type: 'subjective',
            region: { x: 18, y, width: 264, height: 24 },
          }
    patch((c) => ({ ...c, questions: [...c.questions, q] }))
    setNewId('')
    setSelected(qid)
  }

  const sel = content.questions.find((q) => q.id === selected)

  return (
    <Card>
      <SectionTitle extra={<Badge tone="brand">{content.questions.length} 题</Badge>}>小题</SectionTitle>

      <div className="mb-3 flex gap-2">
        <input
          className={inputCls}
          placeholder="自定义 id（可留空）"
          value={newId}
          onChange={(e) => setNewId(e.target.value)}
        />
        <Button size="sm" onClick={() => addQuestion('mark')} className="whitespace-nowrap">
          <PlusIcon className="h-3.5 w-3.5" />
          涂卡
        </Button>
        <Button size="sm" variant="soft" onClick={() => addQuestion('subjective')} className="whitespace-nowrap">
          <PlusIcon className="h-3.5 w-3.5" />
          主观
        </Button>
      </div>

      <div className="max-h-56 space-y-1.5 overflow-y-auto pr-1">
        {content.questions.length === 0 && (
          <p className="py-4 text-center text-[11px] text-ink-soft/50">还没有小题，先添加一道吧</p>
        )}
        {content.questions.map((q) => (
          <div
            key={q.id}
            className={`flex items-center gap-2 rounded-xl border px-2.5 py-2 text-xs transition ${
              selected === q.id ? 'border-brand-400 bg-brand-100' : 'border-brand-200/70 bg-white hover:bg-brand-50'
            }`}
          >
            <button type="button" className="flex flex-1 items-center gap-2 text-left" onClick={() => setSelected(q.id)}>
              <span className="font-mono text-[10px] text-ink-soft/50">{q.id}</span>
              <Badge tone={q.type === 'mark' ? 'brand' : 'mute'}>{q.type === 'mark' ? '涂卡' : '主观'}</Badge>
              <span className="ml-auto text-[10px] text-ink-soft/45">
                {q.type === 'mark' ? `${q.choices?.length ?? 0} 选项` : '区域裁切'}
              </span>
            </button>
            <button
              type="button"
              onClick={() => onDelete(q.id)}
              className="rounded-lg p-1 text-ink-soft/35 transition hover:bg-red-50 hover:text-red-500"
            >
              <TrashIcon className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>

      {sel && (
        <div className="mt-4 space-y-3 border-t border-brand-200/70 pt-4">
          <div className="grid grid-cols-2 gap-2">
            <Field label="显示题号">
              <Num
                value={sel.displayNumber ?? 0}
                step={1}
                onChange={(v) =>
                  patch((c) => ({
                    ...c,
                    questions: c.questions.map((q) => (q.id === sel.id ? { ...q, displayNumber: v } : q)),
                  }))
                }
              />
            </Field>
            <Field label="类型">
              <select
                className={inputCls}
                value={sel.type}
                onChange={(e) =>
                  patch((c) => ({
                    ...c,
                    questions: c.questions.map((q) =>
                      q.id === sel.id
                        ? {
                            ...q,
                            type: e.target.value as 'mark' | 'subjective',
                            choices:
                              e.target.value === 'mark'
                                ? q.choices ??
                                  ['A', 'B', 'C', 'D'].map((v, i) => ({
                                    value: v,
                                    region: { x: i * 0.25, y: 0, width: 0.2, height: 1 },
                                  }))
                                : undefined,
                          }
                        : q,
                    ),
                  }))
                }
              >
                <option value="mark">涂卡题</option>
                <option value="subjective">主观题</option>
              </select>
            </Field>
          </div>

          <div className="grid grid-cols-4 gap-2">
            {(['x', 'y', 'width', 'height'] as const).map((k) => (
              <Field key={k} label={k}>
                <Num
                  value={sel.region[k]}
                  onChange={(v) =>
                    patch((c) => ({
                      ...c,
                      questions: c.questions.map((q) =>
                        q.id === sel.id ? { ...q, region: { ...q.region, [k]: v } } : q,
                      ),
                    }))
                  }
                />
              </Field>
            ))}
          </div>

          {sel.type === 'mark' && (
            <div>
              <p className="mb-1.5 text-xs font-semibold text-ink-soft">选项（相对题目区域 0–1）</p>
              <div className="space-y-1.5">
                {sel.choices?.map((ch, i) => (
                  <div key={i} className="grid grid-cols-[0.7fr_1fr_1fr_1fr_auto] gap-1.5">
                    <input
                      className={inputCls}
                      value={ch.value}
                      maxLength={4}
                      onChange={(e) =>
                        patch((c) => ({
                          ...c,
                          questions: c.questions.map((q) => {
                            if (q.id !== sel.id || !q.choices) return q
                            const arr = [...q.choices]
                            arr[i] = { ...arr[i], value: e.target.value }
                            return { ...q, choices: arr }
                          }),
                        }))
                      }
                    />
                    {(['x', 'width'] as const).map((k) => (
                      <Num
                        key={k}
                        value={ch.region[k]}
                        step={0.01}
                        onChange={(v) =>
                          patch((c) => ({
                            ...c,
                            questions: c.questions.map((q) => {
                              if (q.id !== sel.id || !q.choices) return q
                              const arr = [...q.choices]
                              arr[i] = { ...arr[i], region: { ...arr[i].region, [k]: v } }
                              return { ...q, choices: arr }
                            }),
                          }))
                        }
                      />
                    ))}
                    <Num
                      value={ch.region.y}
                      step={0.01}
                      onChange={(v) =>
                        patch((c) => ({
                          ...c,
                          questions: c.questions.map((q) => {
                            if (q.id !== sel.id || !q.choices) return q
                            const arr = [...q.choices]
                            arr[i] = { ...arr[i], region: { ...arr[i].region, y: v } }
                            return { ...q, choices: arr }
                          }),
                        }))
                      }
                    />
                    <button
                      type="button"
                      onClick={() =>
                        patch((c) => ({
                          ...c,
                          questions: c.questions.map((q) =>
                            q.id === sel.id && q.choices
                              ? { ...q, choices: q.choices.filter((_, j) => j !== i) }
                              : q,
                          ),
                        }))
                      }
                      className="rounded-lg p-1 text-ink-soft/35 hover:bg-red-50 hover:text-red-500"
                    >
                      <TrashIcon className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
              <div className="mt-2 flex gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    patch((c) => ({
                      ...c,
                      questions: c.questions.map((q) => {
                        if (q.id !== sel.id) return q
                        const arr = q.choices ?? []
                        const n = arr.length
                        return {
                          ...q,
                          choices: [
                            ...arr,
                            {
                              value: String.fromCharCode(65 + n),
                              region: { x: Math.min(n * 0.2, 0.8), y: 0, width: 0.2, height: 1 },
                            },
                          ],
                        }
                      }),
                    }))
                  }
                >
                  添加选项
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    patch((c) => ({
                      ...c,
                      questions: c.questions.map((q) => {
                        if (q.id !== sel.id) return q
                        const n = q.choices?.length ?? 0
                        if (!n) return q
                        return {
                          ...q,
                          choices: q.choices?.map((ch, i) => ({
                            ...ch,
                            region: { x: i / n, y: 0, width: 1 / n, height: 1 },
                          })),
                        }
                      }),
                    }))
                  }
                >
                  平均分布
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </Card>
  )
}

/* ---------------- 内容块 ---------------- */

function BlockPanel({
  content,
  patch,
  selected,
  setSelected,
}: {
  content: ExamContent
  patch: (u: (c: ExamContent) => ExamContent) => void
  selected: string | null
  setSelected: (id: string | null) => void
}) {
  const blocks = content.blocks ?? []
  const sel = blocks.find((b) => b.id === selected)

  function add() {
    const b: Block = {
      id: uid('b'),
      type: 'text',
      region: { x: 24, y: 21, width: 160, height: 14 },
      text: '标题文字',
      style: { fontSize: 6, fontWeight: 'bold' },
    }
    patch((c) => ({ ...c, blocks: [...(c.blocks ?? []), b] }))
    setSelected(b.id)
  }

  function update(next: Partial<Block>) {
    if (!sel) return
    patch((c) => ({
      ...c,
      blocks: (c.blocks ?? []).map((b) => (b.id === sel.id ? { ...b, ...next } : b)),
    }))
  }

  return (
    <Card>
      <SectionTitle
        extra={
          <Button size="sm" variant="ghost" onClick={add}>
            <PlusIcon className="h-3.5 w-3.5" />
            添加
          </Button>
        }
      >
        内容块
      </SectionTitle>
      <p className="mb-2 text-[11px] leading-relaxed text-ink-soft/70">
        标题、注意事项等展示文字，不参与扫描识别。
      </p>

      <div className="flex flex-wrap gap-1.5">
        {blocks.length === 0 && <p className="py-2 text-[11px] text-ink-soft/50">暂无内容块</p>}
        {blocks.map((b) => (
          <button
            key={b.id}
            type="button"
            onClick={() => setSelected(b.id)}
            className={`max-w-full truncate rounded-lg border px-2 py-1 text-[11px] ${
              selected === b.id ? 'border-brand-400 bg-brand-100 text-brand-800' : 'border-brand-200 text-ink-soft'
            }`}
          >
            {b.text.slice(0, 12) || b.id}
          </button>
        ))}
      </div>

      {sel && (
        <div className="mt-3 space-y-2 border-t border-brand-200/70 pt-3">
          <Field label="文本" hint="支持换行">
            <textarea
              className={`${inputCls} min-h-16 resize-y`}
              value={sel.text}
              onChange={(e) => update({ text: e.target.value })}
            />
          </Field>
          <div className="grid grid-cols-4 gap-2">
            {(['x', 'y', 'width', 'height'] as const).map((k) => (
              <Field key={k} label={k}>
                <Num value={sel.region[k]} onChange={(v) => update({ region: { ...sel.region, [k]: v } })} />
              </Field>
            ))}
          </div>
          <div className="grid grid-cols-3 gap-2">
            <Field label="字号">
              <Num value={sel.style?.fontSize ?? 4} step={0.2} onChange={(v) => update({ style: { ...sel.style, fontSize: v } })} />
            </Field>
            <Field label="加粗">
              <select
                className={inputCls}
                value={sel.style?.fontWeight ?? 'normal'}
                onChange={(e) => update({ style: { ...sel.style, fontWeight: e.target.value as 'normal' | 'bold' } })}
              >
                <option value="normal">正常</option>
                <option value="bold">加粗</option>
              </select>
            </Field>
            <Field label="对齐">
              <select
                className={inputCls}
                value={sel.style?.textAlign ?? 'left'}
                onChange={(e) => update({ style: { ...sel.style, textAlign: e.target.value as 'left' | 'center' | 'right' } })}
              >
                <option value="left">左</option>
                <option value="center">中</option>
                <option value="right">右</option>
              </select>
            </Field>
          </div>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              patch((c) => ({ ...c, blocks: (c.blocks ?? []).filter((b) => b.id !== sel.id) }))
              setSelected(null)
            }}
          >
            <TrashIcon className="h-3.5 w-3.5" />
            删除此块
          </Button>
        </div>
      )}
    </Card>
  )
}

/* ---------------- 答案键 ---------------- */

function AnswerKeyPanel({ content, patch }: { content: ExamContent; patch: (u: (c: ExamContent) => ExamContent) => void }) {
  const marks = content.questions.filter((q) => q.type === 'mark')
  return (
    <Card>
      <SectionTitle extra={<Badge tone="mute">{Object.keys(content.answerKey ?? {}).length} 个</Badge>}>答案键</SectionTitle>
      {marks.length === 0 ? (
        <p className="text-[11px] text-ink-soft/50">先添加涂卡题</p>
      ) : (
        <div className="max-h-48 space-y-1.5 overflow-y-auto pr-1">
          {marks.map((q) => (
            <div key={q.id} className="flex items-center gap-2">
              <span className="w-20 shrink-0 truncate font-mono text-[11px] text-ink-soft">{q.id}</span>
              <select
                className={inputCls}
                value={content.answerKey?.[q.id] ?? ''}
                onChange={(e) =>
                  patch((c) => {
                    const key = { ...(c.answerKey ?? {}) }
                    if (e.target.value) key[q.id] = e.target.value
                    else delete key[q.id]
                    return { ...c, answerKey: key }
                  })
                }
              >
                <option value="">未设置</option>
                {q.choices?.map((ch) => (
                  <option key={ch.value} value={ch.value}>
                    {ch.value}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}

/* ---------------- 条形码 ---------------- */

function BarcodePanel({ content, patch }: { content: ExamContent; patch: (u: (c: ExamContent) => ExamContent) => void }) {
  const b = content.barcode
  return (
    <Card>
      <SectionTitle
        extra={
          <Button
            size="sm"
            variant={b ? 'ghost' : 'soft'}
            onClick={() =>
              patch((c) => ({
                ...c,
                barcode: b
                  ? undefined
                  : {
                      id: 'sheetCode',
                      type: 'code128',
                      value: '20261109001',
                      anchor: 'top-right',
                      offset: { unit: 'canvas', x: 31.43, y: 14.29 },
                      size: { unit: 'canvas', width: 64.29, height: 17.14 },
                    },
              }))
            }
          >
            {b ? '移除' : '启用'}
          </Button>
        }
      >
        条形码
      </SectionTitle>
      {b ? (
        <div className="space-y-2">
          <Field label="内容">
            <input className={inputCls} value={b.value} onChange={(e) => patch((c) => ({ ...c, barcode: { ...b, value: e.target.value } }))} />
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="锚点">
              <select
                className={inputCls}
                value={b.anchor}
                onChange={(e) => patch((c) => ({ ...c, barcode: { ...b, anchor: e.target.value as typeof b.anchor } }))}
              >
                <option value="top-left">左上</option>
                <option value="top-right">右上</option>
                <option value="bottom-left">左下</option>
                <option value="bottom-right">右下</option>
              </select>
            </Field>
            <Field label="偏移 x / y">
              <div className="flex gap-1.5">
                <Num value={b.offset.x} onChange={(v) => patch((c) => ({ ...c, barcode: { ...b, offset: { ...b.offset, x: v } } }))} />
                <Num value={b.offset.y} onChange={(v) => patch((c) => ({ ...c, barcode: { ...b, offset: { ...b.offset, y: v } } }))} />
              </div>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Field label="宽">
              <Num value={b.size.width} onChange={(v) => patch((c) => ({ ...c, barcode: { ...b, size: { ...b.size, width: v } } }))} />
            </Field>
            <Field label="高">
              <Num value={b.size.height} onChange={(v) => patch((c) => ({ ...c, barcode: { ...b, size: { ...b.size, height: v } } }))} />
            </Field>
          </div>
        </div>
      ) : (
        <p className="text-[11px] text-ink-soft/50">未启用条形码</p>
      )}
    </Card>
  )
}

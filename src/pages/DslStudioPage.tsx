import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageHeader } from '../components/PageHeader'
import { AlertIcon, BoltIcon, DownloadIcon, EditIcon, SaveIcon } from '../components/icons'
import { Badge, Button, Card } from '../components/ui'
import { useToast } from '../components/Toast'
import { errorText } from '../api/client'
import { DSL_SAMPLE, buildCardFromDsl, parseSheetDsl } from '../lib/card/dsl'
import { CardSheet } from '../lib/card/render'
import { paperMm, type PaperSize } from '../lib/card/types'
import { createPaperFromDoc, stashDoc } from '../lib/card/store'
import { downloadText } from '../lib/image'

const PX_PER_MM = 96 / 25.4

type RowKind = 'title' | 'subtitle' | 'section' | 'choice' | 'fill' | 'lines' | 'numbered' | 'blank'

interface BuilderRow {
  id: string
  kind: RowKind
  text: string
  value: number
}

interface BuilderConfig {
  paperSize: PaperSize
  split: number
  size: number
}

const QUESTION_KINDS: Array<{ kind: RowKind; code: string; label: string; value: number; unit: string; hint: string }> = [
  { kind: 'choice', code: 'X', label: '选择题', value: 4, unit: '选项', hint: 'X-4 = 4 个选项' },
  { kind: 'fill', code: 'T', label: '填空题', value: 1, unit: '空', hint: 'T-1 = 1 个填空' },
  { kind: 'lines', code: 'L', label: '解答题', value: 8, unit: '行', hint: 'L-8 = 8 行横线' },
  { kind: 'numbered', code: 'B', label: '数字涂卡', value: 3, unit: '位', hint: 'B-3 = 3 位数字' },
  { kind: 'blank', code: 'J', label: '空白区', value: 5, unit: '行', hint: 'J-5 = 5 行空白' },
]

function nextId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
}

function rowsFromDsl(source: string): { rows: BuilderRow[]; config: BuilderConfig } {
  const parsed = parseSheetDsl(source)
  const rows: BuilderRow[] = []
  for (const token of parsed.tokens) {
    if (token.type === 'title' || token.type === 'subtitle' || token.type === 'section') {
      rows.push({ id: nextId('row'), kind: token.type, text: token.text, value: 0 })
    } else if (token.type === 'choice' || token.type === 'fill' || token.type === 'lines' || token.type === 'numbered') {
      rows.push({ id: nextId('row'), kind: token.type, text: '', value: token.count })
    } else if (token.type === 'blankspace') {
      rows.push({ id: nextId('row'), kind: 'blank', text: '', value: token.lines })
    }
  }
  return {
    rows: rows.length ? rows : rowsFromDsl(DSL_SAMPLE).rows,
    config: parsed.config,
  }
}

function dslFromRows(rows: BuilderRow[], config: BuilderConfig): string {
  const lines: string[] = [`# ${config.paperSize}`, `#split ${config.split}`, `#size ${config.size}`, '']
  let n = 1
  for (const row of rows) {
    if (row.kind === 'title') lines.push(`# ${row.text || '试卷标题'}`)
    else if (row.kind === 'subtitle') lines.push(`## ${row.text || '科目 答题卡'}`)
    else if (row.kind === 'section') lines.push(`### ${row.text || '一、大题'}`)
    else {
      const meta = QUESTION_KINDS.find((k) => k.kind === row.kind)
      if (!meta) continue
      lines.push(`${n}. ${meta.code}-${Math.max(1, row.value || meta.value)}`)
      n += 1
    }
  }
  return lines.join('\n')
}

function rowLabel(row: BuilderRow): string {
  if (row.kind === 'title') return '试卷标题'
  if (row.kind === 'subtitle') return '副标题'
  if (row.kind === 'section') return '大题'
  return QUESTION_KINDS.find((k) => k.kind === row.kind)?.label ?? '题目'
}

/** 图形化文本出卡：不用手写 DSL，按题型添加题目并自动编号。 */
export default function DslStudioPage() {
  const nav = useNavigate()
  const toast = useToast()
  const initial = useMemo(() => {
    try {
      return rowsFromDsl(sessionStorage.getItem('ac.dsl.rows.source') || DSL_SAMPLE)
    } catch {
      return rowsFromDsl(DSL_SAMPLE)
    }
  }, [])
  const [rows, setRows] = useState<BuilderRow[]>(initial.rows)
  const [config, setConfig] = useState<BuilderConfig>(initial.config)
  const [name, setName] = useState('DSL 答题卡')
  const [selected, setSelected] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const previewRef = useRef<HTMLDivElement>(null)
  const [zoom, setZoom] = useState(0.45)

  const dsl = useMemo(() => dslFromRows(rows, config), [rows, config])
  const built = useMemo(() => buildCardFromDsl(dsl, { name }), [dsl, name])
  const doc = built.doc
  const dims = paperMm(doc.meta.paperSize, doc.meta.orientation)
  const errors = built.issues.filter((i) => i.level === 'error')

  useEffect(() => {
    try {
      sessionStorage.setItem('ac.dsl.rows.source', dsl)
    } catch {
      /* ignore */
    }
  }, [dsl])

  useEffect(() => {
    const el = previewRef.current
    if (!el) return
    const calc = () => {
      const w = el.clientWidth - 24
      const byW = w / (dims.w * PX_PER_MM)
      const byH = 620 / (dims.h * PX_PER_MM)
      setZoom(Math.max(0.2, Math.min(1, Math.min(byW, byH))))
    }
    calc()
    const ro = new ResizeObserver(calc)
    ro.observe(el)
    return () => ro.disconnect()
  }, [dims.w, dims.h])

  function addRow(kind: RowKind) {
    const index = selected ? rows.findIndex((r) => r.id === selected) : -1
    const meta = QUESTION_KINDS.find((k) => k.kind === kind)
    const row: BuilderRow = {
      id: nextId('row'),
      kind,
      text:
        kind === 'section'
          ? `大题 ${rows.filter((r) => r.kind === 'section').length + 1}`
          : kind === 'title'
            ? '2026年普通高等学校招生全国统一考试'
            : kind === 'subtitle'
              ? '数学 答题卡'
              : '',
      value: meta?.value ?? 1,
    }
    const next = [...rows]
    next.splice(index >= 0 ? index + 1 : next.length, 0, row)
    setRows(next)
    setSelected(row.id)
  }

  function patchRow(id: string, patch: Partial<BuilderRow>) {
    setRows((list) => list.map((r) => (r.id === id ? { ...r, ...patch } : r)))
  }

  function removeRow(id: string) {
    setRows((list) => list.filter((r) => r.id !== id))
    setSelected((cur) => (cur === id ? null : cur))
  }

  function moveRow(id: string, dir: -1 | 1) {
    setRows((list) => {
      const i = list.findIndex((r) => r.id === id)
      const j = i + dir
      if (i < 0 || j < 0 || j >= list.length) return list
      const next = [...list]
      ;[next[i], next[j]] = [next[j], next[i]]
      return next
    })
  }

  async function save() {
    setSaving(true)
    try {
      const res = await createPaperFromDoc(doc, name.trim() || 'DSL 答题卡')
      toast(`已保存为试卷 #${res.id}`, 'ok')
      nav(`/papers/${res.id}/edit`)
    } catch (e) {
      toast(errorText(e), 'err')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <PageHeader
        title="文本出卡（图形化）"
        desc="按题型添加题目，自动编号；支持选择题、填空题、解答题、数字涂卡、空白区。"
        crumb={[{ label: '试卷库', to: '/papers' }, { label: '文本出卡' }]}
        extra={<Badge tone={errors.length ? 'err' : 'ok'}>{errors.length ? `${errors.length} 个错误` : '排布通过'}</Badge>}
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Card className="!p-4">
          <div className="flex flex-wrap items-center gap-2">
            <input
              className="min-w-[180px] flex-1 rounded-xl border border-brand-200 px-3 py-2 text-[12.5px] font-semibold outline-none focus:border-brand-400"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="试卷名称"
              maxLength={100}
            />
            <select
              className="rounded-xl border border-brand-200 bg-white px-2 py-2 text-[12px] font-semibold"
              value={config.paperSize}
              onChange={(e) => setConfig((c) => ({ ...c, paperSize: e.target.value as PaperSize }))}
            >
              <option value="A3">A3</option>
              <option value="A4">A4</option>
            </select>
            <label className="flex items-center gap-1 text-[10.5px] font-bold text-ink-soft">
              栏数
              <input
                type="number"
                min={1}
                max={4}
                value={config.split}
                onChange={(e) => setConfig((c) => ({ ...c, split: Math.max(1, Math.min(4, Number(e.target.value) || 1)) }))}
                className="w-12 rounded-lg border border-brand-200 px-1.5 py-1.5 text-center text-[11px] outline-none"
              />
            </label>
            <Button variant="ghost" size="sm" onClick={() => { const next = rowsFromDsl(DSL_SAMPLE); setRows(next.rows); setConfig(next.config); setSelected(null) }}>
              <BoltIcon className="h-3.5 w-3.5" /> 示例
            </Button>
          </div>

          <div className="mt-3 flex flex-wrap gap-1.5">
            <Button variant="ghost" size="sm" onClick={() => addRow('section')}>+ 大题</Button>
            {QUESTION_KINDS.map((k) => (
              <Button key={k.kind} variant="ghost" size="sm" onClick={() => addRow(k.kind)}>
                + {k.label}
              </Button>
            ))}
          </div>

          <div className="mt-3 max-h-[500px] space-y-1.5 overflow-y-auto pr-1">
            {rows.map((row) => {
              const questionIndex = rows.slice(0, rows.indexOf(row) + 1).filter((r) => r.kind !== 'title' && r.kind !== 'subtitle' && r.kind !== 'section').length
              const meta = QUESTION_KINDS.find((k) => k.kind === row.kind)
              const isText = row.kind === 'title' || row.kind === 'subtitle' || row.kind === 'section'
              return (
                <div
                  key={row.id}
                  onClick={() => setSelected(row.id)}
                  className={`flex items-center gap-2 rounded-xl border px-2 py-1.5 ${
                    selected === row.id ? 'border-brand-400 bg-brand-50/70' : 'border-brand-100 bg-white'
                  }`}
                >
                  {isText ? (
                    <>
                      <span className="w-14 shrink-0 text-[9.5px] font-bold text-ink-soft/55">{rowLabel(row)}</span>
                      <input
                        className="min-w-0 flex-1 rounded-lg border border-transparent bg-transparent px-1.5 py-1 text-[11.5px] font-semibold outline-none focus:border-brand-300 focus:bg-white"
                        value={row.text}
                        onChange={(e) => patchRow(row.id, { text: e.target.value })}
                      />
                    </>
                  ) : (
                    <>
                      <span className="w-14 shrink-0 text-[9.5px] font-bold text-ink-soft/55">
                        <span className="text-brand-700">{questionIndex}.</span> {rowLabel(row)}
                      </span>
                      <input
                        type="number"
                        min={1}
                        value={row.value}
                        onChange={(e) => patchRow(row.id, { value: Math.max(1, Number(e.target.value) || 1) })}
                        className="w-14 rounded-lg border border-brand-200 px-1.5 py-1 text-center text-[11px] font-bold outline-none"
                      />
                      <span className="text-[10px] text-ink-soft/50">{meta?.unit}</span>
                      <span className="hidden text-[9.5px] text-ink-soft/40 sm:block">{meta?.hint}</span>
                    </>
                  )}
                  <span className="ml-auto flex shrink-0 items-center gap-0.5">
                    <button type="button" className="rounded px-1 text-[11px] text-ink-soft/50 hover:bg-brand-100" onClick={(e) => { e.stopPropagation(); moveRow(row.id, -1) }}>↑</button>
                    <button type="button" className="rounded px-1 text-[11px] text-ink-soft/50 hover:bg-brand-100" onClick={(e) => { e.stopPropagation(); moveRow(row.id, 1) }}>↓</button>
                    <button type="button" className="rounded px-1 text-[11px] text-red-400 hover:bg-red-50" onClick={(e) => { e.stopPropagation(); removeRow(row.id) }}>×</button>
                  </span>
                </div>
              )
            })}
          </div>

          <details className="mt-3 rounded-xl bg-neutral-50 p-2">
            <summary className="cursor-pointer text-[10.5px] font-bold text-ink-soft/60">查看生成的 DSL</summary>
            <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap text-[10px] leading-relaxed text-ink-soft/75">{dsl}</pre>
          </details>

          {errors.length > 0 && (
            <div className="mt-2 space-y-1">
              {errors.slice(0, 4).map((e, i) => (
                <p key={i} className="flex items-start gap-1.5 rounded-lg bg-red-50 px-2.5 py-1.5 text-[10.5px] text-red-700">
                  <AlertIcon className="mt-0.5 h-3 w-3 flex-none" /> {e.message}
                </p>
              ))}
            </div>
          )}

          <div className="mt-3 flex flex-wrap gap-1.5">
            <Button variant="ghost" size="sm" onClick={() => { stashDoc(doc); nav('/papers/print') }}>打印预览</Button>
            <Button variant="ghost" size="sm" onClick={() => downloadText(JSON.stringify(doc, null, 2), `${name || 'dsl'}.design.json`)}>
              <DownloadIcon className="h-3.5 w-3.5" /> 导出
            </Button>
            <Button variant="ghost" size="sm" onClick={() => { stashDoc(doc); nav('/papers/local/edit') }}>
              <EditIcon className="h-3.5 w-3.5" /> 精调
            </Button>
            <Button size="sm" onClick={() => void save()} disabled={saving || errors.length > 0}>
              <SaveIcon className="h-3.5 w-3.5" /> {saving ? '保存中' : '保存为新试卷'}
            </Button>
          </div>
        </Card>

        <Card className="!p-3">
          <div ref={previewRef} className="flex items-start justify-center overflow-hidden rounded-xl bg-neutral-100/70 p-3">
            <div style={{ width: dims.w * PX_PER_MM * zoom, height: dims.h * PX_PER_MM * zoom, flex: 'none' }}>
              <div style={{ width: dims.w * PX_PER_MM, height: dims.h * PX_PER_MM }}>
                <CardSheet doc={doc} zoom={zoom} />
              </div>
            </div>
          </div>
          <p className="mt-2 px-1 text-[10.5px] text-ink-soft/60">
            {dims.w}×{dims.h}mm · {doc.meta.paperSize} {doc.meta.orientation === 'landscape' ? '横版' : '竖版'} ·{' '}
            {doc.content.questions.length} 题 · 缩放 {Math.round(zoom * 100)}%
          </p>
        </Card>
      </div>
    </div>
  )
}

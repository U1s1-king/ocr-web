import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageHeader } from '../components/PageHeader'
import { Badge, Button, Card, Field, inputCls } from '../components/ui'
import { studentsApi, type Student } from '../m/api'
import { BARCODE_FORMATS, BarcodeSvg, validateBarcode } from '../lib/card/barcode'
import type { CardBarcodeFormat } from '../lib/card/types'
import {
  ANSWER_CARD_BARCODE_AREA,
  BARCODE_TEMPLATES,
  capacityOf,
  labelSlots,
  templateById,
  type BarcodeOrder,
  type BarcodeTemplate,
} from '../lib/barcode/templates'
import { ChevronRightIcon, DownloadIcon, ScanIcon } from '../components/icons'

const mm = (v: number) => `${v}mm`

interface LabelRow {
  student: Student
  value: string
  error: string
}

/** 条形码制作：内置考试条码模板，学生考号数据源，支持卷纸/左右双列 A4 和自定义打印 */
export default function BarcodeStudioPage() {
  const nav = useNavigate()
  const [students, setStudents] = useState<Student[]>([])
  const [templateId, setTemplateId] = useState(BARCODE_TEMPLATES[0].id)
  const [draft, setDraft] = useState<BarcodeTemplate>(() => templateById(BARCODE_TEMPLATES[0].id))
  const [format, setFormat] = useState<CardBarcodeFormat>(() => templateById(BARCODE_TEMPLATES[0].id).format)
  const [showText, setShowText] = useState(true)
  const [q, setQ] = useState('')
  const [prefix, setPrefix] = useState('')
  const [suffix, setSuffix] = useState('')
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [pageIndex, setPageIndex] = useState(0)

  useEffect(() => {
    let alive = true
    studentsApi.list().then((list) => {
      if (!alive) return
      setStudents(list)
      const valid = new Set(
        list
          .filter((s) => s.candidateNumber && !validateBarcode(format, `${prefix}${s.candidateNumber}${suffix}`))
          .map(keyOf),
      )
      setPicked(valid)
    })
    return () => {
      alive = false
    }
  }, [])

  function keyOf(s: Student): string {
    return s.candidateNumber || `id-${s.id ?? s.name}`
  }

  const rows: LabelRow[] = useMemo(() => {
    const kw = q.trim().toLowerCase()
    return students
      .map((student) => {
        const value = `${prefix}${student.candidateNumber ?? ''}${suffix}`
        const error = student.candidateNumber ? validateBarcode(format, value) : '缺少考号'
        return { student, value, error }
      })
      .filter((r) => !kw || r.student.name.toLowerCase().includes(kw) || (r.student.candidateNumber ?? '').toLowerCase().includes(kw))
  }, [students, q, prefix, suffix, format])

  const selected = rows.filter((r) => picked.has(keyOf(r.student)) && !r.error)
  const capacity = capacityOf(draft)
  const pages = useMemo(() => {
    if (draft.layout === 'roll') return selected.map((r) => [r])
    const out: LabelRow[][] = []
    for (let i = 0; i < selected.length; i += capacity) out.push(selected.slice(i, i + capacity))
    return out.length ? out : [[]]
  }, [selected, capacity, draft.layout])
  const slots = useMemo(() => labelSlots(draft), [draft])

  function pickTemplate(t: BarcodeTemplate) {
    setTemplateId(t.id)
    setDraft({ ...t })
    setFormat(t.format)
    setShowText(t.showText)
    setPageIndex(0)
  }

  function patchTemplate(patch: Partial<BarcodeTemplate>) {
    setDraft((t) => ({ ...t, ...patch }))
    setPageIndex(0)
  }

  function toggle(s: Student) {
    const k = keyOf(s)
    setPicked((cur) => {
      const next = new Set(cur)
      if (next.has(k)) next.delete(k)
      else next.add(k)
      return next
    })
  }

  function selectAll(select: boolean) {
    setPicked(select ? new Set(rows.filter((r) => !r.error).map((r) => keyOf(r.student))) : new Set())
  }

  function print() {
    window.print()
  }

  function downloadJson() {
    const payload = selected.map((r) => ({
      name: r.student.name,
      candidateNumber: r.student.candidateNumber,
      className: r.student.className,
      format,
      value: r.value,
      template: draft.id ?? templateId,
      labelW: draft.labelW,
      labelH: draft.labelH,
    }))
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = '学生条形码数据.json'
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const isCustom = templateId === 'custom'
  const page = pages[Math.min(pageIndex, pages.length - 1)] ?? []

  return (
    <div className="anim-page-in space-y-4">
      <PageHeader
        title="条形码制作"
        desc="内置高考/考试常见条码纸规格；以学生考号为数据源，支持卷纸单列、A4 左右双列和自定义标签。"
        crumb={[{ label: '试卷', to: '/papers' }, { label: '条形码制作' }]}
        extra={
          <>
            <Badge tone="ok">{selected.length} 张已选</Badge>
            <Button variant="ghost" onClick={downloadJson} disabled={selected.length === 0}>
              导出 JSON
            </Button>
            <Button onClick={print} disabled={selected.length === 0}>
              <DownloadIcon className="h-3.5 w-3.5" /> 打印标签
            </Button>
          </>
        }
      />

      <div className="grid gap-4 xl:grid-cols-[290px_minmax(0,1fr)]">
        {/* 左：内置模板 + 学生 */}
        <div className="space-y-3">
          <Card className="!p-3">
            <div className="flex items-center justify-between">
              <p className="text-[12px] font-black text-ink">内置条码模板</p>
              <span className="text-[9.5px] text-ink-soft/50">{BARCODE_TEMPLATES.length} 套</span>
            </div>
            <div className="mt-2 space-y-1">
              {BARCODE_TEMPLATES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => pickTemplate(t)}
                  className={`w-full rounded-xl border px-2.5 py-2 text-left transition ${
                    templateId === t.id
                      ? 'border-brand-400 bg-brand-50'
                      : 'border-brand-100 bg-white hover:border-brand-300 hover:bg-brand-50/50'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <span className="grid h-8 w-8 flex-none place-items-center rounded-lg bg-brand-100/70 text-brand-700">
                      <ScanIcon className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[11.5px] font-bold text-ink">{t.name}</span>
                      <span className="block truncate text-[9.5px] text-ink-soft/60">
                        {t.layout === 'roll' ? '连续卷纸' : `A4 ${t.columns} 列 × ${t.rows} 行`} · {t.labelW}×{t.labelH}mm
                      </span>
                    </span>
                  </span>
                  <span className="mt-1 block text-[9.5px] leading-relaxed text-ink-soft/50">{t.desc}</span>
                </button>
              ))}
            </div>
          </Card>

          <Card className="!p-3">
            <div className="flex items-center justify-between">
              <p className="text-[12px] font-black text-ink">学生考号</p>
              <span className="text-[9.5px] text-ink-soft/50">{students.length} 人</span>
            </div>
            <input className={`${inputCls} mt-2`} placeholder="搜索姓名 / 考号" value={q} onChange={(e) => setQ(e.target.value)} />
            <div className="mt-2 flex gap-1.5">
              <Button size="sm" variant="ghost" onClick={() => selectAll(true)} disabled={rows.filter((r) => !r.error).length === 0}>
                全选有效
              </Button>
              <Button size="sm" variant="ghost" onClick={() => selectAll(false)}>清空</Button>
            </div>
            <div className="mt-2 max-h-[360px] space-y-1 overflow-y-auto">
              {rows.map(({ student, value, error }) => {
                const k = keyOf(student)
                const on = picked.has(k) && !error
                return (
                  <button
                    key={k}
                    type="button"
                    disabled={Boolean(error)}
                    onClick={() => toggle(student)}
                    className={`flex w-full items-center gap-2 rounded-lg border px-2 py-1.5 text-left ${
                      error ? 'border-red-100 bg-red-50/40 opacity-60' : on ? 'border-brand-300 bg-brand-50/60' : 'border-transparent hover:bg-brand-50/40'
                    }`}
                  >
                    <span className={`grid h-3.5 w-3.5 flex-none place-items-center rounded border text-[9px] ${on ? 'border-brand-600 bg-brand-600 text-white' : 'border-brand-200 text-transparent'}`}>✓</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[11px] font-bold text-ink">{student.name}</span>
                      <span className="block truncate text-[9.5px] text-ink-soft/55">{error || value}</span>
                    </span>
                  </button>
                )
              })}
              {rows.length === 0 && <p className="py-5 text-center text-[10.5px] text-ink-soft/55">没有学生，请先到「学生」页导入考号</p>}
            </div>
          </Card>
        </div>

        {/* 右：模板参数 + 预览 */}
        <div className="space-y-3">
          <Card className="!p-4">
            <div className="flex flex-wrap items-start gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-black text-ink">{draft.name}</p>
                <p className="mt-1 text-[10.5px] text-ink-soft/60">
                  {draft.layout === 'roll' ? '连续卷纸' : `A4 左右双列 · 每页 ${capacity} 张`} · 标签 {draft.labelW}×{draft.labelH}mm
                  · 答题卡贴条区标准 {ANSWER_CARD_BARCODE_AREA.width}×{ANSWER_CARD_BARCODE_AREA.height}mm
                </p>
              </div>
              <Button size="sm" variant="ghost" onClick={() => nav('/papers/studio')}>
                去答题卡制作 <ChevronRightIcon className="h-3 w-3" />
              </Button>
            </div>

            <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              <Field label="条码格式">
                <select className={inputCls} value={format} onChange={(e) => setFormat(e.target.value as CardBarcodeFormat)}>
                  {BARCODE_FORMATS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
                </select>
              </Field>
              <Field label="显示文字">
                <select className={inputCls} value={showText ? '1' : '0'} onChange={(e) => setShowText(e.target.value === '1')}>
                  <option value="1">显示</option><option value="0">隐藏</option>
                </select>
              </Field>
              <Field label="前缀">
                <input className={inputCls} value={prefix} onChange={(e) => setPrefix(e.target.value.replace(/\s/g, ''))} placeholder="可选" />
              </Field>
              <Field label="后缀">
                <input className={inputCls} value={suffix} onChange={(e) => setSuffix(e.target.value.replace(/\s/g, ''))} placeholder="可选" />
              </Field>
            </div>

            <div className="mt-3 rounded-xl border border-brand-100 bg-brand-50/40 p-3">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-bold text-ink">打印布局</p>
                {!isCustom && <span className="text-[9.5px] text-ink-soft/50">内置模板参数只读，可点「复制为自定义」后修改</span>}
              </div>
              {!isCustom ? (
                <div className="mt-2 flex flex-wrap items-center gap-2 text-[10.5px] text-ink-soft/75">
                  <span>纸张 {draft.pageW}×{draft.pageH}mm</span>
                  <span>标签 {draft.labelW}×{draft.labelH}mm</span>
                  <span>{draft.layout === 'roll' ? '单列连续卷纸' : `${draft.columns} 列 × ${draft.rows} 行`}</span>
                  <span>间距 {draft.gapX}×{draft.gapY}mm</span>
                  <span>顺序 {draft.order === 'row' ? '左→右逐行' : '上→下逐列'}</span>
                  <Button size="sm" variant="ghost" className="ml-auto" onClick={() => { setTemplateId('custom'); patchTemplate({ name: '自定义标签', id: 'custom' }) }}>
                    复制为自定义
                  </Button>
                </div>
              ) : (
                <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <Field label="纸张宽 mm"><input className={inputCls} type="number" value={draft.pageW} onChange={(e) => patchTemplate({ pageW: Number(e.target.value) })} /></Field>
                  <Field label="纸张高 mm"><input className={inputCls} type="number" value={draft.pageH} onChange={(e) => patchTemplate({ pageH: Number(e.target.value) })} /></Field>
                  <Field label="标签宽 mm"><input className={inputCls} type="number" value={draft.labelW} onChange={(e) => patchTemplate({ labelW: Number(e.target.value) })} /></Field>
                  <Field label="标签高 mm"><input className={inputCls} type="number" value={draft.labelH} onChange={(e) => patchTemplate({ labelH: Number(e.target.value) })} /></Field>
                  <Field label="列数"><input className={inputCls} type="number" min={1} value={draft.columns} onChange={(e) => patchTemplate({ columns: Number(e.target.value) })} /></Field>
                  <Field label="行数"><input className={inputCls} type="number" min={1} value={draft.rows} onChange={(e) => patchTemplate({ rows: Number(e.target.value) })} /></Field>
                  <Field label="左右间距"><input className={inputCls} type="number" value={draft.gapX} onChange={(e) => patchTemplate({ gapX: Number(e.target.value) })} /></Field>
                  <Field label="上下间距"><input className={inputCls} type="number" value={draft.gapY} onChange={(e) => patchTemplate({ gapY: Number(e.target.value) })} /></Field>
                  <Field label="布局">
                    <select className={inputCls} value={draft.layout} onChange={(e) => patchTemplate({ layout: e.target.value as BarcodeTemplate['layout'] })}>
                      <option value="sheet">A4 / 整张纸</option><option value="roll">连续卷纸</option>
                    </select>
                  </Field>
                  <Field label="排列">
                    <select className={inputCls} value={draft.order} onChange={(e) => patchTemplate({ order: e.target.value as BarcodeOrder })}>
                      <option value="row">左→右，再下一行</option><option value="column">左列排满，再右列</option>
                    </select>
                  </Field>
                </div>
              )}
            </div>
          </Card>

          <Card className="!p-4">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-[12px] font-black text-ink">打印预览</p>
              <span className="text-[10px] text-ink-soft/50">
                {draft.layout === 'roll' ? '每张标签单独一页' : `共 ${pages.length} 页 · 每页 ${capacity} 张`}
              </span>
              {pages.length > 1 && (
                <div className="ml-auto flex items-center gap-1">
                  <Button size="sm" variant="ghost" onClick={() => setPageIndex((i) => Math.max(0, i - 1))}>上一页</Button>
                  <span className="text-[10px] font-bold text-ink-soft">{pageIndex + 1} / {pages.length}</span>
                  <Button size="sm" variant="ghost" onClick={() => setPageIndex((i) => Math.min(pages.length - 1, i + 1))}>下一页</Button>
                </div>
              )}
            </div>

            <div className="barcode-studio-preview mt-3">
              <div className="bc-page" style={{ width: mm(draft.pageW), height: mm(draft.pageH) }}>
                {slots.map((slot, i) => {
                  const row = page[i]
                  if (!row) return null
                  return (
                    <div key={i} className="bc-label" style={{ left: mm(slot.x), top: mm(slot.y), width: mm(slot.w), height: mm(slot.h), padding: mm(draft.pad ?? 0.6) }}>
                      <div className="bc-label-top">
                        <span className="bc-label-name">{row.student.name}</span>
                        <span className="bc-label-class">{row.student.className ?? ''}</span>
                      </div>
                      <div className="bc-label-code">
                        <BarcodeSvg format={format} value={row.value} showText={showText} />
                      </div>
                      <div className="bc-label-bottom">{row.value}</div>
                    </div>
                  )
                })}
                {page.length === 0 && <p className="bc-empty">左侧选择学生后显示标签</p>}
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* 打印专用页面 */}
      <style>{`
        @media print {
          @page { size: ${draft.pageW}mm ${draft.pageH}mm; margin: 0; }
        }
      `}</style>
      <div className="bc-print-root">
        {pages.map((pg, pi) => (
          <div key={pi} className="bc-print-page" style={{ width: mm(draft.pageW), height: mm(draft.pageH) }}>
            {slots.map((slot, i) => {
              const row = pg[i]
              if (!row) return null
              return (
                <div key={i} className="bc-label" style={{ left: mm(slot.x), top: mm(slot.y), width: mm(slot.w), height: mm(slot.h), padding: mm(draft.pad ?? 0.6) }}>
                  <div className="bc-label-top">
                    <span className="bc-label-name">{row.student.name}</span>
                    <span className="bc-label-class">{row.student.className ?? ''}</span>
                  </div>
                  <div className="bc-label-code">
                    <BarcodeSvg format={format} value={row.value} showText={showText} />
                  </div>
                  <div className="bc-label-bottom">{row.value}</div>
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}

import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageHeader } from '../components/PageHeader'
import { Badge, Button, Card, Field, inputCls } from '../components/ui'
import { ChevronRightIcon, DownloadIcon, TrashIcon } from '../components/icons'
import { studentsApi } from '../m/api'
import { BarcodeSvg } from '../lib/card/barcode'
import type { CardBarcodeFormat } from '../lib/card/types'
import {
  DEFAULT_PERSON,
  FIELD_LABELS,
  FIELD_PLACEHOLDER,
  LABEL_PRESETS,
  designForPreset,
  detectMapping,
  makeFields,
  personFromRow,
  type BarcodeDesign,
  type BarcodeField,
  type BarcodePerson,
  type LabelPreset,
} from '../lib/barcode/designer'

const DESIGN_KEY = 'ac.barcode.design.v1'
const SAMPLE_ROW = { 学校: 'XX中学', 姓名: '张三', 座号: '01', 考场号: '101', 考号: '2026001', 班级: '高一（1）班' }

function readDesign(): BarcodeDesign {
  try {
    const raw = localStorage.getItem(DESIGN_KEY)
    if (raw) {
      const d = JSON.parse(raw) as BarcodeDesign
      if (d && d.width && d.height && Array.isArray(d.fields)) return d
    }
  } catch {
    /* ignore */
  }
  return designForPreset(LABEL_PRESETS[0])
}

function saveDesign(d: BarcodeDesign) {
  try {
    localStorage.setItem(DESIGN_KEY, JSON.stringify(d))
  } catch {
    /* ignore */
  }
}

function download(name: string, content: string, type = 'text/plain;charset=utf-8') {
  const blob = new Blob([content], { type })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = name
  a.click()
  URL.revokeObjectURL(a.href)
}

function csvTemplate() {
  return '\uFEFF' + Object.keys(SAMPLE_ROW).join(',') + '\n' + Object.values(SAMPLE_ROW).join(',') + '\n'
}

function parseCsv(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const lines: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i]
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        cell += '"'
        i += 1
      } else if (ch === '"') quoted = false
      else cell += ch
    } else if (ch === '"') quoted = true
    else if (ch === ',') {
      row.push(cell)
      cell = ''
    } else if (ch === '\n') {
      row.push(cell)
      lines.push(row)
      row = []
      cell = ''
    } else if (ch !== '\r') cell += ch
  }
  if (cell || row.length) {
    row.push(cell)
    lines.push(row)
  }
  const clean = lines.filter((r) => r.some((x) => x.trim() !== ''))
  if (!clean.length) return { headers: [], rows: [] }
  const headers = clean[0].map((h) => h.trim())
  return {
    headers,
    rows: clean.slice(1).map((r) => Object.fromEntries(headers.map((h, i) => [h, (r[i] ?? '').trim()]))),
  }
}

function fieldValue(field: BarcodeField, person: BarcodePerson, staticText?: Record<string, string>): string {
  if (field.key === 'custom') return field.text || ''
  if (field.key === 'barcode') return person.candidateNumber || ''
  return person[field.key] || staticText?.[field.key] || ''
}

/** 条形码制作：单面标签自由设计 + 批量数据源 */
export default function BarcodeStudioPage() {
  const nav = useNavigate()
  const [design, setDesign] = useState<BarcodeDesign>(readDesign)
  const [presetId, setPresetId] = useState(LABEL_PRESETS[0].id)
  const [selected, setSelected] = useState<string | null>(null)
  const [people, setPeople] = useState<BarcodePerson[]>([])
  const [peopleSource, setPeopleSource] = useState<'students' | 'import' | 'sample'>('students')
  const [q, setQ] = useState('')
  const [importInfo, setImportInfo] = useState('')
  const [importError, setImportError] = useState('')
  const [printMode, setPrintMode] = useState<'roll' | 'sheet2'>('roll')
  const [sourceTab, setSourceTab] = useState<'students' | 'external'>('students')
  const [templateOpen, setTemplateOpen] = useState(false)
  const [manualBarcode, setManualBarcode] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const drag = useRef<{ id: string; sx: number; sy: number; x: number; y: number } | null>(null)

  useEffect(() => {
    saveDesign(design)
  }, [design])

  useEffect(() => {
    studentsApi.list().then((list) => {
      setPeople(
        list.map((s) => ({
          ...DEFAULT_PERSON,
          school: '',
          name: s.name,
          candidateNumber: s.candidateNumber || '',
          className: s.className || '',
          seat: '',
          room: '',
        })),
      )
    }).catch(() => setPeople([]))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const previewPerson = useMemo(() => {
    const base = people[0] ?? DEFAULT_PERSON
    return manualBarcode ? { ...base, candidateNumber: manualBarcode } : base
  }, [people, manualBarcode])
  const filtered = useMemo(() => {
    const kw = q.trim().toLowerCase()
    if (!kw) return people
    return people.filter((p) => Object.values(p).some((v) => String(v).toLowerCase().includes(kw)))
  }, [people, q])

  const selectedField = design.fields.find((f) => f.id === selected) ?? null
  const printPeople = manualBarcode
    ? [{ ...DEFAULT_PERSON, candidateNumber: manualBarcode, name: people[0]?.name ?? DEFAULT_PERSON.name }]
    : filtered
  const sheet = useMemo(() => {
    const margin = 10
    const gap = 6
    const cols = 2
    const rows = Math.max(1, Math.floor((297 - margin * 2 + gap) / (design.height + gap)))
    return { cols, rows, margin, gap, capacity: cols * rows, pageW: 210, pageH: 297 }
  }, [design.height])
  const sheetPages = useMemo(() => {
    if (printMode !== 'sheet2') return printPeople.map((p) => [p])
    const out: BarcodePerson[][] = []
    for (let i = 0; i < printPeople.length; i += sheet.capacity) out.push(printPeople.slice(i, i + sheet.capacity))
    return out.length ? out : [[]]
  }, [printPeople, printMode, sheet.capacity])

  function patchDesign(patch: Partial<BarcodeDesign>) {
    setDesign((d) => ({ ...d, ...patch }))
  }

  function patchField(id: string, patch: Partial<BarcodeField>) {
    setDesign((d) => ({ ...d, fields: d.fields.map((f) => (f.id === id ? { ...f, ...patch } : f)) }))
  }

  function changePreset(p: LabelPreset) {
    setPresetId(p.id)
    setDesign(designForPreset(p))
    setSelected(null)
  }

  function startDrag(e: React.PointerEvent, field: BarcodeField) {
    if ((e.target as HTMLElement).dataset.resize) return
    e.preventDefault()
    e.stopPropagation()
    setSelected(field.id)
    const canvas = (e.currentTarget as HTMLElement).closest('.barcode-design-canvas')?.getBoundingClientRect()
    const pxPerMm = canvas ? canvas.width / design.width : 4
    drag.current = { id: field.id, sx: e.clientX, sy: e.clientY, x: field.x, y: field.y }
    const onMove = (ev: PointerEvent) => {
      const d = drag.current
      if (!d) return
      const x = Math.max(0, Math.min(design.width - field.w, d.x + (ev.clientX - d.sx) / pxPerMm))
      const y = Math.max(0, Math.min(design.height - field.h, d.y + (ev.clientY - d.sy) / pxPerMm))
      patchField(field.id, { x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 })
    }
    const onUp = () => {
      drag.current = null
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  function startResize(e: React.PointerEvent, field: BarcodeField, dir: 'right' | 'bottom' | 'both') {
    e.preventDefault()
    e.stopPropagation()
    setSelected(field.id)
    const sx = e.clientX
    const sy = e.clientY
    const w0 = field.w
    const h0 = field.h
    const canvas = (e.currentTarget as HTMLElement).closest('.barcode-design-canvas')?.getBoundingClientRect()
    const pxPerMm = canvas ? canvas.width / design.width : 4
    const onMove = (ev: PointerEvent) => {
      const w = dir === 'bottom' ? w0 : Math.max(6, Math.min(design.width - field.x, w0 + (ev.clientX - sx) / pxPerMm))
      const h = dir === 'right' ? h0 : Math.max(4, Math.min(design.height - field.y, h0 + (ev.clientY - sy) / pxPerMm))
      patchField(field.id, { w: Math.round(w * 10) / 10, h: Math.round(h * 10) / 10 })
    }
    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  function addField(key: BarcodeField['key']) {
    if (key !== 'custom' && design.fields.some((f) => f.key === key)) {
      setSelected(design.fields.find((f) => f.key === key)?.id ?? null)
      return
    }
    const id = `f-${key}-${Date.now()}`
    const f: BarcodeField = {
      id,
      key,
      text: key === 'custom' ? '自定义文字' : undefined,
      x: 4,
      y: Math.max(2, design.height - 7),
      w: Math.min(30, design.width - 8),
      h: 5,
      fontSize: 2.4,
      align: 'left',
    }
    setDesign((d) => ({ ...d, fields: [...d.fields, f] }))
    setSelected(id)
  }

  function removeField(id: string) {
    setDesign((d) => ({ ...d, fields: d.fields.filter((f) => f.id !== id) }))
    setSelected(null)
  }

  function handleImport(file?: File | null) {
    if (!file) return
    setImportError('')
    setImportInfo('')
    if (/\.(xlsx|xls)$/i.test(file.name)) {
      setImportError('Excel 请先在 Excel 里「另存为 CSV」，再导入；或直接下载我们的 CSV 模板。')
      return
    }
    file
      .text()
      .then((text) => {
        let headers: string[] = []
        let rows: Record<string, string>[] = []
        if (file.name.toLowerCase().endsWith('.json')) {
          const data = JSON.parse(text) as unknown
          const arr = Array.isArray(data) ? data : (data as { rows?: unknown[]; students?: unknown[] }).rows ?? (data as { students?: unknown[] }).students
          if (!Array.isArray(arr) || !arr.length) throw new Error('JSON 需要是非空数组')
          rows = arr.map((r) => Object.fromEntries(Object.entries(r as Record<string, unknown>).map(([k, v]) => [k, String(v ?? '')])))
          headers = Object.keys(rows[0] ?? {})
        } else {
          const parsed = parseCsv(text)
          headers = parsed.headers
          rows = parsed.rows
        }
        if (!headers.length || !rows.length) throw new Error('没有识别到数据行')
        let mapping = detectMapping(headers)
        if (!mapping.name && headers.length >= 2) {
          mapping = {}
          ;(['school', 'name', 'seat', 'room', 'candidateNumber', 'className'] as const).forEach((f, i) => {
            if (headers[i]) mapping[f] = headers[i]
          })
        }
        const next = rows.map((r) => personFromRow(r, mapping)).filter((p) => p.name || p.candidateNumber)
        if (!next.length) throw new Error('没有识别到姓名/考号列')
        const found = Object.entries(mapping).map(([f, h]) => `${FIELD_LABELS[f as keyof typeof FIELD_LABELS]}←${h}`)
        setPeople(next)
        setPeopleSource('import')
        setSourceTab('external')
        setTemplateOpen(false)
        setImportInfo(`已导入 ${next.length} 人 · 自动识别：${found.join('，')}`)
      })
      .catch((e) => setImportError(e instanceof Error ? e.message : '文件解析失败'))
      .finally(() => {
        if (fileRef.current) fileRef.current.value = ''
      })
  }

  function restoreStudents() {
    setImportInfo('')
    setImportError('')
    setPeopleSource('students')
    studentsApi.list().then((list) => {
      setPeople(
        list.map((s) => ({
          ...DEFAULT_PERSON,
          school: '',
          name: s.name,
          candidateNumber: s.candidateNumber || '',
          className: s.className || '',
          seat: '',
          room: '',
        })),
      )
    })
  }

  function print() {
    window.print()
  }

  function renderField(field: BarcodeField, person: BarcodePerson, interactive: boolean) {
    const value = fieldValue(field, person, design.staticText)
    return (
      <div
        key={field.id}
        className={`bl-field ${interactive && selected === field.id ? 'is-selected' : ''}`}
        style={{
          left: `${field.x}mm`,
          top: `${field.y}mm`,
          width: `${field.w}mm`,
          height: `${field.h}mm`,
          fontSize: `${field.fontSize}mm`,
          fontWeight: field.bold ? 800 : 600,
          textAlign: field.align ?? 'left',
          cursor: interactive ? 'move' : 'default',
        }}
        onPointerDown={interactive ? (e) => startDrag(e, field) : undefined}
      >
        {field.key === 'barcode' ? (
          <BarcodeSvg format={design.format} value={value || FIELD_PLACEHOLDER.barcode} showText={design.showText} />
        ) : (
          <span className="bl-text">{value || FIELD_PLACEHOLDER[field.key]}</span>
        )}
        {interactive && selected === field.id && (
          <>
            <span data-resize className="bl-resize handle-se" onPointerDown={(e) => startResize(e, field, 'both')} />
            <span data-resize className="bl-resize handle-e" onPointerDown={(e) => startResize(e, field, 'right')} />
            <span data-resize className="bl-resize handle-s" onPointerDown={(e) => startResize(e, field, 'bottom')} />
          </>
        )}
      </div>
    )
  }

  return (
    <div className="anim-page-in space-y-4">
      <PageHeader
        title="条形码制作"
        desc="单面标签自由设计：中心条形码 + 学校/姓名/座号/考场号等组件可拖动；支持学生名单或外部 CSV/JSON 数据源批量打印。"
        crumb={[{ label: '试卷', to: '/papers' }, { label: '条形码制作' }]}
        extra={
          <>
            <Badge tone="ok">{printPeople.length} 人</Badge>
            <Button variant="ghost" onClick={() => nav('/papers/studio')}>
              去答题卡制作 <ChevronRightIcon className="h-3 w-3" />
            </Button>
            <Button onClick={print} disabled={printPeople.length === 0}>
              <DownloadIcon className="h-3.5 w-3.5" /> 打印标签
            </Button>
          </>
        }
      />

      <div className="grid gap-4 xl:grid-cols-[270px_minmax(0,1fr)]">
        <div className="space-y-3">
          <Card className="!p-3">
            <p className="text-[12px] font-black text-ink">标签尺寸模板</p>
            <div className="mt-2 space-y-1">
              {LABEL_PRESETS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => changePreset(p)}
                  className={`w-full rounded-xl border px-2.5 py-2 text-left ${presetId === p.id ? 'border-brand-400 bg-brand-50' : 'border-brand-100 bg-white hover:border-brand-300'}`}
                >
                  <span className="text-[11.5px] font-bold text-ink">{p.name}</span>
                  <span className="mt-0.5 block text-[9.5px] text-ink-soft/60">{p.desc}</span>
                </button>
              ))}
            </div>
          </Card>

          <Card className="!p-3">
            <div className="flex items-center justify-between">
              <p className="text-[12px] font-black text-ink">数据源</p>
              <Badge tone={peopleSource === 'import' ? 'warn' : 'ok'}>
                {peopleSource === 'import' ? '外部导入' : '学生名单'}
              </Badge>
            </div>
            <input ref={fileRef} type="file" accept=".json,.csv,.txt" className="hidden" onChange={(e) => handleImport(e.target.files?.[0])} />
            <div className="mt-2 grid grid-cols-2 gap-1 rounded-xl bg-brand-50 p-1">
              <button
                type="button"
                className={`rounded-lg px-2 py-1.5 text-[10.5px] font-bold ${sourceTab === 'students' ? 'bg-white text-brand-700 shadow-sm' : 'text-ink-soft'}`}
                onClick={() => { setSourceTab('students'); restoreStudents() }}
              >
                学生
              </button>
              <button
                type="button"
                className={`rounded-lg px-2 py-1.5 text-[10.5px] font-bold ${sourceTab === 'external' ? 'bg-white text-brand-700 shadow-sm' : 'text-ink-soft'}`}
                onClick={() => setSourceTab('external')}
              >
                导入外部源
              </button>
            </div>
            {sourceTab === 'students' ? (
              <p className="mt-1.5 text-[9.5px] leading-relaxed text-ink-soft/55">
                直接读取学生名单里的姓名、考号、班级；座号和考场使用默认值。
              </p>
            ) : (
              <div className="mt-1.5 rounded-xl border border-dashed border-brand-200 bg-brand-50/40 p-2">
                <p className="text-[9.5px] leading-relaxed text-ink-soft/65">请下载模板，按模板填好后再导入；支持 CSV / JSON。</p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  <Button size="sm" variant="ghost" onClick={() => setTemplateOpen(true)}>下载模板</Button>
                  <Button size="sm" variant="ghost" onClick={() => void fileRef.current?.click()}>选择文件导入</Button>
                </div>
              </div>
            )}
            {importInfo && <p className="mt-1.5 text-[9.5px] leading-relaxed text-emerald-700">{importInfo}</p>}
            {importError && <p className="mt-1.5 rounded-lg bg-red-50 px-2 py-1.5 text-[9.5px] text-red-600">{importError}</p>}

            <input className={`${inputCls} mt-2`} placeholder="搜索姓名 / 座号 / 考场" value={q} onChange={(e) => setQ(e.target.value)} />
            <div className="mt-2 max-h-[300px] space-y-1 overflow-y-auto">
              {filtered.map((p, i) => (
                <div key={`${p.candidateNumber}-${i}`} className="flex items-center gap-2 rounded-lg border border-transparent px-2 py-1.5 hover:bg-brand-50/40">
                  <span className="w-7 flex-none text-[9.5px] font-bold text-ink-soft/45">{String(i + 1).padStart(2, '0')}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[11px] font-bold text-ink">{p.name || '未命名'}</span>
                    <span className="block truncate text-[9.5px] text-ink-soft/55">{p.school} · {p.seat} 号 · {p.room} 考场</span>
                  </span>
                </div>
              ))}
              {filtered.length === 0 && <p className="py-4 text-center text-[10.5px] text-ink-soft/55">还没有数据，请导入或使用学生名单</p>}
            </div>
          </Card>
        </div>

        <div className="space-y-3">
          <Card className="!p-4">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-[12px] font-black text-ink">标签设计</p>
              <span className="text-[10px] text-ink-soft/55">{design.width}×{design.height}mm · {design.fields.length} 个组件</span>
              <div className="ml-auto flex items-center gap-1.5">
                <select className={inputCls} value={design.format} onChange={(e) => patchDesign({ format: e.target.value as CardBarcodeFormat })}>
                  {['CODE128', 'CODE39', 'EAN13', 'ITF14'].map((f) => <option key={f} value={f}>{f}</option>)}
                </select>
                <label className="flex items-center gap-1 text-[10px] font-bold text-ink-soft">
                  <input type="checkbox" checked={design.showText} onChange={(e) => patchDesign({ showText: e.target.checked })} /> 条码文字
                </label>
              </div>
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-2 rounded-xl bg-brand-50/50 px-2.5 py-2">
              <span className="text-[10px] font-bold text-ink-soft">手动条码数字</span>
              <input
                className={`${inputCls} !w-[180px]`}
                inputMode="numeric"
                value={manualBarcode}
                onChange={(e) => setManualBarcode(e.target.value.replace(/\s/g, ''))}
                placeholder="留空则用数据源考号"
              />
              <span className="text-[9.5px] text-ink-soft/50">可直接输入数字生成条码；清空后恢复学生/外部数据源</span>
            </div>

            <div className="mt-3 flex flex-col gap-3 lg:flex-row">
              <div className="flex min-w-0 flex-1 items-start justify-center rounded-2xl bg-neutral-200/70 p-4">
                <div
                  className="barcode-design-canvas relative bg-white shadow-[0_18px_40px_-26px_rgba(0,0,0,.5)]"
                  style={{ width: `${design.width}mm`, height: `${design.height}mm` }}
                  onPointerDown={() => setSelected(null)}
                >
                  {design.fields.map((f) => renderField(f, previewPerson, true))}
                </div>
              </div>

              <div className="w-full lg:w-[250px]">
                <p className="text-[10.5px] font-bold text-ink-soft">组件</p>
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {(['school', 'name', 'seat', 'room', 'candidateNumber', 'className', 'barcode', 'custom'] as const).map((k) => (
                    <button key={k} type="button" className="rounded-lg border border-brand-200 bg-white px-1.5 py-1 text-[9.5px] font-bold text-ink-soft hover:bg-brand-50" onClick={() => addField(k)}>
                      + {FIELD_LABELS[k]}
                    </button>
                  ))}
                </div>
                {selectedField ? (
                  <div className="mt-2 space-y-1.5">
                    <div className="flex items-center gap-1">
                      <p className="text-[10.5px] font-bold text-ink">{FIELD_LABELS[selectedField.key]}</p>
                      <button type="button" className="ml-auto text-[9.5px] font-bold text-red-500" onClick={() => removeField(selectedField.id)}>
                        <TrashIcon className="h-3 w-3" />
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-1.5">
                      <Field label="X mm"><input className={inputCls} type="number" value={selectedField.x} onChange={(e) => patchField(selectedField.id, { x: Number(e.target.value) })} /></Field>
                      <Field label="Y mm"><input className={inputCls} type="number" value={selectedField.y} onChange={(e) => patchField(selectedField.id, { y: Number(e.target.value) })} /></Field>
                      <Field label="宽 mm"><input className={inputCls} type="number" value={selectedField.w} onChange={(e) => patchField(selectedField.id, { w: Number(e.target.value) })} /></Field>
                      <Field label="高 mm"><input className={inputCls} type="number" value={selectedField.h} onChange={(e) => patchField(selectedField.id, { h: Number(e.target.value) })} /></Field>
                      <Field label="字号 mm"><input className={inputCls} type="number" value={selectedField.fontSize} onChange={(e) => patchField(selectedField.id, { fontSize: Number(e.target.value) })} /></Field>
                      <Field label="对齐">
                        <select className={inputCls} value={selectedField.align ?? 'left'} onChange={(e) => patchField(selectedField.id, { align: e.target.value as BarcodeField['align'] })}>
                          <option value="left">左</option><option value="center">中</option><option value="right">右</option>
                        </select>
                      </Field>
                    </div>
                    {selectedField.key === 'custom' && (
                      <Field label="自定义文字"><input className={inputCls} value={selectedField.text ?? ''} onChange={(e) => patchField(selectedField.id, { text: e.target.value })} /></Field>
                    )}
                    {(['school', 'seat', 'room', 'className'] as const).includes(selectedField.key as never) && (
                      <Field label="固定文字（可手填）">
                        <input
                          className={inputCls}
                          value={design.staticText?.[selectedField.key] ?? ''}
                          onChange={(e) => patchDesign({ staticText: { ...(design.staticText ?? {}), [selectedField.key]: e.target.value } })}
                        />
                      </Field>
                    )}
                  </div>
                ) : (
                  <p className="mt-2 rounded-lg bg-brand-50/60 px-2 py-2 text-[9.5px] leading-relaxed text-ink-soft/65">点击标签上的组件可拖动/缩放，右侧可精确改数值。</p>
                )}
                <div className="mt-2 grid grid-cols-2 gap-1.5">
                  <Field label="标签宽"><input className={inputCls} type="number" value={design.width} onChange={(e) => { const w = Number(e.target.value); patchDesign({ width: w, fields: makeFields(w, design.height) }) }} /></Field>
                  <Field label="标签高"><input className={inputCls} type="number" value={design.height} onChange={(e) => { const h = Number(e.target.value); patchDesign({ height: h, fields: makeFields(design.width, h) }) }} /></Field>
                </div>
                <Button size="sm" variant="ghost" className="mt-2 w-full" onClick={() => setDesign(designForPreset(LABEL_PRESETS[0]))}>
                  恢复默认布局
                </Button>
              </div>
            </div>
          </Card>

          <Card className="!p-4 print-hide">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-[12px] font-black text-ink">批量打印</p>
              <select className={inputCls} value={printMode} onChange={(e) => setPrintMode(e.target.value as 'roll' | 'sheet2')}>
                <option value="roll">单列卷纸（每张一页）</option>
                <option value="sheet2">A4 左右双列</option>
              </select>
              <span className="text-[10px] text-ink-soft/55">
                共 {printPeople.length} 张 · {printMode === 'roll' ? `${printPeople.length} 页` : `${sheetPages.length} 页 · 每页 ${sheet.capacity} 张`}
              </span>
              <Button className="ml-auto" onClick={print} disabled={printPeople.length === 0}>打印 / 存 PDF</Button>
            </div>
            <p className="mt-2 text-[9.5px] leading-relaxed text-ink-soft/50">
              条形码内容为「前缀 + 考号 + 后缀」；拖拽时只移动当前组件，不会留下残影。打印请选择 100% 缩放、无边距。
            </p>
          </Card>
        </div>
      </div>

      {templateOpen && (
        <div className="account-mask" onClick={() => setTemplateOpen(false)} role="presentation">
          <div className="account-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-[16px] font-black text-ink">请下载模板</h2>
                <p className="mt-1 text-[10.5px] leading-relaxed text-ink-soft/65">
                  请下载模板，按照模板填写学生信息后导入，系统会自动识别表头并生成条形码标签。
                </p>
              </div>
              <button type="button" className="text-[12px] font-bold text-ink-soft" onClick={() => setTemplateOpen(false)}>关闭</button>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                type="button"
                className="rounded-xl border border-brand-200 bg-white px-3 py-3 text-left hover:bg-brand-50"
                onClick={() => download('答题卡条形码数据源.csv', csvTemplate(), 'text/csv;charset=utf-8')}
              >
                <span className="block text-[12px] font-bold text-ink">Excel/CSV 模板</span>
                <span className="mt-0.5 block text-[9.5px] text-ink-soft/55">下载后用 Excel 打开填写</span>
              </button>
              <button
                type="button"
                className="rounded-xl border border-brand-200 bg-white px-3 py-3 text-left hover:bg-brand-50"
                onClick={() => download('答题卡条形码数据源.json', JSON.stringify([SAMPLE_ROW], null, 2), 'application/json;charset=utf-8')}
              >
                <span className="block text-[12px] font-bold text-ink">JSON 模板</span>
                <span className="mt-0.5 block text-[9.5px] text-ink-soft/55">适合程序/脚本生成</span>
              </button>
            </div>
            <p className="mt-3 rounded-lg bg-brand-50 px-2.5 py-2 text-[9.5px] leading-relaxed text-ink-soft/65">
              模板列：学校、姓名、座号、考场号、考号、班级。Excel 请另存为 CSV 后导入。
            </p>
            <div className="mt-4 flex gap-2">
              <button type="button" className="serverdown-btn ghost !h-9" onClick={() => setTemplateOpen(false)}>取消</button>
              <button type="button" className="serverdown-btn primary !h-9" onClick={() => { setTemplateOpen(false); void fileRef.current?.click() }}>
                填写完成，导入
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @media print {
          @page { size: ${printMode === 'roll' ? `${design.width}mm ${design.height}mm` : '210mm 297mm'}; margin: 0; }
          body * { visibility: hidden !important; }
          .barcode-print-root, .barcode-print-root * { visibility: visible !important; }
          .barcode-print-root { display: block !important; position: absolute; left: 0; top: 0; }
        }
      `}</style>

      <div className="barcode-print-root">
        {printMode === 'roll'
          ? printPeople.map((p, i) => (
              <div key={i} className="bp-page" style={{ width: `${design.width}mm`, height: `${design.height}mm` }}>
                {design.fields.map((f) => renderField(f, p, false))}
              </div>
            ))
          : sheetPages.map((page, pi) => (
              <div key={pi} className="bp-page" style={{ width: `${sheet.pageW}mm`, height: `${sheet.pageH}mm` }}>
                {page.map((p, i) => {
                  const col = i % sheet.cols
                  const row = Math.floor(i / sheet.cols)
                  const x = sheet.margin + col * (design.width + sheet.gap)
                  const y = sheet.margin + row * (design.height + sheet.gap)
                  return (
                    <div key={i} className="bp-label" style={{ left: `${x}mm`, top: `${y}mm`, width: `${design.width}mm`, height: `${design.height}mm` }}>
                      {design.fields.map((f) => renderField(f, p, false))}
                    </div>
                  )
                })}
              </div>
            ))}
      </div>
    </div>
  )
}

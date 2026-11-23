import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useToast } from '../../components/Toast'
import { studentsApi } from '../api'
import { readFileText } from '../../lib/textEncoding'
import { BarcodeSvg } from '../../lib/card/barcode'
import { Btn, Card, Page } from '../ui'
import { IcLayers, IcTrash, IcUpload, IcUsers } from '../icons'
import {
  DEFAULT_PERSON,
  FIELD_LABELS,
  FIELD_PLACEHOLDER,
  LABEL_PRESETS,
  designForPreset,
  detectMapping,
  personFromRow,
  type BarcodeDesign,
  type BarcodeField,
  type BarcodePerson,
} from '../../lib/barcode/designer'

function download(name: string, content: string, type = 'text/plain;charset=utf-8') {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([content], { type }))
  a.download = name
  a.click()
  URL.revokeObjectURL(a.href)
}
const SAMPLE = { 学校: 'XX中学', 姓名: '张三', 座号: '01', 考场号: '101', 考号: '2026001', 班级: '高一（1）班' }
const CSV = '\uFEFF' + Object.keys(SAMPLE).join(',') + '\n' + Object.values(SAMPLE).join(',') + '\n'

export default function BarcodeStudio() {
  const nav = useNavigate()
  const toast = useToast()
  const [design, setDesign] = useState<BarcodeDesign>(() => designForPreset(LABEL_PRESETS[0]))
  const [selected, setSelected] = useState<string | null>(null)
  const [manual, setManual] = useState('')
  const [zoom, setZoom] = useState(2)
  const [rows, setRows] = useState<BarcodePerson[]>([])
  const fileRef = useRef<HTMLInputElement>(null)
  const drag = useRef<{ id: string; sx: number; sy: number; x: number; y: number } | null>(null)
  useEffect(() => {
    setRows(
      studentsApi.listLocal().map((s) => ({
        ...DEFAULT_PERSON,
        school: '', seat: '', room: '', name: s.name,
        candidateNumber: s.candidateNumber || '', className: s.className || '',
      })),
    )
  }, [])

  const previewPerson = useMemo(() => {
    if (manual) return { ...DEFAULT_PERSON, candidateNumber: manual }
    return rows[0] ?? DEFAULT_PERSON
  }, [manual, rows])
  const printPeople = manual ? [{ ...DEFAULT_PERSON, candidateNumber: manual }] : rows.filter((x) => x.candidateNumber)

  function patchField(id: string, patch: Partial<BarcodeField>) {
    setDesign((d) => ({ ...d, fields: d.fields.map((f) => (f.id === id ? { ...f, ...patch } : f)) }))
  }
  function fieldValue(f: BarcodeField, p: BarcodePerson) {
    if (f.key === 'custom') return f.text || ''
    if (f.key === 'barcode') return p.candidateNumber || ''
    return p[f.key] || design.staticText?.[f.key] || ''
  }
  function startDrag(e: React.PointerEvent, f: BarcodeField) {
    if ((e.target as HTMLElement).dataset.resize) return
    e.preventDefault()
    e.stopPropagation()
    setSelected(f.id)
    const canvas = (e.currentTarget as HTMLElement).closest('.mo-barcode-canvas')?.getBoundingClientRect()
    const px = canvas ? canvas.width / design.width : 4
    drag.current = { id: f.id, sx: e.clientX, sy: e.clientY, x: f.x, y: f.y }
    const onMove = (ev: PointerEvent) => {
      const d = drag.current
      if (!d) return
      patchField(f.id, {
        x: Math.round(Math.max(0, Math.min(design.width - f.w, d.x + (ev.clientX - d.sx) / px)) * 10) / 10,
        y: Math.round(Math.max(0, Math.min(design.height - f.h, d.y + (ev.clientY - d.sy) / px)) * 10) / 10,
      })
    }
    const onUp = () => {
      drag.current = null
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  function startResize(e: React.PointerEvent, f: BarcodeField, dir: 'right' | 'bottom' | 'both') {
    e.preventDefault()
    e.stopPropagation()
    setSelected(f.id)
    const sx = e.clientX
    const sy = e.clientY
    const w0 = f.w
    const h0 = f.h
    const canvas = (e.currentTarget as HTMLElement).closest('.mo-barcode-canvas')?.getBoundingClientRect()
    const px = canvas ? canvas.width / design.width : 4
    const onMove = (ev: PointerEvent) => {
      const w = dir === 'bottom' ? w0 : Math.max(6, Math.min(design.width - f.x, w0 + (ev.clientX - sx) / px))
      const h = dir === 'right' ? h0 : Math.max(4, Math.min(design.height - f.y, h0 + (ev.clientY - sy) / px))
      patchField(f.id, { w: Math.round(w * 10) / 10, h: Math.round(h * 10) / 10 })
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
    setDesign((d) => ({ ...d, fields: [...d.fields, { id, key, text: key === 'custom' ? '自定义文字' : undefined, x: 4, y: d.height - 7, w: Math.min(30, d.width - 8), h: 5, fontSize: 2.4, align: 'left' }] }))
    setSelected(id)
  }

  function importFile(file?: File | null) {
    if (!file) return
    readFileText(file).then((text) => {
      let list: Record<string, string>[] = []
      let headers: string[] = []
      if (file.name.endsWith('.json')) {
        const data = JSON.parse(text) as unknown
        const arr = Array.isArray(data) ? data : []
        list = arr.map((x) => Object.fromEntries(Object.entries(x as Record<string, unknown>).map(([k, v]) => [k, String(v ?? '')])))
        headers = Object.keys(list[0] ?? {})
      } else {
        const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).filter(Boolean)
        headers = (lines[0] ?? '').split(',').map((x) => x.trim())
        list = lines.slice(1).map((line) => Object.fromEntries(headers.map((h, i) => [h, (line.split(',')[i] ?? '').trim()])))
      }
      if (!list.length) throw new Error('没有识别到数据')
      const mapping = detectMapping(headers)
      setRows(list.map((x) => personFromRow(x, mapping)).filter((x) => x.name || x.candidateNumber))
      toast(`已导入 ${list.length} 人`, 'ok')
    }).catch((e) => toast(e instanceof Error ? e.message : '导入失败', 'err'))
  }

  const sel = design.fields.find((f) => f.id === selected)

  return (
    <Page title="条形码制作" sub="标签设计 · 批量打印" back>
      <Card className="!p-3">
        <div className="flex flex-wrap gap-1.5">
          {LABEL_PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              className={`rounded-full px-2.5 py-1 text-[10.5px] font-bold ${design.width === p.width && design.height === p.height ? 'bg-brand-600 text-white' : 'bg-brand-50 text-brand-700'}`}
              onClick={() => { setDesign(designForPreset(p)); setSelected(null) }}
            >
              {p.name}
            </button>
          ))}
        </div>
      </Card>

      <Card className="mt-3 !p-4">
        <div className="flex items-center justify-between">
          <p className="text-[12px] font-extrabold">标签画布</p>
          <span className="mo-muted">{design.width}×{design.height}mm</span>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-1.5 rounded-xl bg-brand-50 px-2 py-1.5">
          <span className="text-[10px] font-bold text-ink-soft">缩放</span>
          <button type="button" className="h-6 w-6 rounded-md border border-brand-200 bg-white text-[13px] font-black text-brand-700" onClick={() => setZoom((z) => Math.max(0.75, Math.round((z - 0.25) * 100) / 100))}>−</button>
          <span className="w-10 text-center text-[10px] font-bold">{Math.round(zoom * 100)}%</span>
          <button type="button" className="h-6 w-6 rounded-md border border-brand-200 bg-white text-[13px] font-black text-brand-700" onClick={() => setZoom((z) => Math.min(4, Math.round((z + 0.25) * 100) / 100))}>＋</button>
          <button type="button" className="rounded-md border border-brand-200 bg-white px-2 py-1 text-[9.5px] font-bold text-brand-700" onClick={() => setZoom(1)}>100%</button>
          <button type="button" className="rounded-md border border-brand-200 bg-white px-2 py-1 text-[9.5px] font-bold text-brand-700" onClick={() => setZoom(2)}>适应</button>
        </div>
        <div className="mt-3 flex justify-center overflow-auto rounded-2xl bg-neutral-100 p-3">
          <div className="shrink-0" style={{ width: `${design.width * zoom}mm`, height: `${design.height * zoom}mm` }}>
            <div
              className="mo-barcode-canvas relative flex-none origin-top-left bg-white shadow"
              style={{ width: `${design.width}mm`, height: `${design.height}mm`, transform: `scale(${zoom})` }}
              onPointerDown={() => setSelected(null)}
            >
            {design.fields.map((f) => (
              <div
                key={f.id}
                className={`absolute overflow-hidden ${selected === f.id ? 'outline outline-2 outline-brand-500' : ''}`}
                style={{ left: `${f.x}mm`, top: `${f.y}mm`, width: `${f.w}mm`, height: `${f.h}mm`, fontSize: `${f.fontSize}mm`, fontWeight: f.bold ? 800 : 600, textAlign: f.align ?? 'left', touchAction: 'none' }}
                onPointerDown={(e) => startDrag(e, f)}
              >
                {f.key === 'barcode' ? (
                  <BarcodeSvg format={design.format} value={fieldValue(f, previewPerson) || '2026001'} showText={design.showText} />
                ) : (
                  <span className="block truncate">{fieldValue(f, previewPerson) || FIELD_PLACEHOLDER[f.key]}</span>
                )}
                {selected === f.id && (
                  <>
                    <span data-resize className="absolute -bottom-1 -right-1 h-2.5 w-2.5 rounded-sm bg-brand-600" onPointerDown={(e) => startResize(e, f, 'both')} />
                    <span data-resize className="absolute -bottom-1 right-2 h-2.5 w-2.5 rounded-sm bg-brand-600" onPointerDown={(e) => startResize(e, f, 'bottom')} />
                    <span data-resize className="absolute -right-1 bottom-2 h-2.5 w-2.5 rounded-sm bg-brand-600" onPointerDown={(e) => startResize(e, f, 'right')} />
                  </>
                )}
              </div>
              ))}
            </div>
          </div>
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {(['barcode', 'name', 'school', 'seat', 'room', 'candidateNumber', 'className', 'custom'] as const).map((k) => (
            <button key={k} type="button" className="rounded-lg bg-brand-50 px-2 py-1 text-[10px] font-bold text-brand-700" onClick={() => addField(k)}>+{FIELD_LABELS[k]}</button>
          ))}
        </div>
        {sel && (
          <div className="mt-2 grid grid-cols-2 gap-1.5 rounded-xl bg-brand-50/50 p-2">
            {(['x', 'y', 'w', 'h', 'fontSize'] as const).map((k) => (
              <label key={k} className="text-[9.5px] font-bold text-ink-soft">
                {k === 'fontSize' ? '字号mm' : `${k}mm`}
                <input
                  type="number"
                  className="mt-0.5 w-full rounded-lg border border-brand-200 bg-white px-1.5 py-1 text-[11px]"
                  value={sel[k]}
                  onChange={(e) => patchField(sel.id, { [k]: Number(e.target.value) } as Partial<BarcodeField>)}
                />
              </label>
            ))}
            <button type="button" className="rounded-lg bg-red-50 px-2 py-1 text-[10px] font-bold text-red-600" onClick={() => { setDesign((d) => ({ ...d, fields: d.fields.filter((f) => f.id !== sel.id) })); setSelected(null) }}>
              <IcTrash /> 删除组件
            </button>
          </div>
        )}
      </Card>

      <Card className="mt-3 !p-3">
        <div className="flex items-center justify-between">
          <p className="text-[12px] font-extrabold">数据</p>
          <span className="mo-muted">{printPeople.length} 张</span>
        </div>
        <div className="mt-2 flex gap-1.5">
          <input className="mo-input !h-9 min-w-0 flex-1" placeholder="手动输入条码数字" value={manual} onChange={(e) => setManual(e.target.value.replace(/\s/g, ''))} />
          <Btn sm variant="ghost" onClick={() => fileRef.current?.click()}><IcUpload /> 导入</Btn>
        </div>
        <input ref={fileRef} type="file" accept=".json,.csv,.txt" className="hidden" onChange={(e) => importFile(e.target.files?.[0])} />
        <div className="mt-2 flex gap-1.5">
          <Btn sm variant="ghost" onClick={() => download('条形码数据源.csv', CSV, 'text/csv;charset=utf-8')}><IcUpload /> CSV 模板</Btn>
          <Btn sm variant="ghost" onClick={() => download('条形码数据源.json', JSON.stringify([SAMPLE], null, 2), 'application/json')}><IcUpload /> JSON</Btn>
          <Btn sm variant="ghost" onClick={() => { setManual(''); void studentsApi.list().then((list) => setRows(list.map((s) => ({ ...DEFAULT_PERSON, school: '', seat: '', room: '', name: s.name, candidateNumber: s.candidateNumber || '', className: s.className || '' })))).catch(() => toast('学生接口不可用，已保留本机名单', 'err')) }}><IcUsers /> 学生</Btn>
        </div>
        <p className="mo-muted mt-2">学生源只提供姓名/考号/班级；学校、座号、考场号在画布上手动填写。</p>
        <div className="mt-2 max-h-48 space-y-1 overflow-y-auto">
          {(manual ? [{ ...DEFAULT_PERSON, candidateNumber: manual }] : rows).slice(0, 60).map((p, i) => (
            <div key={i} className="flex items-center gap-2 rounded-lg bg-neutral-50 px-2 py-1.5">
              <span className="min-w-0 flex-1 truncate text-[11px] font-bold">{p.name}</span>
              <span className="text-[10px] text-ink-soft/55">{p.candidateNumber}</span>
            </div>
          ))}
        </div>
      </Card>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <Btn variant="ghost" onClick={() => nav('/m/papers')}>返回试卷</Btn>
        <Btn onClick={() => window.print()} disabled={!printPeople.length}><IcLayers /> 打印标签</Btn>
      </div>

      <style>{`@media print { @page { size: ${design.width}mm ${design.height}mm; margin: 0; } body * { visibility: hidden !important; } .mo-barcode-print, .mo-barcode-print * { visibility: visible !important; } .mo-barcode-print { display: block !important; position: absolute; left: 0; top: 0; } }`}</style>
      <div className="mo-barcode-print hidden">
        {printPeople.map((p, i) => (
          <div key={i} style={{ width: `${design.width}mm`, height: `${design.height}mm`, position: 'relative', pageBreakAfter: 'always', background: '#fff' }}>
            {design.fields.map((f) => (
              <div key={f.id} style={{ position: 'absolute', left: `${f.x}mm`, top: `${f.y}mm`, width: `${f.w}mm`, height: `${f.h}mm`, fontSize: `${f.fontSize}mm`, fontWeight: f.bold ? 800 : 600, textAlign: f.align ?? 'left' }}>
                {f.key === 'barcode' ? <BarcodeSvg format={design.format} value={fieldValue(f, p) || p.candidateNumber} showText={design.showText} /> : <span>{fieldValue(f, p) || FIELD_PLACEHOLDER[f.key]}</span>}
              </div>
            ))}
          </div>
        ))}
      </div>
    </Page>
  )
}

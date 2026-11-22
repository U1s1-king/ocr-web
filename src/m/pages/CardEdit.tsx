import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { papersApi } from '../api'
import type { Region } from '../../api/types'
import { useToast } from '../../components/Toast'
import { CardSheet } from '../../lib/card/render'
import { addChoiceGroup, addPresetBlock, addSubjectiveGroup, groupOf, splitGroup } from '../../lib/card/components'
import { BARCODE_FORMATS, validateBarcode } from '../../lib/card/barcode'
import { ANSWER_CARD_BARCODE_AREA } from '../../lib/barcode/templates'
import { cloneDoc, mm2u, paperMm, u2mm, type CardDoc, type CardGroup, type CardBarcode, type CardBarcodeFormat } from '../../lib/card/types'
import { resolveDoc, savePaperDoc } from '../../lib/card/store'
import { backAsDoc, createBackDoc, withBack } from '../../lib/card/back'
import { reflowTwoPages } from '../../lib/card/reflow'
import { Btn, Card, Page, Sheet } from '../ui'
import { IcBack, IcLayers, IcPlus, IcSliders, IcTrash } from '../icons'

const PX_PER_MM = 96 / 25.4
const mm = (v: number) => `${Math.round(v * 100) / 100}mm`

/** 移动端基础编辑器：点选/拖动/数值精调/组件库；复杂排版回桌面精调 */
export default function CardEdit() {
  const { id } = useParams()
  const pid = Number(id)
  const nav = useNavigate()
  const toast = useToast()

  const [frontDoc, setFrontDoc] = useState<CardDoc | null>(null)
  const [backDoc, setBackDoc] = useState<CardDoc | null>(null)
  const [side, setSide] = useState<'front' | 'back'>('front')
  const doc = side === 'front' ? frontDoc : backDoc
  const setDoc = (value: CardDoc | null) => {
    if (side === 'front') setFrontDoc(value)
    else setBackDoc(value)
  }

  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [zoom, setZoom] = useState(0.5)
  const [sel, setSel] = useState<string | null>(null)
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [libOpen, setLibOpen] = useState(false)
  const [layersOpen, setLayersOpen] = useState(false)
  const [choiceCount, setChoiceCount] = useState(10)
  const [choiceOpts, setChoiceOpts] = useState(4)
  const [choiceScore, setChoiceScore] = useState(2)
  const [subjCount, setSubjCount] = useState(3)
  const [subjRows, setSubjRows] = useState(6)
  const [subjStyle, setSubjStyle] = useState<'lines' | 'blank' | 'grid'>('lines')
  const [blankCount, setBlankCount] = useState(2)
  const [barcodeFormat, setBarcodeFormat] = useState<CardBarcodeFormat>('CODE128')
  const [barcodeValue, setBarcodeValue] = useState('')
  const [barcodeShowText, setBarcodeShowText] = useState(true)

  const drag = useRef<{ ids: string[]; sx: number; sy: number; origins: Map<string, Region> } | null>(null)
  const hits = useRef(new Map<string, HTMLElement>())

  useEffect(() => {
    if (!Number.isFinite(pid) || pid <= 0) {
      setErr('试卷 id 不合法')
      setLoading(false)
      return
    }
    papersApi
      .get(pid)
      .then((p) => {
        const resolved = resolveDoc(pid, p.paper as never, p.name)
        setFrontDoc(resolved.doc)
        setBackDoc(resolved.doc.back ? backAsDoc(resolved.doc) : null)
        setSide('front')
      })
      .catch((e) => setErr(e instanceof Error ? e.message : '载入失败'))
      .finally(() => setLoading(false))
  }, [pid])

  useEffect(() => {
    if (!doc) return
    const page = paperMm(doc.meta.paperSize, doc.meta.orientation)
    const fit = (window.innerWidth - 34) / (page.w * PX_PER_MM)
    setZoom(Math.max(0.28, Math.min(1, Math.round(fit * 100) / 100)))
  }, [doc?.meta.paperSize, doc?.meta.orientation, doc])

  if (loading) {
    return (
      <Page title="编辑答题卡" back>
        <div className="grid place-items-center py-20 text-ink-soft">
          正在载入…
        </div>
      </Page>
    )
  }
  if (!doc) {
    return (
      <Page title="编辑答题卡" back>
        <Card>{err || '没有可编辑的答题卡'}</Card>
      </Page>
    )
  }

  const page = paperMm(doc.meta.paperSize, doc.meta.orientation)
  const pxPerMm = PX_PER_MM * zoom
  const selQ = sel ? doc.content.questions.find((q) => q.id === sel) : undefined
  const selB = sel ? (doc.content.blocks ?? []).find((b) => b.id === sel) : undefined
  const selGroup = sel ? (doc.groups ?? []).find((g) => g.itemIds.includes(sel)) : undefined
  const selectedGroup = selGroup
  const selBar = sel ? (doc.barcodes ?? []).find((bc) => bc.id === sel) : undefined
  const region = selQ?.region ?? selB?.region ?? selBar?.region

  function pushDoc(next: CardDoc) {
    setDoc(next)
    setDirty(true)
  }

  function startsDrag(e: React.PointerEvent, itemId: string) {
    if (!doc) return
    const grp = groupOf(doc, itemId)
    const ids = grp ? grp.itemIds : [itemId]
    e.preventDefault()
    setSel(itemId)
    drag.current = { ids, sx: e.clientX, sy: e.clientY, origins: new Map() }
    for (const id of ids) {
      const r = doc.content.questions.find((q) => q.id === id)?.region ?? doc.content.blocks?.find((b) => b.id === id)?.region
      if (r) drag.current.origins.set(id, { ...r })
    }
    const el = hits.current.get(itemId)
    try {
      el?.setPointerCapture(e.nativeEvent.pointerId)
    } catch {
      /* ignore */
    }
  }

  function moveDrag(e: React.PointerEvent) {
    const d = drag.current
    if (!d || !doc) return
    const dx = e.clientX - d.sx
    const dy = e.clientY - d.sy
    for (const id of d.ids) {
      const el = hits.current.get(id)
      if (el) el.style.transform = `translate(${dx / zoom}px, ${dy / zoom}px)`
    }
  }

  function endDrag(e: React.PointerEvent) {
    const d = drag.current
    drag.current = null
    if (!d || !doc) return
    const dx = e.clientX - d.sx
    const dy = e.clientY - d.sy
    if (Math.abs(dx) < 2 && Math.abs(dy) < 2) {
      for (const id of d.ids) {
        const el = hits.current.get(id)
        if (el) el.style.transform = ''
      }
      return
    }
    const next = cloneDoc(doc)
    for (const [id, orig] of d.origins) {
      const w = u2mm(orig.width)
      const h = u2mm(orig.height)
      const x = Math.max(0, Math.min(page.w - w, u2mm(orig.x) + dx / pxPerMm))
      const y = Math.max(0, Math.min(page.h - h, u2mm(orig.y) + dy / pxPerMm))
      const q = next.content.questions.find((x2) => x2.id === id)
      const b = next.content.blocks?.find((x2) => x2.id === id)
      if (q) q.region = { ...q.region, x: mm2u(x), y: mm2u(y) }
      if (b) b.region = { ...b.region, x: mm2u(x), y: mm2u(y) }
      const bc = next.barcodes?.find((x2) => x2.id === id)
      if (bc) bc.region = { ...bc.region, x: mm2u(x), y: mm2u(y) }
    }
    for (const id of d.ids) {
      const el = hits.current.get(id)
      if (el) el.style.transform = ''
    }
    pushDoc(next)
  }

  function addGenerated(result: { doc: CardDoc; group: CardGroup }) {
    if (!doc) return
    pushDoc(result.doc)
    setSel(result.group.itemIds[0] ?? null)
    setLibOpen(false)
    toast(`已添加${result.group.name}`, 'ok')
  }

  function addChoice() {
    if (!doc) return
    addGenerated(addChoiceGroup(doc, { count: choiceCount, options: choiceOpts, score: choiceScore }))
  }
  function addSubjective() {
    if (!doc) return
    addGenerated(addSubjectiveGroup(doc, { count: subjCount, rows: subjRows, style: subjStyle, score: 10 }))
  }
  function addBlank() {
    if (!doc) return
    addGenerated(addSubjectiveGroup(doc, { count: blankCount, style: 'blank', heightMm: 30, score: 10 }))
  }
  function addPreset(kind: 'text' | 'title' | 'section' | 'divider' | 'notice' | 'student' | 'barcode' | 'header' | 'footer') {
    if (!doc) return
    addGenerated(addPresetBlock(doc, kind))
  }

  function patchRegion(k: 'x' | 'y' | 'width' | 'height', value: number) {
    if (!doc || !sel || !region) return
    const next = cloneDoc(doc)
    const q = next.content.questions.find((q2) => q2.id === sel)
    const b = next.content.blocks?.find((b2) => b2.id === sel)
    const r = { ...region, [k]: mm2u(Math.max(k === 'width' || k === 'height' ? 4 : 0, value)) }
    if (k === 'width') r.width = mm2u(Math.max(4, value))
    if (k === 'height') r.height = mm2u(Math.max(4, value))
    if (q) q.region = r
    if (b) b.region = r
    pushDoc(next)
  }

  function patchQuestion(patch: Record<string, unknown>) {
    if (!doc || !sel || !selQ) return
    const next = cloneDoc(doc)
    const q = next.content.questions.find((q2) => q2.id === sel)
    if (q) Object.assign(q, patch)
    pushDoc(next)
  }

  function patchRows(rows: number) {
    if (!doc || !sel || !selQ) return
    const next = cloneDoc(doc)
    next.qmeta[sel] = { ...(next.qmeta[sel] ?? { style: 'lines' }), rows: Math.max(1, rows) }
    pushDoc(next)
  }

  function addBarcode() {
    if (!doc) return
    const bad = validateBarcode(barcodeFormat, barcodeValue)
    if (bad) {
      toast(bad, 'err')
      return
    }
    const page = paperMm(doc.meta.paperSize, doc.meta.orientation)
    const maxY = Math.max(14, ...doc.content.questions.map((q) => (q.region.y + q.region.height) * 0.7))
    const id = `bc${Date.now().toString(36)}`
    const bc: CardBarcode = {
      id,
      format: barcodeFormat,
      value: barcodeValue.trim(),
      showText: barcodeShowText,
      region: { x: mm2u(page.w - 14 - ANSWER_CARD_BARCODE_AREA.width), y: mm2u(Math.min(page.h - ANSWER_CARD_BARCODE_AREA.height - 2, maxY + 3)), width: mm2u(ANSWER_CARD_BARCODE_AREA.width), height: mm2u(ANSWER_CARD_BARCODE_AREA.height) },
    }
    const next = cloneDoc(doc)
    next.barcodes = [...(next.barcodes ?? []), bc]
    next.groups = [...(next.groups ?? []), { id: `grpbc${id}`, kind: 'barcode', name: `条形码 · ${bc.value}`, itemIds: [id] }]
    setSel(id)
    setLibOpen(false)
    pushDoc(next)
    toast('已添加自定义条形码', 'ok')
  }

  function patchBarcode(patch: Partial<CardBarcode>) {
    if (!doc || !selBar) return
    const next = cloneDoc(doc)
    const bc = next.barcodes?.find((b) => b.id === sel)
    if (bc) Object.assign(bc, patch)
    pushDoc(next)
  }

  function removeSelected() {
    if (!doc || !sel) return
    const next = cloneDoc(doc)
    next.content.questions = next.content.questions.filter((q) => q.id !== sel)
    next.content.blocks = (next.content.blocks ?? []).filter((b) => b.id !== sel)
    next.barcodes = (next.barcodes ?? []).filter((bc) => bc.id !== sel)
    delete next.qmeta[sel]
    delete next.bmeta[sel]
    next.groups = (next.groups ?? []).map((g) => ({ ...g, itemIds: g.itemIds.filter((x) => x !== sel) })).filter((g) => g.itemIds.length)
    setSel(null)
    pushDoc(next)
  }

  function splitSelectedGroup() {
    if (!selectedGroup) return
    splitGroupNow(selectedGroup.id)
  }

  function splitGroupNow(gid: string) {
    if (!doc) return
    pushDoc(splitGroup(doc, gid))
    toast('已拆成独立小题', 'ok')
  }

  async function save() {
    if (!doc) return
    setSaving(true)
    try {
      if (!frontDoc) return
      await savePaperDoc(pid, withBack(frontDoc, backDoc))
      setDirty(false)
      toast('已保存到后端', 'ok')
    } catch (e) {
      toast(e instanceof Error ? e.message : '保存失败', 'err')
    } finally {
      setSaving(false)
    }
  }

  const allItems = [
    ...doc.content.questions.map((q) => ({ id: q.id, label: q.type === 'mark' ? `选择题 ${q.displayNumber ?? ''}` : `主观题 ${q.displayNumber ?? ''}` })),
    ...(doc.content.blocks ?? []).map((b) => ({ id: b.id, label: b.text.slice(0, 16) || '文本块' })),
    ...(doc.barcodes ?? []).map((bc) => ({ id: bc.id, label: `条形码 · ${bc.value}` })),
  ]
  const groupedIds = new Set((doc.groups ?? []).flatMap((g) => g.itemIds))
  const looseItems = allItems.filter((it) => !groupedIds.has(it.id))
  const hitItems = allItems.filter((it) => !(doc.hidden ?? []).includes(it.id))

  return (
    <Page
      title="编辑答题卡"
      sub={`${doc.meta.paperSize} · ${doc.content.questions.length} 题`}
      back
      actions={
        <Btn sm onClick={() => void save()} disabled={saving}>
          {saving ? '保存中' : dirty ? '保存' : '保存'}
        </Btn>
      }
    >
      {err && <Card className="mb-3">{err}</Card>}

      <div className="mb-2 flex flex-wrap items-center gap-1.5">
        <Btn sm variant={side === 'front' ? undefined : 'ghost'} onClick={() => setSide('front')}>正面</Btn>
        {backDoc && <Btn sm variant={side === 'back' ? undefined : 'ghost'} onClick={() => setSide('back')}>背面</Btn>}
        {!backDoc ? (
          <Btn sm variant="ghost" onClick={() => {
            if (!frontDoc) return
            const re = reflowTwoPages(frontDoc, createBackDoc(frontDoc, 'blank'))
            setFrontDoc(re.front)
            setBackDoc(re.back)
            setSide('front')
            setDirty(true)
            toast(`已生成双面：${re.profile.label}`, 'ok')
          }}>双面自动分页</Btn>
        ) : (
          <Btn sm variant="ghost" onClick={() => {
            if (!frontDoc) return
            const re = reflowTwoPages(frontDoc, backDoc)
            setFrontDoc(re.front)
            setBackDoc(re.back)
            setSide('front')
            setDirty(true)
            toast(re.overflow ? '两页也放不下，请减少内容' : `已重新分页：${re.profile.label}`, re.overflow ? 'err' : 'ok')
          }}>重新分页</Btn>
        )}
      </div>

      <div className="card-edit-viewport">
        <div className="card-edit-paper" style={{ width: page.w * pxPerMm, height: page.h * pxPerMm }}>
          <CardSheet doc={doc} zoom={zoom}>
            {hitItems.map((it) => {
              const r = doc.content.questions.find((q) => q.id === it.id)?.region ?? doc.content.blocks?.find((b) => b.id === it.id)?.region
              if (!r) return null
              const selected = sel === it.id
              return (
                <div
                  key={it.id}
                  ref={(el) => {
                    if (el) hits.current.set(it.id, el)
                    else hits.current.delete(it.id)
                  }}
                  style={{
                    position: 'absolute',
                    left: mm(u2mm(r.x)),
                    top: mm(u2mm(r.y)),
                    width: mm(u2mm(r.width)),
                    height: mm(u2mm(r.height)),
                    zIndex: selected ? 8 : 4,
                    outline: selected ? '0.4mm solid #a6342a' : undefined,
                    touchAction: 'none',
                  }}
                  onPointerDown={(e) => startsDrag(e, it.id)}
                  onPointerMove={moveDrag}
                  onPointerUp={endDrag}
                  onPointerCancel={endDrag}
                />
              )
            })}
          </CardSheet>
        </div>
      </div>

      <div className="mt-3 flex gap-2">
        <Btn block onClick={() => setLibOpen(true)}>
          <IcPlus style={{ fontSize: 15 }} /> 添加组件
        </Btn>
        <Btn block variant="ghost" onClick={() => setLayersOpen(true)}>
          <IcLayers style={{ fontSize: 15 }} /> 图层
        </Btn>
        <Btn
          variant="ghost"
          onClick={() => {
            const next = Math.max(0.28, Math.round((zoom - 0.1) * 100) / 100)
            setZoom(next)
          }}
        >
          −
        </Btn>
        <Btn variant="ghost" onClick={() => setZoom((z) => Math.min(1, Math.round((z + 0.1) * 100) / 100))}>
          +
        </Btn>
      </div>

      {sel && region && (
        <Card className="mt-3 !p-4">
          <div className="flex items-center gap-2">
            <p className="text-[13px] font-extrabold">元素属性</p>
            {selectedGroup && (
              <button type="button" className="mo-btn-soft ml-auto" onClick={splitSelectedGroup}>
                拆成小题
              </button>
            )}
            <button type="button" className={`${selectedGroup ? '' : 'ml-auto'} text-ink-soft`} onClick={removeSelected} aria-label="删除">
              <IcTrash style={{ fontSize: 16 }} />
            </button>
          </div>
          <div className="mt-3 grid grid-cols-4 gap-2">
            {(['x', 'y', 'width', 'height'] as const).map((k) => (
              <label key={k} className="mo-field">
                <span className="mo-field-label">{k === 'width' ? '宽mm' : k === 'height' ? '高mm' : `${k} mm`}</span>
                <input
                  className="mo-input"
                  type="number"
                  step={0.5}
                  value={u2mm(region[k])}
                  onChange={(e) => patchRegion(k, Number(e.target.value))}
                />
              </label>
            ))}
          </div>
          {selBar && (
            <div className="mt-3 grid grid-cols-2 gap-2">
              <label className="mo-field">
                <span className="mo-field-label">格式</span>
                <select className="mo-input" value={selBar.format} onChange={(e) => patchBarcode({ format: e.target.value as CardBarcodeFormat })}>
                  {BARCODE_FORMATS.map((f) => (
                    <option key={f.value} value={f.value}>{f.label}</option>
                  ))}
                </select>
              </label>
              <label className="mo-field">
                <span className="mo-field-label">显示文字</span>
                <select className="mo-input" value={selBar.showText === false ? '0' : '1'} onChange={(e) => patchBarcode({ showText: e.target.value === '1' })}>
                  <option value="1">显示</option>
                  <option value="0">隐藏</option>
                </select>
              </label>
              <label className="mo-field col-span-2">
                <span className="mo-field-label">条形码内容</span>
                <input className="mo-input" value={selBar.value} onChange={(e) => patchBarcode({ value: e.target.value })} />
              </label>
            </div>
          )}

          {selQ && (
            <div className="mt-3 grid grid-cols-3 gap-2">
              <label className="mo-field">
                <span className="mo-field-label">题号</span>
                <input className="mo-input" type="number" value={selQ.displayNumber ?? 0} onChange={(e) => patchQuestion({ displayNumber: Number(e.target.value) })} />
              </label>
              <label className="mo-field">
                <span className="mo-field-label">分值</span>
                <input className="mo-input" type="number" step={0.5} value={selQ.score ?? 0} onChange={(e) => patchQuestion({ score: Math.max(0.5, Number(e.target.value)) })} />
              </label>
              {selQ.type === 'subjective' && (
                <label className="mo-field">
                  <span className="mo-field-label">行数</span>
                  <input className="mo-input" type="number" min={1} value={doc.qmeta[selQ.id]?.rows ?? 4} onChange={(e) => patchRows(Number(e.target.value))} />
                </label>
              )}
            </div>
          )}
        </Card>
      )}

      {!sel && (
        <Card className="mt-3">
          <p className="text-[12px] font-bold">点选画布上的题目/文本框进行拖动</p>
          <p className="mo-muted mt-1">组件库可批量添加选择题组、主观题组和空白框；精细排版请回桌面端。</p>
        </Card>
      )}

      <Sheet open={libOpen} onClose={() => setLibOpen(false)} title="添加组件">
        <div className="space-y-3">
          <div className="mo-card !p-3">
            <p className="text-[12px] font-extrabold">选择题组</p>
            <div className="mt-2 grid grid-cols-3 gap-2">
              <label className="mo-field"><span className="mo-field-label">题数</span><input className="mo-input" type="number" value={choiceCount} onChange={(e) => setChoiceCount(Number(e.target.value))} /></label>
              <label className="mo-field"><span className="mo-field-label">选项数</span><input className="mo-input" type="number" value={choiceOpts} onChange={(e) => setChoiceOpts(Number(e.target.value))} /></label>
              <label className="mo-field"><span className="mo-field-label">分值</span><input className="mo-input" type="number" value={choiceScore} onChange={(e) => setChoiceScore(Number(e.target.value))} /></label>
            </div>
            <div className="mt-2"><Btn block onClick={addChoice}>添加选择题组</Btn></div>
          </div>
          <div className="mo-card !p-3">
            <p className="text-[12px] font-extrabold">主观题组</p>
            <div className="mt-2 grid grid-cols-3 gap-2">
              <label className="mo-field"><span className="mo-field-label">题数</span><input className="mo-input" type="number" value={subjCount} onChange={(e) => setSubjCount(Number(e.target.value))} /></label>
              <label className="mo-field"><span className="mo-field-label">行数</span><input className="mo-input" type="number" value={subjRows} onChange={(e) => setSubjRows(Number(e.target.value))} /></label>
              <label className="mo-field"><span className="mo-field-label">样式</span><select className="mo-input" value={subjStyle} onChange={(e) => setSubjStyle(e.target.value as 'lines' | 'blank' | 'grid')}><option value="lines">横线</option><option value="blank">空白</option><option value="grid">方格</option></select></label>
            </div>
            <div className="mt-2"><Btn block onClick={addSubjective}>添加主观题组</Btn></div>
          </div>
          <div className="mo-card !p-3">
            <p className="text-[12px] font-extrabold">空白方框（数学/历史）</p>
            <label className="mo-field mt-2"><span className="mo-field-label">个数</span><input className="mo-input" type="number" value={blankCount} onChange={(e) => setBlankCount(Number(e.target.value))} /></label>
            <div className="mt-2"><Btn block onClick={addBlank}>添加空白方框组</Btn></div>
          </div>
          <div className="mo-card !p-3">
            <p className="text-[12px] font-extrabold">自定义条形码</p>
            <label className="mo-field mt-2">
              <span className="mo-field-label">内容</span>
              <input className="mo-input" placeholder="例如 20261109001" value={barcodeValue} onChange={(e) => setBarcodeValue(e.target.value)} />
            </label>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <label className="mo-field">
                <span className="mo-field-label">格式</span>
                <select className="mo-input" value={barcodeFormat} onChange={(e) => setBarcodeFormat(e.target.value as CardBarcodeFormat)}>
                  {BARCODE_FORMATS.map((f) => (
                    <option key={f.value} value={f.value}>{f.label}</option>
                  ))}
                </select>
              </label>
              <label className="mo-field">
                <span className="mo-field-label">显示文字</span>
                <select className="mo-input" value={barcodeShowText ? '1' : '0'} onChange={(e) => setBarcodeShowText(e.target.value === '1')}>
                  <option value="1">显示</option>
                  <option value="0">隐藏</option>
                </select>
              </label>
            </div>
            <div className="mt-2"><Btn block onClick={addBarcode}>添加自定义条形码</Btn></div>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {([
              ['text', '文本'], ['title', '标题'], ['section', '分组标题'], ['divider', '分割线'],
              ['notice', '注意事项'], ['student', '学生信息'], ['barcode', '条形码占位'], ['header', '页眉'], ['footer', '页脚/页码'],
            ] as const).map(([k, label]) => (
              <button key={k} type="button" className="mo-btn mo-btn-ghost mo-btn-sm" onClick={() => addPreset(k)}>{label}</button>
            ))}
          </div>
        </div>
      </Sheet>

      <Sheet open={layersOpen} onClose={() => setLayersOpen(false)} title="图层">
        <div className="space-y-2">
          {(doc.groups ?? []).map((g) => (
            <div key={g.id} className="mo-card !p-3">
              <div className="flex items-center gap-2">
                <button type="button" className="min-w-0 flex-1 truncate text-left text-[12px] font-extrabold" onClick={() => { setSel(g.itemIds[0] ?? null); setLayersOpen(false) }}>
                  {g.name}
                </button>
                <button type="button" className="mo-btn-soft" onClick={() => splitGroupNow(g.id)}>拆组</button>
              </div>
              <p className="mo-muted mt-1">{g.itemIds.length} 个子元素</p>
            </div>
          ))}
          {looseItems.map((it) => (
            <button key={it.id} type="button" className="mo-card w-full !p-3 text-left text-[12px] font-bold" onClick={() => { setSel(it.id); setLayersOpen(false) }}>
              {it.label}
            </button>
          ))}
        </div>
      </Sheet>

      <div className="mt-3 flex justify-center gap-2">
        <Btn variant="ghost" onClick={() => nav(`/m/papers/${pid}`)}>
          <IcBack style={{ fontSize: 15 }} /> 返回试卷
        </Btn>
        <Btn variant="ghost" onClick={() => setLayersOpen(true)}>
          <IcSliders style={{ fontSize: 15 }} /> 图层
        </Btn>
      </div>
    </Page>
  )
}

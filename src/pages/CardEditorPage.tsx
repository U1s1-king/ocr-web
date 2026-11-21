import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import Moveable from 'react-moveable'
import Selecto from 'selecto'
import { PageHeader } from '../components/PageHeader'
import { AlertIcon, DownloadIcon, PlusIcon, SaveIcon, TrashIcon } from '../components/icons'
import { Badge, Button, Card, Field, Spinner, inputCls } from '../components/ui'
import { useToast } from '../components/Toast'
import { errorText } from '../api/client'
import { papersApi, studentsApi, type Student } from '../m/api'
import type { Block, Question, Region } from '../api/types'
import { CardSheet } from '../lib/card/render'
import { addChoiceGroup, addPresetBlock, addSubjectiveGroup, groupOf, splitGroup } from '../lib/card/components'
import { BARCODE_FORMATS, validateBarcode } from '../lib/card/barcode'
import { ANSWER_CARD_BARCODE_AREA } from '../lib/barcode/templates'
import { backAsDoc, withBack, type BackPreset } from '../lib/card/back'
import { autoInsertGroup } from '../lib/card/autoLayout'
import { reflowTwoPages } from '../lib/card/reflow'
import {
  createPaperFromDoc,
  readLocalDoc,
  resolveDoc,
  saveLocalDoc,
  savePaperDoc,
  stashDoc,
  takeStashedDoc,
} from '../lib/card/store'
import {
  cloneDoc,
  mm2u,
  type CardGroup,
  type CardBarcode,
  type CardBarcodeFormat,
  paperMm,
  u2mm,
  validateCard,
  type BlockMeta,
  type CardDoc,
  type CardIssue,
  type QuestionMeta,
} from '../lib/card/types'
import { downloadText } from '../lib/image'

const PX_PER_MM = 96 / 25.4
const MIN_MM = 4
const mm = (v: number) => `${Math.round(v * 100) / 100}mm`

interface Live {
  dx: number
  dy: number
  w?: number
  h?: number
  rotate?: number
}

/**
 * PS 式精调：react-moveable 拖动/缩放/旋转/吸附 + selecto 框选多选 +
 * 标尺/图层/mm 数值面板/撤销重做/对齐分布/实时校验。
 */
export default function CardEditorPage() {
  const { id } = useParams()
  const nav = useNavigate()
  const toast = useToast()
  const local = id === 'local' || !id
  const pid = Number(id)

  const [frontDoc, setFrontDoc] = useState<CardDoc | null>(null)
  const [backDoc, setBackDoc] = useState<CardDoc | null>(null)
  const [side, setSide] = useState<'front' | 'back'>('front')
  const doc = side === 'front' ? frontDoc : backDoc
  const setDoc = useCallback(
    (value: CardDoc | null | ((cur: CardDoc | null) => CardDoc | null)) => {
      if (side === 'front') setFrontDoc(value as never)
      else setBackDoc(value as never)
    },
    [side],
  )
  const [loading, setLoading] = useState(true)
  const [loadErr, setLoadErr] = useState('')
  const [title, setTitle] = useState('')
  const [sel, setSel] = useState<string[]>([])
  const [primary, setPrimary] = useState<string | null>(null)
  const [zoom, setZoom] = useState(0.75)
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [showGrid, setShowGrid] = useState(true)
  const [issues, setIssues] = useState<CardIssue[]>([])
  const [showIssues, setShowIssues] = useState(false)
  const [name, setName] = useState('')
  const [targets, setTargets] = useState<HTMLElement[]>([])
  const [guidelines, setGuidelines] = useState<HTMLElement[]>([])
  const [layerOpen, setLayerOpen] = useState(true)
  const [choiceCount, setChoiceCount] = useState(10)
  const [choiceOpts, setChoiceOpts] = useState(4)
  const [choiceScore, setChoiceScore] = useState(2)
  const [subjCount, setSubjCount] = useState(3)
  const [subjRows, setSubjRows] = useState(6)
  const [subjStyle, setSubjStyle] = useState<'lines' | 'blank' | 'grid'>('lines')
  const [subjScore, setSubjScore] = useState(10)
  const [blankCount, setBlankCount] = useState(2)
  const [blankHeight, setBlankHeight] = useState(30)
  const [barcodeFormat, setBarcodeFormat] = useState<CardBarcodeFormat>('CODE128')
  const [barcodeValue, setBarcodeValue] = useState('')
  const [barcodeShowText, setBarcodeShowText] = useState(true)
  const [students, setStudents] = useState<Student[]>([])

  const past = useRef<CardDoc[]>([])
  const future = useRef<CardDoc[]>([])
  const stageRef = useRef<HTMLDivElement>(null)
  const moveableRef = useRef<Moveable>(null)
  const viewportRef = useRef<HTMLDivElement>(null)
  const hits = useRef(new Map<string, HTMLElement>())
  const origins = useRef(new Map<string, Region>())
  const live = useRef(new Map<string, Live>())

  useEffect(() => {
    let alive = true
    async function run() {
      if (local) {
        const d = takeStashedDoc() ?? readLocalDoc()
        if (d) {
          setFrontDoc(d)
          setBackDoc(d.back ? backAsDoc(d) : null)
          setSide('front')
          setTitle(d.meta.title || '本地答题卡')
          setName(d.meta.title || '本地答题卡')
        } else {
          setLoadErr('本地还没有答题卡草稿，请先到「答题卡制作 / 文本出卡」生成一张')
        }
        setLoading(false)
        return
      }
      if (!Number.isFinite(pid) || pid <= 0) {
        setLoadErr('试卷 id 不合法')
        setLoading(false)
        return
      }
      try {
        const p = await papersApi.get(pid)
        if (!alive) return
        const resolved = resolveDoc(pid, p.paper as never, p.name)
        setFrontDoc(resolved.doc)
        setBackDoc(resolved.doc.back ? backAsDoc(resolved.doc) : null)
        setSide('front')
        setTitle(p.name)
        setName(p.name)
      } catch (e) {
        if (!alive) return
        const fallback = readLocalDoc()
        if (fallback) {
          setFrontDoc(fallback)
          setBackDoc(fallback.back ? backAsDoc(fallback) : null)
          setSide('front')
          setTitle(fallback.meta.title || '本地答题卡')
          setLoadErr(`后端读取失败（${errorText(e)}），已打开本地草稿`)
        } else setLoadErr(errorText(e))
      } finally {
        if (alive) setLoading(false)
      }
    }
    void run()
    return () => {
      alive = false
    }
  }, [pid, local])

  useEffect(() => {
    if (frontDoc) setIssues(validateCard(frontDoc))
  }, [doc])

  useEffect(() => {
    studentsApi.list().then(setStudents).catch(() => setStudents([]))
  }, [])

  // 打开时按可视宽度自动缩放到适合屏幕
  useEffect(() => {
    if (!doc) return
    const el = viewportRef.current
    if (!el) return
    const d = paperMm(doc.meta.paperSize, doc.meta.orientation)
    const fit = Math.min(1.4, (el.clientWidth - 48) / (d.w * PX_PER_MM))
    setZoom(Math.max(0.25, Math.round(fit * 100) / 100))
  }, [doc?.meta.paperSize, doc?.meta.orientation])

  useEffect(() => {
    setTargets(sel.map((sid) => hits.current.get(sid)).filter((x): x is HTMLElement => Boolean(x)))
    setGuidelines(
      Array.from(hits.current.entries())
        .filter(([sid]) => !sel.includes(sid))
        .map(([, el]) => el),
    )
  }, [sel, doc])

  /* Selecto：空白处框选 */
  useEffect(() => {
    const el = stageRef.current
    if (!el) return
    const selecto = new Selecto({
      container: el,
      rootContainer: el,
      dragContainer: el,
      selectableTargets: ['.ce-hit'],
      selectByClick: false,
      selectFromInside: false,
      hitRate: 6,
      toggleContinueSelect: ['shift'],
      dragCondition: (ev: any) => !(ev.inputEvent?.target as Element | null)?.closest?.('.ce-hit'),
    })
    const onSelect = (e: any) => {
      if (!e || e.isDragStart || e.isDragStartEnd) return
      const ids = (e.selected ?? [])
        .map((node: HTMLElement) => node.dataset.id)
        .filter((x: string | undefined): x is string => Boolean(x))
      setSel(ids)
      setPrimary(ids[ids.length - 1] ?? null)
    }
    selecto.on('select', onSelect)
    return () => {
      selecto.off('select', onSelect)
      selecto.destroy()
    }
  }, [doc?.meta.paperSize, doc?.meta.orientation, zoom])

  const pushHistory = useCallback(() => {
    setDoc((cur) => {
      if (cur) past.current = [...past.current.slice(-59), cloneDoc(cur)]
      future.current = []
      return cur
    })
  }, [])

  function undo() {
    if (!past.current.length || !doc) return
    const prev = past.current.pop()!
    future.current = [doc, ...future.current]
    setDoc(prev)
    setDirty(true)
    setSel([])
    setPrimary(null)
  }
  function redo() {
    if (!future.current.length || !doc) return
    const next = future.current.shift()!
    past.current = [...past.current, doc]
    setDoc(next)
    setDirty(true)
    setSel([])
    setPrimary(null)
  }

  const dims = doc ? paperMm(doc.meta.paperSize, doc.meta.orientation) : { w: 210, h: 297 }
  const pxPerMm = PX_PER_MM * zoom

  function combinedDoc(): CardDoc | null {
    if (!frontDoc) return null
    return withBack(frontDoc, backDoc)
  }

  function switchSide(next: 'front' | 'back') {
    if (next === 'back' && !backDoc) return
    setSide(next)
    setSel([])
    setPrimary(null)
  }

  function enableBack(preset: BackPreset) {
    if (!frontDoc) return
    pushHistory()
    void preset
    // 强制两页排版：把同一张答题卡的内容重新分配到正反两面
    const result = reflowTwoPages(frontDoc, backDoc)
    setFrontDoc(result.front)
    setBackDoc(result.back)
    setSide('front')
    setSel([])
    setPrimary(null)
    setDirty(true)
    toast('已开启双面，超出正面的内容已自动分页', 'ok')
  }

  function disableBack() {
    setBackDoc(null)
    setSide('front')
    setSel([])
    setPrimary(null)
    setDirty(true)
  }

  function repage() {
    if (!frontDoc) return
    pushHistory()
    const result = reflowTwoPages(frontDoc, backDoc)
    setFrontDoc(result.front)
    setBackDoc(result.back)
    setDirty(true)
    setSel([])
    setPrimary(null)
    toast(result.overflow ? '内容超过两面，请减少题量或换 A3' : '已强制重新分为两页', result.overflow ? 'err' : 'ok')
  }


  function findRegion(d: CardDoc, eid: string): Region | undefined {
    return (
      d.content.questions.find((q) => q.id === eid)?.region ??
      d.content.blocks?.find((b) => b.id === eid)?.region ??
      d.barcodes?.find((bc) => bc.id === eid)?.region
    )
  }
  function setRegion(d: CardDoc, eid: string, r: Region) {
    const q = d.content.questions.find((x) => x.id === eid)
    if (q) q.region = r
    const b = d.content.blocks?.find((x) => x.id === eid)
    if (b) b.region = r
    const bc = d.barcodes?.find((x) => x.id === eid)
    if (bc) bc.region = r
  }
  const isBlock = (eid: string) => Boolean(doc?.content.blocks?.some((b) => b.id === eid) || doc?.barcodes?.some((bc) => bc.id === eid))

  function beginLive(e: any) {
    const eid: string = e.target.dataset.id
    if (!eid) return
    if (!origins.current.has(eid)) {
      const r = doc ? findRegion(doc, eid) : undefined
      if (r) origins.current.set(eid, { ...r })
    }
  }
  function remember(e: any, extra: Partial<Live>) {
    const eid: string = e.target.dataset.id
    if (!eid) return
    live.current.set(eid, { ...(live.current.get(eid) ?? { dx: 0, dy: 0 }), ...extra })
  }

  function onDragStart(e: any) {
    pushHistory()
    live.current.clear()
    origins.current.clear()
    beginLive(e)
  }
  function onDrag(e: any) {
    e.target.style.transform = e.transform
    remember(e, { dx: e.beforeTranslate[0], dy: e.beforeTranslate[1] })
  }
  function onDragGroupStart(e: any) {
    pushHistory()
    live.current.clear()
    origins.current.clear()
    e.events.forEach(beginLive)
  }
  function onDragGroup(e: any) {
    e.events.forEach((ev: any) => {
      ev.target.style.transform = ev.transform
      remember(ev, { dx: ev.beforeTranslate[0], dy: ev.beforeTranslate[1] })
    })
  }
  function onResizeStart(e: any) {
    pushHistory()
    live.current.clear()
    origins.current.clear()
    beginLive(e)
  }
  function onResize(e: any) {
    e.target.style.transform = e.transform
    e.target.style.width = `${e.width / zoom}px`
    e.target.style.height = `${e.height / zoom}px`
    remember(e, { dx: e.drag.beforeTranslate[0], dy: e.drag.beforeTranslate[1], w: e.width, h: e.height })
  }
  function onResizeGroupStart(e: any) {
    pushHistory()
    live.current.clear()
    origins.current.clear()
    e.events.forEach(beginLive)
  }
  function onResizeGroup(e: any) {
    e.events.forEach((ev: any) => {
      ev.target.style.transform = ev.transform
      ev.target.style.width = `${ev.width / zoom}px`
      ev.target.style.height = `${ev.height / zoom}px`
      remember(ev, { dx: ev.drag.beforeTranslate[0], dy: ev.drag.beforeTranslate[1], w: ev.width, h: ev.height })
    })
  }
  function onRotateStart(e: any) {
    pushHistory()
    live.current.clear()
    origins.current.clear()
    beginLive(e)
  }
  function onRotate(e: any) {
    e.target.style.transform = e.transform
    remember(e, { rotate: e.beforeRotate })
  }
  function onRotateEnd(e: any) {
    e.target.style.transform = ''
    commitLive('rotate')
  }
  const dragEnd = () => commitLive('move')
  const resizeEnd = () => commitLive('resize')

  function commitLive(mode: 'move' | 'resize' | 'rotate') {
    if (!doc) return
    const next = cloneDoc(doc)
    let changed = false
    for (const [eid, delta] of live.current.entries()) {
      const orig = origins.current.get(eid)
      if (!orig) continue
      if (mode === 'rotate') {
        next.bmeta[eid] = { ...(next.bmeta[eid] ?? { kind: 'text' }), rotate: Math.round((delta.rotate ?? 0) * 10) / 10 }
        changed = true
        continue
      }
      let x = u2mm(orig.x) + delta.dx / pxPerMm
      let y = u2mm(orig.y) + delta.dy / pxPerMm
      let w = mode === 'resize' && delta.w !== undefined ? delta.w / pxPerMm : u2mm(orig.width)
      let h = mode === 'resize' && delta.h !== undefined ? delta.h / pxPerMm : u2mm(orig.height)
      w = Math.max(MIN_MM, w)
      h = Math.max(MIN_MM, h)
      x = Math.max(0, Math.min(dims.w - w, x))
      y = Math.max(0, Math.min(dims.h - h, y))
      setRegion(next, eid, { x: mm2u(round(x)), y: mm2u(round(y)), width: mm2u(round(w)), height: mm2u(round(h)) })
      changed = true
    }
    live.current.clear()
    origins.current.clear()
    if (changed) {
      setDoc(next)
      setDirty(true)
      // 等 React 用新 region 重绘后再清掉临时 transform/尺寸
      for (const t of hits.current.values()) {
        t.style.transform = ''
        t.style.width = ''
        t.style.height = ''
      }
      requestAnimationFrame(() => moveableRef.current?.updateRect())
    }
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!doc) return
      const el = e.target as HTMLElement
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName)) return
      const mod = e.ctrlKey || e.metaKey
      if (mod && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        e.shiftKey ? redo() : undo()
        return
      }
      if (mod && e.key.toLowerCase() === 's') {
        e.preventDefault()
        void save()
        return
      }
      if (mod && e.key.toLowerCase() === 'a') {
        e.preventDefault()
        const all = [...doc.content.questions.map((q) => q.id), ...(doc.content.blocks ?? []).map((b) => b.id)]
        setSel(all)
        setPrimary(all[0] ?? null)
        return
      }
      if (e.key === 'Escape') {
        setSel([])
        setPrimary(null)
        return
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && sel.length) {
        e.preventDefault()
        removeSelected()
        return
      }
      if (sel.length && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
        e.preventDefault()
        const step = e.shiftKey ? 2 : 0.5
        const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0
        const dy = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0
        const next = cloneDoc(doc)
        for (const eid of sel) {
          const r = findRegion(next, eid)
          if (!r) continue
          setRegion(next, eid, {
            x: mm2u(clamp(u2mm(r.x) + dx, 0, dims.w - u2mm(r.width))),
            y: mm2u(clamp(u2mm(r.y) + dy, 0, dims.h - u2mm(r.height))),
            width: r.width,
            height: r.height,
          })
        }
        pushHistory()
        setDoc(next)
        setDirty(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc, sel])

  async function save() {
    if (!doc || saving) return
    const errors = validateCard(frontDoc ?? doc).filter((i) => i.level === 'error')
    if (errors.length) {
      setShowIssues(true)
      toast(`还有 ${errors.length} 个问题：${errors[0].message}`, 'err')
      return
    }
    setSaving(true)
    try {
      const target = combinedDoc()
      if (!target) return
      if (local) {
        saveLocalDoc(target)
        toast('已保存到本机草稿', 'ok')
      } else {
        await savePaperDoc(pid, target)
        toast(`已保存到试卷 #${pid}`, 'ok')
      }
      setDirty(false)
    } catch (e) {
      toast(errorText(e), 'err')
    } finally {
      setSaving(false)
    }
  }

  async function saveAsNewPaper() {
    if (!doc) return
    if (!name.trim()) {
      toast('请先填写试卷名称', 'err')
      return
    }
    setSaving(true)
    try {
      const target = combinedDoc()
      if (!target) return
      const res = await createPaperFromDoc(target, name.trim())
      toast(`已创建试卷 #${res.id}`, 'ok')
      nav(`/papers/${res.id}/edit`, { replace: true })
    } catch (e) {
      toast(errorText(e), 'err')
    } finally {
      setSaving(false)
    }
  }

  function removeSelected() {
    if (!doc || !sel.length) return
    pushHistory()
    const next = cloneDoc(doc)
    for (const eid of sel) {
      next.content.questions = next.content.questions.filter((q) => q.id !== eid)
      next.content.blocks = (next.content.blocks ?? []).filter((b) => b.id !== eid)
      next.barcodes = (next.barcodes ?? []).filter((bc) => bc.id !== eid)
      delete next.qmeta[eid]
      delete next.bmeta[eid]
      if (next.content.answerKey) delete next.content.answerKey[eid]
    }
    next.groups = (next.groups ?? [])
      .map((g) => ({ ...g, itemIds: g.itemIds.filter((x) => !sel.includes(x)) }))
      .filter((g) => g.itemIds.length > 0)
    setDoc(next)
    setDirty(true)
    setSel([])
    setPrimary(null)
  }

  function duplicateSelected() {
    if (!doc || !sel.length) return
    pushHistory()
    const next = cloneDoc(doc)
    const newSel: string[] = []
    for (const eid of sel) {
      const q = next.content.questions.find((x) => x.id === eid)
      if (q) {
        const id2 = nextQuestionId(next)
        const copy: Question = JSON.parse(JSON.stringify(q))
        copy.id = id2
        copy.region.y = mm2u(u2mm(copy.region.y) + u2mm(copy.region.height) + 1)
        next.content.questions.push(copy)
        if (next.qmeta[eid]) next.qmeta[id2] = { ...next.qmeta[eid] }
        newSel.push(id2)
        continue
      }
      const b = (next.content.blocks ?? []).find((x) => x.id === eid)
      if (b) {
        const id2 = nextBlockId(next)
        const copy: Block = JSON.parse(JSON.stringify(b))
        copy.id = id2
        copy.region.y = mm2u(u2mm(copy.region.y) + u2mm(copy.region.height) + 1)
        next.content.blocks = [...(next.content.blocks ?? []), copy]
        if (next.bmeta[eid]) next.bmeta[id2] = { ...next.bmeta[eid] }
        newSel.push(id2)
      }
    }
    setDoc(next)
    setDirty(true)
    setSel(newSel)
    setPrimary(newSel[0] ?? null)
  }

  function addQuestion(type: 'mark' | 'subjective') {
    if (!doc) return
    pushHistory()
    const next = cloneDoc(doc)
    const id2 = nextQuestionId(next)
    const n = Math.max(1, ...next.content.questions.map((q) => q.displayNumber ?? 0)) + 1
    const region =
      type === 'mark'
        ? { x: mm2u(14), y: mm2u(14 + next.content.questions.length * 8), width: mm2u(70), height: mm2u(7) }
        : {
            x: mm2u(14),
            y: mm2u(14 + next.content.questions.length * 12),
            width: mm2u(dims.w - 28),
            height: mm2u(30),
          }
    const q: Question =
      type === 'mark'
        ? {
            id: id2,
            displayNumber: n,
            type: 'mark',
            score: 2,
            region,
            choices: ['A', 'B', 'C', 'D'].map((value, i) => ({
              value,
              region: { x: round3((6 + i * 5) / 70), y: 0.18, width: round3(4.1 / 70), height: 0.64 },
            })),
          }
        : { id: id2, displayNumber: n, type: 'subjective', score: 10, region }
    next.content.questions.push(q)
    if (type === 'subjective') next.qmeta[id2] = { style: 'lines', rows: 5 }
    setDoc(next)
    setDirty(true)
    setSel([id2])
    setPrimary(id2)
  }

  function addBlock() {
    if (!doc) return
    pushHistory()
    const next = cloneDoc(doc)
    const id2 = nextBlockId(next)
    const b: Block = {
      id: id2,
      type: 'text',
      region: { x: mm2u(14), y: mm2u(14 + (next.content.blocks?.length ?? 0) * 9), width: mm2u(dims.w - 28), height: mm2u(8) },
      text: '双击右侧文本框编辑内容',
      style: { fontSize: 4, fontWeight: 'normal', textAlign: 'left', lineHeight: 1.4 },
    }
    next.content.blocks = [...(next.content.blocks ?? []), b]
    next.bmeta[id2] = { kind: 'text' }
    setDoc(next)
    setDirty(true)
    setSel([id2])
    setPrimary(id2)
  }

  function applyGenerated(result: { doc: CardDoc; group: CardGroup }) {
    pushHistory()
    // 题目组自动排版：选择题插到选择题末尾，主观题顺延，放不下自动移到背面
    if (side === 'front' && frontDoc && ['choice', 'subjective', 'blank'].includes(result.group.kind)) {
      // 默认保留模板双面版式，只做局部顺延；内容超页时由用户点「重新自动分页」强制重排
      const auto = autoInsertGroup(frontDoc, result.doc, backDoc, result.group)
      setFrontDoc(auto.front)
      setBackDoc(auto.back)
      setSide(auto.side)
      setDirty(true)
      setSel(result.group.itemIds)
      setPrimary(result.group.itemIds[0] ?? null)
      if (auto.overflow) toast('内容超页，点「重新自动分页」强制排成两页', 'err')
      else toast(`已添加${result.group.name}，已自动排版`, 'ok')
      return
    }
    setDoc(result.doc)
    setDirty(true)
    setSel(result.group.itemIds)
    setPrimary(result.group.itemIds[0] ?? null)
    const page = paperMm(result.doc.meta.paperSize, result.doc.meta.orientation)
    const maxY = Math.max(
      0,
      ...result.doc.content.questions.map((q) => (q.region.y + q.region.height) * 0.7),
      ...(result.doc.content.blocks ?? []).map((b) => (b.region.y + b.region.height) * 0.7),
    )
    if (maxY > page.h) toast(`新组件已超出纸张 ${Math.round(maxY - page.h)}mm，请拖动或缩短行数`, 'err')
    else toast(`已添加${result.group.name}`, 'ok')
  }

  function addChoice() {
    if (!doc) return
    applyGenerated(addChoiceGroup(doc, { count: choiceCount, options: choiceOpts, score: choiceScore }))
  }

  function addSubjective() {
    if (!doc) return
    applyGenerated(addSubjectiveGroup(doc, { count: subjCount, rows: subjRows, style: subjStyle, score: subjScore }))
  }

  function addBlank() {
    if (!doc) return
    applyGenerated(addSubjectiveGroup(doc, { count: blankCount, style: 'blank', heightMm: blankHeight, score: subjScore }))
  }

  function addCustomBarcode() {
    if (!doc) return
    const bad = validateBarcode(barcodeFormat, barcodeValue)
    if (bad) {
      toast(bad, 'err')
      return
    }
    pushHistory()
    const page = paperMm(doc.meta.paperSize, doc.meta.orientation)
    const maxY = Math.max(
      14,
      ...doc.content.questions.map((q) => (q.region.y + q.region.height) * 0.7),
      ...(doc.content.blocks ?? []).map((b) => (b.region.y + b.region.height) * 0.7),
    )
    const id = `bc${Date.now().toString(36)}`
    const bc: CardBarcode = {
      id,
      format: barcodeFormat,
      value: barcodeValue.trim(),
      showText: barcodeShowText,
      region: { x: mm2u(page.w - 14 - ANSWER_CARD_BARCODE_AREA.width), y: mm2u(Math.min(page.h - ANSWER_CARD_BARCODE_AREA.height - 2, maxY + 3)), width: mm2u(ANSWER_CARD_BARCODE_AREA.width), height: mm2u(ANSWER_CARD_BARCODE_AREA.height) },
    }
    const group: CardGroup = {
      id: `grpbc${Date.now().toString(36)}`,
      kind: 'barcode',
      name: `条形码 · ${bc.value}`,
      itemIds: [id],
      config: { heightMm: 26 },
    }
    const next = cloneDoc(doc)
    next.barcodes = [...(next.barcodes ?? []), bc]
    next.groups = [...(next.groups ?? []), group]
    setDoc(next)
    setDirty(true)
    setSel([id])
    setPrimary(id)
    toast('已添加自定义条形码', 'ok')
  }

  function addPreset(kind: 'text' | 'title' | 'section' | 'divider' | 'notice' | 'student' | 'barcode' | 'header' | 'footer') {
    if (!doc) return
    applyGenerated(addPresetBlock(doc, kind))
  }



  function selectGroup(group: CardGroup) {
    setSel(group.itemIds)
    setPrimary(group.itemIds[0] ?? null)
  }

  function removeGroupById(gid: string) {
    if (!doc) return
    const group = (doc.groups ?? []).find((g) => g.id === gid)
    if (!group) return
    pushHistory()
    const next = cloneDoc(doc)
    const ids = new Set(group.itemIds)
    next.content.questions = next.content.questions.filter((q) => !ids.has(q.id))
    next.content.blocks = (next.content.blocks ?? []).filter((b) => !ids.has(b.id))
    next.barcodes = (next.barcodes ?? []).filter((bc) => !ids.has(bc.id))
    for (const id of ids) {
      delete next.qmeta[id]
      delete next.bmeta[id]
    }
    next.groups = (next.groups ?? []).filter((g) => g.id !== gid)
    setDoc(next)
    setDirty(true)
    setSel([])
    setPrimary(null)
  }

  function patchSelected(patch: {
    region?: Partial<Region>
    q?: Partial<Question>
    block?: Partial<Block>
    qmeta?: Partial<QuestionMeta>
    bmeta?: Partial<BlockMeta>
    barcode?: Partial<CardBarcode>
  }) {
    if (!doc || !primary) return
    pushHistory()
    const next = cloneDoc(doc)
    const bar = next.barcodes?.find((x) => x.id === primary)
    if (bar) {
      if (patch.region) Object.assign(bar.region, patch.region)
      if (patch.barcode) Object.assign(bar, patch.barcode)
      setDoc(next)
      setDirty(true)
      return
    }
    const q = next.content.questions.find((x) => x.id === primary)
    if (q) {
      if (patch.q) Object.assign(q, patch.q)
      if (patch.region) Object.assign(q.region, patch.region)
      if (patch.qmeta) next.qmeta[q.id] = { ...(next.qmeta[q.id] ?? { style: 'lines' }), ...patch.qmeta }
    } else {
      const b = (next.content.blocks ?? []).find((x) => x.id === primary)
      if (!b) return
      if (patch.block) Object.assign(b, patch.block)
      if (patch.region) Object.assign(b.region, patch.region)
      if (patch.bmeta) next.bmeta[b.id] = { ...(next.bmeta[b.id] ?? { kind: 'text' }), ...patch.bmeta }
    }
    setDoc(next)
    setDirty(true)
  }

  /** 统一的自定义拖拽：单选/多选都走这里，Moveable 只负责缩放/旋转把手 */
  function startDrag(e: React.PointerEvent, ids: string[]) {
    if (!doc || !ids.length) return
    pushHistory()
    e.preventDefault()
    origins.current.clear()
    live.current.clear()
    for (const eid of ids) {
      const r = findRegion(doc, eid)
      if (r) origins.current.set(eid, { ...r })
    }
    const sx = e.clientX
    const sy = e.clientY
    const els = ids.map((x) => hits.current.get(x)).filter((x): x is HTMLElement => Boolean(x))
    const pointerId = (e.nativeEvent as PointerEvent).pointerId
    const captureEl = hits.current.get(ids[0])
    try {
      captureEl?.setPointerCapture(pointerId)
    } catch {
      /* ignore */
    }
    const onMove = (ev: PointerEvent | MouseEvent) => {
      const dx = ev.clientX - sx
      const dy = ev.clientY - sy
      for (const eid of ids) live.current.set(eid, { dx, dy })
      for (const el of els) el.style.transform = `translate(${dx / zoom}px, ${dy / zoom}px)`
    }
    const onUp = () => {
      window.removeEventListener('pointermove', onMove, true)
      window.removeEventListener('pointerup', onUp, true)
      window.removeEventListener('pointercancel', onUp, true)
      try {
        captureEl?.releasePointerCapture(pointerId)
      } catch {
        /* ignore */
      }
      commitLive('move')
    }
    window.addEventListener('pointermove', onMove, true)
    window.addEventListener('pointerup', onUp, true)
    window.addEventListener('pointercancel', onUp, true)
  }

  function align(kind: 'left' | 'hcenter' | 'right' | 'top' | 'vcenter' | 'bottom') {
    if (!doc || sel.length < 2) return
    pushHistory()
    const next = cloneDoc(doc)
    const regions = sel.map((eid) => findRegion(next, eid)).filter((r): r is Region => Boolean(r))
    if (!regions.length) return
    const minX = Math.min(...regions.map((r) => u2mm(r.x)))
    const maxX = Math.max(...regions.map((r) => u2mm(r.x) + u2mm(r.width)))
    const minY = Math.min(...regions.map((r) => u2mm(r.y)))
    const maxY = Math.max(...regions.map((r) => u2mm(r.y) + u2mm(r.height)))
    for (const eid of sel) {
      const r = findRegion(next, eid)
      if (!r) continue
      const w = u2mm(r.width)
      const h = u2mm(r.height)
      let x = u2mm(r.x)
      let y = u2mm(r.y)
      if (kind === 'left') x = minX
      if (kind === 'right') x = maxX - w
      if (kind === 'hcenter') x = (minX + maxX) / 2 - w / 2
      if (kind === 'top') y = minY
      if (kind === 'bottom') y = maxY - h
      if (kind === 'vcenter') y = (minY + maxY) / 2 - h / 2
      setRegion(next, eid, { x: mm2u(round(x)), y: mm2u(round(y)), width: r.width, height: r.height })
    }
    setDoc(next)
    setDirty(true)
  }

  function toggleHidden(eid: string) {
    if (!doc) return
    const hidden = new Set(doc.hidden ?? [])
    if (hidden.has(eid)) hidden.delete(eid)
    else hidden.add(eid)
    setDoc({ ...cloneDoc(doc), hidden: [...hidden] })
    setDirty(true)
  }

  function toggleGroupHidden(group: CardGroup) {
    if (!doc) return
    const hidden = new Set(doc.hidden ?? [])
    const allHidden = group.itemIds.every((id) => hidden.has(id))
    for (const id of group.itemIds) {
      if (allHidden) hidden.delete(id)
      else hidden.add(id)
    }
    setDoc({ ...cloneDoc(doc), hidden: [...hidden] })
    setDirty(true)
  }

  function splitGroupById(gid: string) {
    if (!doc) return
    pushHistory()
    setDoc(splitGroup(doc, gid))
    setDirty(true)
  }

  const primaryQ = primary ? doc?.content.questions.find((q) => q.id === primary) : undefined
  const primaryB = primary ? (doc?.content.blocks ?? []).find((b) => b.id === primary) : undefined
  const primaryBar = primary ? doc?.barcodes?.find((bc) => bc.id === primary) : undefined
  const primaryRegion = primaryQ?.region ?? primaryB?.region ?? primaryBar?.region ?? null

  if (loading) {
    return (
      <div className="grid min-h-[50vh] place-items-center">
        <Spinner /> <span className="ml-2 text-[12px] text-ink-soft">正在载入答题卡…</span>
      </div>
    )
  }
  if (!doc) {
    return (
      <Card>
        <p className="py-10 text-center text-[12.5px] font-semibold text-ink-soft">{loadErr || '没有可编辑的答题卡'}</p>
        <div className="text-center">
          <Button onClick={() => nav('/papers/studio')}>去答题卡制作</Button>
        </div>
      </Card>
    )
  }

  const errors = issues.filter((i) => i.level === 'error')
  const warns = issues.filter((i) => i.level === 'warn')
  const sheetW = dims.w * pxPerMm
  const sheetH = dims.h * pxPerMm
  const allItems = [
    ...doc.content.questions.map((q) => ({
      id: q.id,
      label: q.type === 'mark' ? `涂卡题 ${q.displayNumber ?? ''}` : `主观题 ${q.displayNumber ?? ''}`,
      sub: `${q.score} 分 · ${Math.round(u2mm(q.region.width))}×${Math.round(u2mm(q.region.height))}mm`,
    })),
    ...(doc.content.blocks ?? []).map((b) => ({
      id: b.id,
      label: doc.bmeta[b.id]?.kind === 'section' ? `标题 · ${b.text.slice(0, 12)}` : `文本 · ${b.text.slice(0, 12)}`,
      sub: `${Math.round(u2mm(b.region.width))}×${Math.round(u2mm(b.region.height))}mm`,
    })),
    ...(doc.barcodes ?? []).map((bc) => ({
      id: bc.id,
      label: `条形码 · ${bc.format}`,
      sub: `${bc.value.slice(0, 18)} · ${Math.round(u2mm(bc.region.width))}×${Math.round(u2mm(bc.region.height))}mm`,
    })),
  ]
  const hiddenSet = new Set(doc.hidden ?? [])
  const selectedGroup = (doc.groups ?? []).find((g) => g.itemIds.some((id) => sel.includes(id)))
  const groupedIds = new Set((doc.groups ?? []).flatMap((g) => g.itemIds))
  const looseItems = allItems.filter((it) => !groupedIds.has(it.id))

  return (
    <div>
      <PageHeader
        title="答题卡精调"
        desc={`${side === 'back' ? '背面' : '正面'} · ${local ? '本地草稿' : `试卷 #${pid}`} · 拖动/框选/缩放/吸附，右侧改数值。`}
        crumb={[{ label: '试卷库', to: '/papers' }, { label: local ? '本地答题卡' : `试卷 #${pid}` }]}
        extra={
          <>
            <Badge tone={errors.length ? 'err' : 'ok'}>{errors.length ? `${errors.length} 个错误` : '校验通过'}</Badge>
            {warns.length > 0 && <Badge tone="warn">{warns.length} 条警告</Badge>}
            {dirty && <Badge tone="warn">未保存</Badge>}
          </>
        }
      />

      {loadErr && (
        <div className="mb-3 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[11.5px] text-amber-800">
          <AlertIcon className="mt-0.5 h-3.5 w-3.5 flex-none" />
          {loadErr}
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_370px]">
        <Card className="!p-3">
          <div className="mb-2 flex flex-wrap items-center gap-1.5">
            <div className="mr-1 flex items-center gap-1 rounded-xl border border-brand-200 bg-white p-1">
              <button type="button" className={`rounded-lg px-2.5 py-1 text-[10.5px] font-bold ${side === 'front' ? 'bg-brand-600 text-white' : 'text-ink-soft'}`} onClick={() => switchSide('front')}>
                正面
              </button>
              {backDoc && (
                <button type="button" className={`rounded-lg px-2.5 py-1 text-[10.5px] font-bold ${side === 'back' ? 'bg-brand-600 text-white' : 'text-ink-soft'}`} onClick={() => switchSide('back')}>
                  背面
                </button>
              )}
            </div>
            {!backDoc ? (
              <button type="button" className="rounded-lg border border-brand-200 bg-white px-2 py-1 text-[10.5px] font-bold text-ink-soft hover:bg-brand-50" onClick={() => enableBack('blank')}>
                双面自动分页
              </button>
            ) : (
              <>
                <button type="button" className="rounded-lg border border-brand-200 bg-white px-2 py-1 text-[10.5px] font-bold text-ink-soft hover:bg-brand-50" onClick={repage}>
                  重新自动分页
                </button>
                <button type="button" className="rounded-lg border border-red-200 bg-white px-2 py-1 text-[10.5px] font-bold text-red-500 hover:bg-red-50" onClick={disableBack}>
                  关闭双面
                </button>
              </>
            )}
            <Button variant="ghost" size="sm" onClick={undo}>
              撤销
            </Button>
            <Button variant="ghost" size="sm" onClick={redo}>
              重做
            </Button>
            <span className="mx-1 h-4 w-px bg-brand-200" />
            <Button variant="ghost" size="sm" onClick={() => addQuestion('mark')}>
              <PlusIcon className="h-3.5 w-3.5" /> 选择题
            </Button>
            <Button variant="ghost" size="sm" onClick={() => addQuestion('subjective')}>
              <PlusIcon className="h-3.5 w-3.5" /> 主观题
            </Button>
            <Button variant="ghost" size="sm" onClick={addBlock}>
              <PlusIcon className="h-3.5 w-3.5" /> 文本块
            </Button>
            {sel.length > 1 && (
              <>
                <span className="mx-1 h-4 w-px bg-brand-200" />
                {(['left', 'hcenter', 'right', 'top', 'vcenter', 'bottom'] as const).map((k) => (
                  <button
                    key={k}
                    type="button"
                    className="rounded-lg border border-brand-200 bg-white px-2 py-1 text-[10.5px] font-bold text-ink-soft hover:bg-brand-50"
                    onClick={() => align(k)}
                  >
                    {{ left: '左', hcenter: '中', right: '右', top: '上', vcenter: '垂中', bottom: '下' }[k]}
                  </button>
                ))}
              </>
            )}
            <label className="ml-1 flex items-center gap-1 text-[11px] font-semibold text-ink-soft">
              <input type="checkbox" checked={showGrid} onChange={(e) => setShowGrid(e.target.checked)} />
              网格
            </label>
            <div className="ml-auto flex items-center gap-1">
              <Button variant="ghost" size="sm" onClick={() => setZoom((z) => Math.max(0.25, Math.round((z - 0.1) * 100) / 100))}>
                −
              </Button>
              <span className="w-12 text-center text-[11px] font-bold text-ink-soft">{Math.round(zoom * 100)}%</span>
              <Button variant="ghost" size="sm" onClick={() => setZoom((z) => Math.min(2, Math.round((z + 0.1) * 100) / 100))}>
                +
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setZoom(1)}>
                1:1
              </Button>
            </div>
          </div>

          <div ref={viewportRef} className="max-h-[78vh] overflow-auto rounded-xl bg-neutral-200/70 p-4">
            <div className="relative" style={{ width: sheetW + 20, height: sheetH + 20 }}>
              <RulerH width={sheetW} pxPerMm={pxPerMm} />
              <RulerV height={sheetH} pxPerMm={pxPerMm} />
              <div ref={stageRef} className="relative" style={{ width: sheetW, height: sheetH, marginLeft: 20, marginTop: 20 }}>
                <CardSheet doc={doc} zoom={zoom} flat>
                  {showGrid && <GridOverlay />}
                  {allItems.map((it) => {
                    const r = findRegion(doc, it.id)
                    if (!r) return null
                    const isSel = sel.includes(it.id)
                    const hidden = hiddenSet.has(it.id)
                    return (
                      <div
                        key={`hit-${it.id}`}
                        ref={(el) => {
                          if (el) hits.current.set(it.id, el)
                          else hits.current.delete(it.id)
                        }}
                        data-id={it.id}
                        className="ce-hit"
                        onPointerDown={(e) => {
                          if (e.shiftKey) {
                            setSel((prev) => (prev.includes(it.id) ? prev.filter((x) => x !== it.id) : [...prev, it.id]))
                            setPrimary(it.id)
                            return
                          }
                          const grp = groupOf(doc, it.id)
                          const pickIds = grp ? grp.itemIds : [it.id]
                          const ids = sel.includes(it.id) && sel.length > 1 ? sel : pickIds
                          if (!sel.includes(it.id)) {
                            setSel(pickIds)
                            setPrimary(it.id)
                          } else if (sel.length === 1) {
                            setPrimary(it.id)
                          }
                          startDrag(e, ids)
                        }}
                        style={{
                          position: 'absolute',
                          left: mm(u2mm(r.x)),
                          top: mm(u2mm(r.y)),
                          width: mm(u2mm(r.width)),
                          height: mm(u2mm(r.height)),
                          cursor: 'move',
                          opacity: hidden ? 0.25 : 1,
                          outline: isSel || primary === it.id ? '0.35mm solid #a6342a' : undefined,
                          zIndex: isSel || primary === it.id ? 5 : 2,
                          background: 'transparent',
                        }}
                      />
                    )
                  })}
                </CardSheet>

                <Moveable
                  ref={moveableRef}
                  target={sel.length === 1 ? targets : []}
                  draggable={false}
                  resizable
                  rotatable={targets.length > 0 && sel.every((x) => isBlock(x))}
                  keepRatio={false}
                  throttleDrag={0}
                  throttleResize={0}
                  snappable
                  snapThreshold={6}
                  elementGuidelines={guidelines}
                  snapDirections={{ left: true, top: true, right: true, bottom: true, center: true, middle: true }}
                  onDragStart={onDragStart}
                  onDrag={onDrag}
                  onDragEnd={dragEnd}
                  onDragGroupStart={onDragGroupStart}
                  onDragGroup={onDragGroup}
                  onDragGroupEnd={dragEnd}
                  onResizeStart={onResizeStart}
                  onResize={onResize}
                  onResizeEnd={resizeEnd}
                  onResizeGroupStart={onResizeGroupStart}
                  onResizeGroup={onResizeGroup}
                  onResizeGroupEnd={resizeEnd}
                  onRotateStart={onRotateStart}
                  onRotate={onRotate}
                  onRotateEnd={onRotateEnd}
                />
              </div>
            </div>
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-2 px-1">
            <span className="text-[10.5px] text-ink-soft/60">
              {dims.w}×{dims.h}mm · 空白处框选 · Shift 多选 · 方向键微调 · Ctrl+A 全选
            </span>
            <span className="text-[10.5px] font-bold text-brand-700">已选 {sel.length}</span>
            <div className="ml-auto flex gap-1.5">
              <Button variant="ghost" size="sm" onClick={() => { stashDoc(combinedDoc()!); nav('/papers/print') }}>
                打印预览
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => downloadText(JSON.stringify({ version: 3, meta: doc.meta, content: doc.content, qmeta: doc.qmeta, bmeta: doc.bmeta, groups: doc.groups ?? [], barcodes: doc.barcodes ?? [], back: backDoc ? { content: backDoc.content, qmeta: backDoc.qmeta, bmeta: backDoc.bmeta, hidden: backDoc.hidden } : undefined }, null, 2), `${title || '答题卡'}.json`)}
              >
                <DownloadIcon className="h-3.5 w-3.5" /> 导出
              </Button>
              <Button size="sm" onClick={() => void save()} disabled={saving}>
                {saving ? <Spinner /> : <SaveIcon className="h-3.5 w-3.5" />} {saving ? '保存中' : local ? '保存草稿' : '保存到后端'}
              </Button>
            </div>
          </div>
        </Card>

        <div className="space-y-3">
          <Card className="!p-4">
            <div className="flex items-center justify-between">
              <p className="text-[12px] font-black text-ink">组件库</p>
              <span className="text-[10px] font-semibold text-ink-soft/60">点击添加 · 自动向下排版</span>
            </div>

            <div className="mt-3 space-y-3">
              <div className="rounded-xl border border-brand-100 bg-brand-50/40 p-2.5">
                <p className="text-[11px] font-bold text-ink">选择题组</p>
                <div className="mt-1.5 grid grid-cols-3 gap-1.5">
                  <Field label="题数">
                    <input type="number" min={1} max={100} className="w-full rounded-lg border border-brand-200 px-1.5 py-1 text-[11.5px]" value={choiceCount} onChange={(e) => setChoiceCount(Number(e.target.value))} />
                  </Field>
                  <Field label="选项数">
                    <input type="number" min={2} max={8} className="w-full rounded-lg border border-brand-200 px-1.5 py-1 text-[11.5px]" value={choiceOpts} onChange={(e) => setChoiceOpts(Number(e.target.value))} />
                  </Field>
                  <Field label="每题分">
                    <input type="number" min={0.5} step={0.5} className="w-full rounded-lg border border-brand-200 px-1.5 py-1 text-[11.5px]" value={choiceScore} onChange={(e) => setChoiceScore(Number(e.target.value))} />
                  </Field>
                </div>
                <Button size="sm" className="mt-2 w-full" onClick={addChoice}>
                  <PlusIcon className="h-3.5 w-3.5" /> 添加选择题组
                </Button>
              </div>

              <div className="rounded-xl border border-brand-100 bg-brand-50/40 p-2.5">
                <p className="text-[11px] font-bold text-ink">主观题组</p>
                <div className="mt-1.5 grid grid-cols-4 gap-1.5">
                  <Field label="题数">
                    <input type="number" min={1} max={50} className="w-full rounded-lg border border-brand-200 px-1 py-1 text-[11.5px]" value={subjCount} onChange={(e) => setSubjCount(Number(e.target.value))} />
                  </Field>
                  <Field label="行数">
                    <input type="number" min={1} max={80} className="w-full rounded-lg border border-brand-200 px-1 py-1 text-[11.5px]" value={subjRows} onChange={(e) => setSubjRows(Number(e.target.value))} />
                  </Field>
                  <Field label="样式">
                    <select className="w-full rounded-lg border border-brand-200 px-1 py-1 text-[11.5px]" value={subjStyle} onChange={(e) => setSubjStyle(e.target.value as 'lines' | 'blank' | 'grid')}>
                      <option value="lines">横线</option>
                      <option value="blank">空白</option>
                      <option value="grid">方格</option>
                    </select>
                  </Field>
                  <Field label="每题分">
                    <input type="number" min={0.5} step={0.5} className="w-full rounded-lg border border-brand-200 px-1 py-1 text-[11.5px]" value={subjScore} onChange={(e) => setSubjScore(Number(e.target.value))} />
                  </Field>
                </div>
                <Button size="sm" className="mt-2 w-full" onClick={addSubjective}>
                  <PlusIcon className="h-3.5 w-3.5" /> 添加主观题组
                </Button>
              </div>

              <div className="rounded-xl border border-brand-100 bg-brand-50/40 p-2.5">
                <p className="text-[11px] font-bold text-ink">空白方框（数学 / 历史）</p>
                <div className="mt-1.5 grid grid-cols-2 gap-1.5">
                  <Field label="个数">
                    <input type="number" min={1} max={50} className="w-full rounded-lg border border-brand-200 px-1.5 py-1 text-[11.5px]" value={blankCount} onChange={(e) => setBlankCount(Number(e.target.value))} />
                  </Field>
                  <Field label="框高 mm">
                    <input type="number" min={10} step={5} className="w-full rounded-lg border border-brand-200 px-1.5 py-1 text-[11.5px]" value={blankHeight} onChange={(e) => setBlankHeight(Number(e.target.value))} />
                  </Field>
                </div>
                <Button size="sm" className="mt-2 w-full" onClick={addBlank}>
                  <PlusIcon className="h-3.5 w-3.5" /> 添加空白方框组
                </Button>
              </div>

              <div className="rounded-xl border border-brand-100 bg-brand-50/40 p-2.5">
                <p className="text-[11px] font-bold text-ink">自定义条形码</p>
                <div className="mt-1.5">
                  <Field label="从学生考号带入">
                    <select
                      className="w-full rounded-lg border border-brand-200 px-1.5 py-1 text-[11px]"
                      value=""
                      onChange={(e) => {
                        const s = students.find((x) => String(x.candidateNumber ?? '') === e.target.value)
                        if (s?.candidateNumber) setBarcodeValue(s.candidateNumber)
                      }}
                    >
                      <option value="">手动输入 / 选择学生考号</option>
                      {students.filter((s) => s.candidateNumber).map((s) => (
                        <option key={`${s.id ?? s.name}-${s.candidateNumber}`} value={s.candidateNumber}>
                          {s.name} · {s.candidateNumber}
                        </option>
                      ))}
                    </select>
                  </Field>
                </div>
                <div className="mt-1.5 grid grid-cols-[1fr_auto] gap-1.5">
                  <Field label="内容">
                    <input
                      className="w-full rounded-lg border border-brand-200 px-1.5 py-1 text-[11.5px]"
                      placeholder="例如 20261109001"
                      value={barcodeValue}
                      onChange={(e) => setBarcodeValue(e.target.value)}
                    />
                  </Field>
                  <Field label="格式">
                    <select
                      className="rounded-lg border border-brand-200 px-1 py-1 text-[11.5px]"
                      value={barcodeFormat}
                      onChange={(e) => setBarcodeFormat(e.target.value as CardBarcodeFormat)}
                    >
                      {BARCODE_FORMATS.map((f) => (
                        <option key={f.value} value={f.value}>{f.label}</option>
                      ))}
                    </select>
                  </Field>
                </div>
                <label className="mt-1.5 flex items-center gap-1.5 text-[10.5px] font-semibold text-ink-soft">
                  <input type="checkbox" checked={barcodeShowText} onChange={(e) => setBarcodeShowText(e.target.checked)} />
                  显示人眼可读文字
                </label>
                <Button size="sm" className="mt-2 w-full" onClick={addCustomBarcode}>
                  <PlusIcon className="h-3.5 w-3.5" /> 添加自定义条形码
                </Button>
                <p className="mt-1 text-[9.5px] leading-relaxed text-ink-soft/60">
                  默认 50×20mm，可拖动缩放；与“贴条形码区”占位互不影响。
                </p>
              </div>

              <div>
                <p className="mb-1.5 text-[11px] font-bold text-ink">基础组件</p>
                <div className="flex flex-wrap gap-1.5">
                  {([
                    ['text', '文本'],
                    ['title', '标题'],
                    ['section', '分组标题'],
                    ['divider', '分割线'],
                    ['notice', '注意事项'],
                    ['student', '学生信息'],
                    ['barcode', '条形码占位'],
                    ['header', '页眉'],
                    ['footer', '页脚/页码'],
                  ] as const).map(([k, label]) => (
                    <button
                      key={k}
                      type="button"
                      className="rounded-lg border border-brand-200 bg-white px-2 py-1 text-[10.5px] font-bold text-ink-soft hover:border-brand-400 hover:text-brand-800"
                      onClick={() => addPreset(k)}
                    >
                      + {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </Card>

          <Card className="!p-4">
            <div className="flex items-center justify-between">
              <p className="text-[12px] font-black text-ink">{primary ? (primaryQ ? '题目属性' : primaryBar ? '条形码属性' : '文本块属性') : '未选中元素'}</p>
              {primary && (
                <div className="flex gap-1">
                  <Button variant="ghost" size="sm" onClick={duplicateSelected}>
                    复制
                  </Button>
                  <Button variant="ghost" size="sm" className="text-red-500" onClick={removeSelected}>
                    <TrashIcon className="h-3.5 w-3.5" /> 删除
                  </Button>
                </div>
              )}
            </div>

            {selectedGroup && (
              <div className="mt-2 flex items-center gap-2 rounded-lg bg-brand-50 px-2 py-1.5">
                <span className="min-w-0 flex-1 truncate text-[10.5px] font-bold text-brand-900">组：{selectedGroup.name}</span>
                <button type="button" className="rounded-md border border-brand-200 bg-white px-1.5 py-0.5 text-[10px] font-bold text-brand-700" onClick={() => splitGroupById(selectedGroup.id)}>
                  拆成小题
                </button>
                <button type="button" className="rounded-md border border-brand-200 bg-white px-1.5 py-0.5 text-[10px] font-bold text-brand-700" onClick={() => removeGroupById(selectedGroup.id)}>
                  删除组
                </button>
              </div>
            )}

            {!primary && (
              <p className="mt-3 text-[11.5px] leading-relaxed text-ink-soft/65">
                拖空白处框选多个元素；选中后可拖动/缩放，文本块可旋转；右侧可精确改 mm、字号与选项。
              </p>
            )}

            {primaryRegion && (
              <div className="mt-3 grid grid-cols-4 gap-1.5">
                {(['x', 'y', 'width', 'height'] as const).map((k) => (
                  <Field key={k} label={`${k === 'width' ? '宽' : k === 'height' ? '高' : k.toUpperCase()} mm`}>
                    <input
                      type="number"
                      step={0.5}
                      className="w-full rounded-lg border border-brand-200 px-1.5 py-1 text-[11.5px]"
                      value={u2mm(primaryRegion[k])}
                      onChange={(e) => patchSelected({ region: { [k]: mm2u(Math.max(0, Number(e.target.value))) } as Partial<Region> })}
                    />
                  </Field>
                ))}
              </div>
            )}

            {primaryBar && (
              <div className="mt-3 space-y-2.5">
                <div className="grid grid-cols-2 gap-1.5">
                  <Field label="格式">
                    <select
                      className="w-full rounded-lg border border-brand-200 px-1 py-1 text-[11.5px]"
                      value={primaryBar.format}
                      onChange={(e) => patchSelected({ barcode: { format: e.target.value as CardBarcodeFormat } })}
                    >
                      {BARCODE_FORMATS.map((f) => (
                        <option key={f.value} value={f.value}>{f.label}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="显示文字">
                    <select
                      className="w-full rounded-lg border border-brand-200 px-1 py-1 text-[11.5px]"
                      value={primaryBar.showText === false ? '0' : '1'}
                      onChange={(e) => patchSelected({ barcode: { showText: e.target.value === '1' } })}
                    >
                      <option value="1">显示</option>
                      <option value="0">隐藏</option>
                    </select>
                  </Field>
                </div>
                <Field label="条形码内容">
                  <input
                    className="w-full rounded-lg border border-brand-200 px-2 py-1 text-[11.5px]"
                    value={primaryBar.value}
                    onChange={(e) => patchSelected({ barcode: { value: e.target.value } })}
                  />
                </Field>
                <p className="text-[10px] leading-relaxed text-ink-soft/65">
                  前端按所选格式打印；保存后端时会同步一条 Code128 镜像条码，后端标准目前只接受 Code128 类型。
                </p>
              </div>
            )}

            {primaryQ && (
              <div className="mt-3 space-y-2.5">
                <div className="grid grid-cols-3 gap-1.5">
                  <Field label="题号">
                    <input
                      type="number"
                      className="w-full rounded-lg border border-brand-200 px-1.5 py-1 text-[11.5px]"
                      value={primaryQ.displayNumber ?? 0}
                      onChange={(e) => patchSelected({ q: { displayNumber: Number(e.target.value) } })}
                    />
                  </Field>
                  <Field label="类型">
                    <select
                      className="w-full rounded-lg border border-brand-200 px-1 py-1 text-[11.5px]"
                      value={primaryQ.type}
                      onChange={(e) =>
                        patchSelected({
                          q: {
                            type: e.target.value as Question['type'],
                            choices:
                              e.target.value === 'mark' && !primaryQ.choices
                                ? ['A', 'B', 'C', 'D'].map((value, i) => ({
                                    value,
                                    region: { x: round3((6 + i * 5) / 70), y: 0.18, width: round3(4.1 / 70), height: 0.64 },
                                  }))
                                : primaryQ.choices,
                          },
                        })
                      }
                    >
                      <option value="mark">涂卡题</option>
                      <option value="subjective">主观题</option>
                    </select>
                  </Field>
                  <Field label="分值">
                    <input
                      type="number"
                      step={0.5}
                      min={0.5}
                      className="w-full rounded-lg border border-brand-200 px-1.5 py-1 text-[11.5px]"
                      value={primaryQ.score ?? 0}
                      onChange={(e) => patchSelected({ q: { score: Math.max(0.5, Number(e.target.value)) } })}
                    />
                  </Field>
                </div>

                {primaryQ.type === 'mark' ? (
                  <div>
                    <p className="mb-1 text-[10.5px] font-bold text-ink-soft/70">选项</p>
                    <div className="flex flex-wrap gap-1">
                      {(primaryQ.choices ?? []).map((c, i) => (
                        <input
                          key={i}
                          className="w-10 rounded-lg border border-brand-200 px-1 py-1 text-center text-[11.5px]"
                          value={c.value}
                          onChange={(e) => {
                            const next = (primaryQ.choices ?? []).map((x, k) => (k === i ? { ...x, value: e.target.value } : x))
                            patchSelected({ q: { choices: next } })
                          }}
                        />
                      ))}
                      <button
                        type="button"
                        title="增加选项"
                        className="rounded-lg border border-brand-200 px-2 text-[11px] font-bold text-brand-700"
                        onClick={() => {
                          const cur = primaryQ.choices ?? []
                          const n = cur.length + 1
                          patchSelected({
                            q: {
                              choices: [
                                ...cur,
                                {
                                  value: String.fromCharCode(64 + n),
                                  region: { x: round3((6 + (n - 1) * 5) / 70), y: 0.18, width: round3(4.1 / 70), height: 0.64 },
                                },
                              ],
                            },
                          })
                        }}
                      >
                        +
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-1.5">
                    <Field label="样式">
                      <select
                        className="w-full rounded-lg border border-brand-200 px-1 py-1 text-[11.5px]"
                        value={doc.qmeta[primaryQ.id]?.style ?? 'lines'}
                        onChange={(e) => patchSelected({ qmeta: { style: e.target.value as QuestionMeta['style'] } })}
                      >
                        <option value="lines">横线</option>
                        <option value="grid">方格</option>
                        <option value="blank">空白</option>
                      </select>
                    </Field>
                    <Field label="行数">
                      <input
                        type="number"
                        min={1}
                        className="w-full rounded-lg border border-brand-200 px-1.5 py-1 text-[11.5px]"
                        value={doc.qmeta[primaryQ.id]?.rows ?? 4}
                        onChange={(e) => patchSelected({ qmeta: { rows: Number(e.target.value) } })}
                      />
                    </Field>
                    <Field label="每行格">
                      <input
                        type="number"
                        min={4}
                        className="w-full rounded-lg border border-brand-200 px-1.5 py-1 text-[11.5px]"
                        value={doc.qmeta[primaryQ.id]?.gridCols ?? 20}
                        onChange={(e) => patchSelected({ qmeta: { gridCols: Number(e.target.value) } })}
                      />
                    </Field>
                  </div>
                )}
              </div>
            )}

            {primaryB && (
              <div className="mt-3 space-y-2">
                <Field label="文字内容">
                  <textarea
                    className="min-h-[86px] w-full rounded-lg border border-brand-200 px-2 py-1.5 text-[11.5px]"
                    value={primaryB.text}
                    onChange={(e) => patchSelected({ block: { text: e.target.value } })}
                  />
                </Field>
                <div className="grid grid-cols-4 gap-1.5">
                  <Field label="字号 mm">
                    <input
                      type="number"
                      step={0.2}
                      min={1}
                      className="w-full rounded-lg border border-brand-200 px-1.5 py-1 text-[11.5px]"
                      value={primaryB.style?.fontSize ?? 4}
                      onChange={(e) => patchSelected({ block: { style: { ...primaryB.style, fontSize: Number(e.target.value) } } })}
                    />
                  </Field>
                  <Field label="对齐">
                    <select
                      className="w-full rounded-lg border border-brand-200 px-1 py-1 text-[11.5px]"
                      value={primaryB.style?.textAlign ?? 'left'}
                      onChange={(e) =>
                        patchSelected({
                          block: { style: { ...primaryB.style, textAlign: e.target.value as 'left' | 'center' | 'right' } },
                        })
                      }
                    >
                      <option value="left">左</option>
                      <option value="center">中</option>
                      <option value="right">右</option>
                    </select>
                  </Field>
                  <Field label="加粗">
                    <select
                      className="w-full rounded-lg border border-brand-200 px-1 py-1 text-[11.5px]"
                      value={primaryB.style?.fontWeight === 'bold' ? '1' : '0'}
                      onChange={(e) =>
                        patchSelected({ block: { style: { ...primaryB.style, fontWeight: e.target.value === '1' ? 'bold' : 'normal' } } })
                      }
                    >
                      <option value="0">常规</option>
                      <option value="1">加粗</option>
                    </select>
                  </Field>
                  <Field label="旋转°">
                    <input
                      type="number"
                      step={1}
                      className="w-full rounded-lg border border-brand-200 px-1.5 py-1 text-[11.5px]"
                      value={doc.bmeta[primaryB.id]?.rotate ?? 0}
                      onChange={(e) => patchSelected({ bmeta: { rotate: Number(e.target.value) } })}
                    />
                  </Field>
                </div>
              </div>
            )}
          </Card>

          <Card className="!p-4">
            <button type="button" className="flex w-full items-center justify-between" onClick={() => setLayerOpen((v) => !v)}>
              <span className="text-[12px] font-black text-ink">图层</span>
              <span className="text-[10.5px] font-semibold text-ink-soft">{(doc.groups ?? []).length} 组 + {looseItems.length} 元素 · {layerOpen ? '收起' : '展开'}</span>
            </button>
            {layerOpen && (
              <div className="mt-2 max-h-64 space-y-1 overflow-y-auto">
                {(doc.groups ?? []).map((group) => {
                  const kids = group.itemIds.map((id) => allItems.find((x) => x.id === id)).filter((x): x is (typeof allItems)[number] => Boolean(x))
                  const allHidden = group.itemIds.every((id) => hiddenSet.has(id))
                  const groupSelected = group.itemIds.every((id) => sel.includes(id))
                  return (
                    <div key={group.id} className={`rounded-lg border ${groupSelected ? 'border-brand-300 bg-brand-50/70' : 'border-brand-100/70 bg-white'}`}>
                      <div className="flex items-center gap-1 px-1.5 py-1.5">
                        <button
                          type="button"
                          className="min-w-0 flex-1 truncate text-left text-[10.5px] font-black text-brand-900"
                          onClick={() => selectGroup(group)}
                        >
                          {groupSelected ? '▼' : '▶'} {group.name}
                          <span className="ml-1 font-semibold text-ink-soft/50">({kids.length})</span>
                        </button>
                        <button
                          type="button"
                          className="flex-none px-1 text-[10px] font-bold text-ink-soft/50 hover:text-brand-700"
                          onClick={() => toggleGroupHidden(group)}
                        >
                          {allHidden ? '显示' : '隐藏'}
                        </button>
                        <button
                          type="button"
                          className="flex-none px-1 text-[10px] font-bold text-ink-soft/50 hover:text-brand-700"
                          onClick={() => splitGroupById(group.id)}
                        >
                          拆
                        </button>
                      </div>
                      <div className="space-y-0.5 px-1.5 pb-1.5">
                        {kids.map((it) => (
                          <button
                            key={it.id}
                            type="button"
                            className={`flex w-full items-center gap-1 rounded-md px-2 py-1 text-left ${sel.includes(it.id) ? 'bg-white text-brand-900' : 'text-ink-soft hover:bg-white'}`}
                            onClick={() => {
                              setSel([it.id])
                              setPrimary(it.id)
                            }}
                          >
                            <span className="min-w-0 flex-1 truncate text-[10.5px] font-semibold">{it.label}</span>
                            <span className="flex-none text-[9.5px] text-ink-soft/45">{it.sub}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )
                })}
                {looseItems.map((it) => (
                  <div
                    key={it.id}
                    className={`flex items-center gap-2 rounded-lg px-2 py-1.5 ${sel.includes(it.id) ? 'bg-brand-50 text-brand-900' : 'hover:bg-neutral-50'}`}
                  >
                    <button
                      type="button"
                      className="min-w-0 flex-1 text-left"
                      onClick={() => {
                        setSel([it.id])
                        setPrimary(it.id)
                      }}
                    >
                      <span className="block truncate text-[11.5px] font-semibold">{it.label}</span>
                      <span className="block truncate text-[10px] text-ink-soft/60">{it.sub}</span>
                    </button>
                    <button
                      type="button"
                      title={hiddenSet.has(it.id) ? '显示' : '隐藏'}
                      className="flex-none px-1 text-[10px] font-bold text-ink-soft/50 hover:text-brand-700"
                      onClick={() => toggleHidden(it.id)}
                    >
                      {hiddenSet.has(it.id) ? '显示' : '隐藏'}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card className="!p-4">
            <button type="button" className="flex w-full items-center justify-between" onClick={() => setShowIssues((v) => !v)}>
              <span className="text-[12px] font-black text-ink">排版校验</span>
              <span className="flex gap-1">
                <Badge tone={errors.length ? 'err' : 'ok'}>错误 {errors.length}</Badge>
                <Badge tone="warn">警告 {warns.length}</Badge>
              </span>
            </button>
            {showIssues && (
              <div className="mt-3 max-h-56 space-y-1 overflow-y-auto">
                {issues.length === 0 && <p className="py-4 text-center text-[11.5px] text-ink-soft/60">全部通过</p>}
                {issues.map((it, i) => (
                  <button
                    key={i}
                    type="button"
                    className={`flex w-full items-start gap-1.5 rounded-lg px-2 py-1.5 text-left text-[11px] ${
                      it.level === 'error' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-800'
                    }`}
                    onClick={() => {
                      if (!it.target) return
                      setSel([it.target])
                      setPrimary(it.target)
                    }}
                  >
                    <AlertIcon className="mt-0.5 h-3 w-3 flex-none" />
                    {it.message}
                  </button>
                ))}
              </div>
            )}
          </Card>

          <Card className="!p-4">
            <p className="text-[12px] font-black text-ink">保存</p>
            <div className="mt-2 space-y-2">
              <input className={inputCls} placeholder="试卷名称（另存为新试卷）" value={name} onChange={(e) => setName(e.target.value)} />
              <div className="flex gap-1.5">
                <Button onClick={() => void save()} disabled={saving} className="flex-1">
                  <SaveIcon className="h-3.5 w-3.5" /> {local ? '保存本机草稿' : '保存到试卷'}
                </Button>
                <Button variant="ghost" onClick={() => void saveAsNewPaper()} disabled={saving}>
                  另存为新试卷
                </Button>
              </div>
              <p className="text-[10px] leading-relaxed text-ink-soft/55">
                拖动/缩放/旋转只改本地设计文档；保存到后端只提交标准 v1。
              </p>
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}

/* ---------------- 小部件 ---------------- */

function GridOverlay() {
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 0,
        backgroundImage:
          'linear-gradient(to right, rgba(166,52,42,0.10) 0.15mm, transparent 0.15mm), linear-gradient(to bottom, rgba(166,52,42,0.10) 0.15mm, transparent 0.15mm)',
        backgroundSize: '10mm 10mm',
      }}
    />
  )
}

function RulerH({ width, pxPerMm }: { width: number; pxPerMm: number }) {
  const step = 10
  const ticks = Math.floor(width / pxPerMm / step)
  return (
    <div className="absolute left-5 top-0 h-5 overflow-hidden border-b border-neutral-300 bg-neutral-50/90" style={{ width }}>
      {Array.from({ length: ticks + 1 }).map((_, i) => (
        <span key={i} className="absolute top-0 h-full border-l border-neutral-300/80" style={{ left: i * step * pxPerMm }}>
          <span className="absolute left-0.5 top-0 text-[8px] leading-none text-neutral-400">{i * step}</span>
        </span>
      ))}
      <span className="absolute right-1 top-0 text-[8px] leading-none text-neutral-400">mm</span>
    </div>
  )
}

function RulerV({ height, pxPerMm }: { height: number; pxPerMm: number }) {
  const step = 10
  const ticks = Math.floor(height / pxPerMm / step)
  return (
    <div className="absolute left-0 top-5 w-5 overflow-hidden border-r border-neutral-300 bg-neutral-50/90" style={{ height }}>
      {Array.from({ length: ticks + 1 }).map((_, i) => (
        <span key={i} className="absolute left-0 w-full border-t border-neutral-300/80" style={{ top: i * step * pxPerMm }}>
          <span className="absolute left-0.5 top-0.5 text-[8px] leading-none text-neutral-400">{i * step}</span>
        </span>
      ))}
    </div>
  )
}

/* ---------------- 纯函数 ---------------- */

function round(v: number): number {
  return Math.round(v * 2) / 2
}
function round3(v: number): number {
  return Math.round(v * 1000) / 1000
}
function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v))
}
function nextQuestionId(doc: CardDoc): string {
  const used = new Set([...doc.content.questions.map((q) => q.id), ...(doc.content.blocks ?? []).map((b) => b.id)])
  let i = doc.content.questions.length + 1
  while (used.has(`q${i}`)) i += 1
  return `q${i}`
}
function nextBlockId(doc: CardDoc): string {
  const used = new Set([...doc.content.questions.map((q) => q.id), ...(doc.content.blocks ?? []).map((b) => b.id)])
  let i = (doc.content.blocks?.length ?? 0) + 1
  while (used.has(`b${i}`)) i += 1
  return `b${i}`
}

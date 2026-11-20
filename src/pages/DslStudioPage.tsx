import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageHeader } from '../components/PageHeader'
import { AlertIcon, BoltIcon, DownloadIcon, EditIcon, SaveIcon } from '../components/icons'
import { Badge, Button, Card } from '../components/ui'
import { useToast } from '../components/Toast'
import { errorText } from '../api/client'
import { DSL_SAMPLE, buildCardFromDsl } from '../lib/card/dsl'
import { CardSheet } from '../lib/card/render'
import { paperMm, type PaperSize } from '../lib/card/types'
import { createPaperFromDoc, stashDoc } from '../lib/card/store'
import { downloadText } from '../lib/image'

const PX_PER_MM = 96 / 25.4

/**
 * Sheeter 风格的「文本出卡」：一行一题，实时预览，可进精调/打印/保存。
 * 适合批量出同规格答题卡，比逐项拖拽快得多。
 */
export default function DslStudioPage() {
  const nav = useNavigate()
  const toast = useToast()
  const [text, setText] = useState(() => {
    try {
      return sessionStorage.getItem('ac.dsl.text') || DSL_SAMPLE
    } catch {
      return DSL_SAMPLE
    }
  })
  const [name, setName] = useState('DSL 答题卡')
  const [size, setSize] = useState<'auto' | PaperSize>('auto')
  const [saving, setSaving] = useState(false)
  const previewRef = useRef<HTMLDivElement>(null)
  const [zoom, setZoom] = useState(0.45)

  const built = useMemo(() => {
    const paperSize = size === 'auto' ? undefined : size
    return buildCardFromDsl(text, { name, paperSize })
  }, [text, name, size])

  const doc = built.doc
  const dims = paperMm(doc.meta.paperSize, doc.meta.orientation)
  const errors = built.issues.filter((i) => i.level === 'error')
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

  function update(v: string) {
    setText(v)
    try {
      sessionStorage.setItem('ac.dsl.text', v)
    } catch {
      /* ignore */
    }
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
        title="文本出卡（DSL）"
        desc="一行一题：X-4 单选、T-1 填空、L-8 解答、B-3 数字涂卡、J-5 空白区；#split 分栏，实时预览。"
        crumb={[{ label: '试卷库', to: '/papers' }, { label: '文本出卡' }]}
        extra={<Badge tone={errors.length ? 'err' : 'ok'}>{errors.length ? `${errors.length} 个错误` : '排布通过'}</Badge>}
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Card className="!p-4">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <input
              className="min-w-[180px] flex-1 rounded-xl border border-brand-200 px-3 py-2 text-[12.5px] font-semibold outline-none focus:border-brand-400"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="试卷名称"
              maxLength={100}
            />
            <select
              className="rounded-xl border border-brand-200 bg-white px-2 py-2 text-[12px] font-semibold"
              value={size}
              onChange={(e) => setSize(e.target.value as 'auto' | PaperSize)}
            >
              <option value="auto">纸型随 DSL</option>
              <option value="A4">A4</option>
              <option value="A3">A3</option>
            </select>
            <Button variant="ghost" size="sm" onClick={() => update(DSL_SAMPLE)}>
              <BoltIcon className="h-3.5 w-3.5" /> 示例
            </Button>
          </div>
          <textarea
            className="h-[560px] w-full resize-none rounded-xl border border-brand-200 bg-neutral-950 p-3 font-mono text-[12px] leading-relaxed text-neutral-100 outline-none focus:border-brand-400"
            spellCheck={false}
            value={text}
            onChange={(e) => update(e.target.value)}
          />
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="text-[10.5px] text-ink-soft/60">
              {built.warnings.length ? built.warnings.slice(0, 2).join('；') : '语法：### 大题 / 1. X-4 / 2. L-8 / === 换栏'}
            </span>
            <div className="ml-auto flex gap-1.5">
              <Button variant="ghost" size="sm" onClick={() => { stashDoc(doc); nav('/papers/print') }}>
                打印预览
              </Button>
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
          </div>
          {errors.length > 0 && (
            <div className="mt-2 space-y-1">
              {errors.slice(0, 4).map((e, i) => (
                <p key={i} className="flex items-start gap-1.5 rounded-lg bg-red-50 px-2.5 py-1.5 text-[10.5px] text-red-700">
                  <AlertIcon className="mt-0.5 h-3 w-3 flex-none" /> {e.message}
                </p>
              ))}
            </div>
          )}
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

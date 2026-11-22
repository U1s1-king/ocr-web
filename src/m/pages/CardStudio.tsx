import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useToast } from '../../components/Toast'
import { CARD_TEMPLATES, CATALOG_SYSTEMS } from '../../lib/card/catalog'
import { generateCard } from '../../lib/card/generator'
import { backAsDoc } from '../../lib/card/back'
import { createPaperFromDoc } from '../../lib/card/store'
import { CardSheet } from '../../lib/card/render'
import { paperMm } from '../../lib/card/types'
import { Btn, Card, Page } from '../ui'
import { IcLayers, IcRight } from '../icons'

const PX = 96 / 25.4

/** 移动端模板工坊：挑模板 → 预览正反面 → 生成试卷进入精调 */
export default function CardStudio() {
  const nav = useNavigate()
  const toast = useToast()
  const [system, setSystem] = useState('全部')
  const [id, setId] = useState(CARD_TEMPLATES[0]?.id ?? '')
  const [side, setSide] = useState<'front' | 'back'>('front')
  const [saving, setSaving] = useState(false)

  const list = useMemo(() => CARD_TEMPLATES.filter((t) => system === '全部' || t.systemLabel === system), [system])
  const tpl = CARD_TEMPLATES.find((t) => t.id === id) ?? list[0] ?? CARD_TEMPLATES[0]
  const generated = useMemo(() => generateCard(tpl.spec), [tpl])
  const doc = generated.doc
  const preview = side === 'back' && doc.back ? backAsDoc(doc) : doc
  const dims = paperMm(doc.meta.paperSize, doc.meta.orientation)
  const zoom = Math.max(0.25, Math.min(0.55, 360 / (dims.w * PX)))

  async function useTemplate() {
    setSaving(true)
    try {
      const name = `${tpl.name} ${new Date().toLocaleDateString('zh-CN')}`
      const res = await createPaperFromDoc(doc, name)
      toast(`已生成试卷 #${res.id}`, 'ok')
      nav(`/m/papers/${res.id}/edit`)
    } catch (e) {
      toast(e instanceof Error ? e.message : '创建失败', 'err')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Page title="答题卡制作" sub={`${CARD_TEMPLATES.length} 套双面模板`} back>
      <div className="mo-seg mb-3">
        {['全部', ...CATALOG_SYSTEMS].map((s) => (
          <button key={s} type="button" className="mo-seg-item" data-active={system === s} onClick={() => setSystem(s)}>{s}</button>
        ))}
      </div>

      <Card className="!p-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[12px] font-extrabold text-ink">{tpl.name}</p>
            <p className="mo-muted mt-0.5">{tpl.systemLabel} · {tpl.subject} · {tpl.size} · {doc.back ? 2 : 1} 面</p>
          </div>
          <div className="flex rounded-lg bg-brand-50 p-0.5">
            <button type="button" className={`rounded-md px-2 py-1 text-[10px] font-bold ${side === 'front' ? 'bg-white text-brand-700' : 'text-ink-soft'}`} onClick={() => setSide('front')}>正面</button>
            <button type="button" className={`rounded-md px-2 py-1 text-[10px] font-bold ${side === 'back' ? 'bg-white text-brand-700' : 'text-ink-soft'}`} onClick={() => setSide('back')}>背面</button>
          </div>
        </div>
        <div className="mt-2 flex justify-center overflow-hidden rounded-xl bg-neutral-100 p-2">
          <div style={{ width: dims.w * PX * zoom, height: dims.h * PX * zoom }}>
            <CardSheet doc={preview} zoom={zoom} />
          </div>
        </div>
        {generated.warnings.length > 0 && <p className="mo-muted mt-1.5">{generated.warnings[0]}</p>}
        <Btn block onClick={() => void useTemplate()} disabled={saving}>
          {saving ? '创建中…' : '使用此模板创建试卷'}
        </Btn>
      </Card>

      <p className="mo-eyebrow mt-4 mb-2">模板列表</p>
      <div className="space-y-1.5">
        {list.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`flex w-full items-center gap-2 rounded-xl border px-2.5 py-2 text-left ${t.id === tpl.id ? 'border-brand-300 bg-brand-50' : 'border-brand-100 bg-white'}`}
            onClick={() => { setId(t.id); setSide('front') }}
          >
            <span className="grid h-8 w-8 flex-none place-items-center rounded-lg bg-brand-100 text-brand-700"><IcLayers /></span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[11.5px] font-bold text-ink">{t.name}</span>
              <span className="block truncate text-[9.5px] text-ink-soft/55">{t.systemLabel} · {t.subject} · {t.size} · {t.variant}</span>
            </span>
            <IcRight className="flex-none text-ink-soft/40" />
          </button>
        ))}
      </div>
    </Page>
  )
}

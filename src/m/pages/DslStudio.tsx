import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useToast } from '../../components/Toast'
import { DSL_SAMPLE, buildCardFromDsl } from '../../lib/card/dsl'
import { createPaperFromDoc } from '../../lib/card/store'
import { CardSheet } from '../../lib/card/render'
import { paperMm } from '../../lib/card/types'
import { Btn, Card, Page } from '../ui'

const PX = 96 / 25.4

/** 移动端文本出卡：一行一题，实时预览，保存后精调 */
export default function DslStudio() {
  const nav = useNavigate()
  const toast = useToast()
  const [text, setText] = useState(() => sessionStorage.getItem('ac.dsl.text') || DSL_SAMPLE)
  const [name, setName] = useState('DSL 答题卡')
  const [saving, setSaving] = useState(false)
  const built = useMemo(() => buildCardFromDsl(text, { name }), [text, name])
  const doc = built.doc
  const dims = paperMm(doc.meta.paperSize, doc.meta.orientation)
  const errors = built.issues.filter((i) => i.level === 'error')
  const zoom = Math.max(0.25, Math.min(0.55, 360 / (dims.w * PX)))

  function update(v: string) {
    setText(v)
    sessionStorage.setItem('ac.dsl.text', v)
  }

  async function save() {
    setSaving(true)
    try {
      const res = await createPaperFromDoc(doc, name.trim() || 'DSL 答题卡')
      toast(`已保存试卷 #${res.id}`, 'ok')
      nav(`/m/papers/${res.id}/edit`)
    } catch (e) {
      toast(e instanceof Error ? e.message : '保存失败', 'err')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Page title="文本出卡" sub="一行一题 · DSL" back>
      <Card className="!p-3">
        <input className="mo-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="试卷名称" maxLength={100} />
        <textarea
          className="mt-2 h-[260px] w-full resize-none rounded-xl border border-brand-200 bg-neutral-950 p-2.5 font-mono text-[11px] leading-relaxed text-neutral-100 outline-none"
          value={text}
          spellCheck={false}
          onChange={(e) => update(e.target.value)}
        />
        <p className="mo-muted mt-1.5">语法：### 大题 / 1. X-4 / 2. L-8 / === 换栏；{errors.length ? `${errors.length} 个错误` : '语法通过'}</p>
        <div className="mt-2 flex gap-2">
          <Btn variant="ghost" onClick={() => update(DSL_SAMPLE)}>示例</Btn>
          <Btn block onClick={() => void save()} disabled={saving || errors.length > 0}>{saving ? '保存中…' : '保存并精调'}</Btn>
        </div>
      </Card>

      <Card className="mt-3 !p-3">
        <div className="flex items-center justify-between">
          <p className="text-[12px] font-extrabold">实时预览</p>
          <span className="mo-muted">{doc.content.questions.length} 题</span>
        </div>
        <div className="mt-2 flex justify-center overflow-hidden rounded-xl bg-neutral-100 p-2">
          <div style={{ width: dims.w * PX * zoom, height: dims.h * PX * zoom }}>
            <CardSheet doc={doc} zoom={zoom} />
          </div>
        </div>
      </Card>
    </Page>
  )
}

import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { papersApi } from '../api'
import { resolveDoc } from '../../lib/card/store'
import type { CardDoc } from '../../lib/card/types'
import { backAsDoc } from '../../lib/card/back'
import { CardSheet } from '../../lib/card/render'
import { paperMm } from '../../lib/card/types'
import { Btn, Card, Page } from '../ui'

const PX = 96 / 25.4

/** 移动端打印预览：正面/背面切换，直接调用系统打印 */
export default function MobilePrint() {
  const { id } = useParams()
  const pid = Number(id)
  const [doc, setDoc] = useState<CardDoc | null>(null)
  const [name, setName] = useState('')
  const [side, setSide] = useState<'front' | 'back'>('front')
  const [err, setErr] = useState('')

  useEffect(() => {
    if (!Number.isFinite(pid)) { setErr('试卷 id 不对'); return }
    papersApi.get(pid).then((p) => {
      setName(p.name)
      setDoc(resolveDoc(pid, p.paper as never, p.name).doc)
    }).catch((e) => setErr(e instanceof Error ? e.message : '加载失败'))
  }, [pid])

  if (!doc) return <Page title="打印预览" back><Card>{err || '正在加载…'}</Card></Page>

  const back = doc.back ? backAsDoc(doc) : null
  const current = side === 'back' && back ? back : doc
  const dims = paperMm(current.meta.paperSize, current.meta.orientation)
  const zoom = Math.max(0.25, Math.min(0.55, 350 / (dims.w * PX)))

  return (
    <Page title="打印预览" sub={`${name || '答题卡'} · ${dims.w}×${dims.h}mm · ${back ? '双面' : '单面'}`} back>
      {back && (
        <div className="mo-seg mb-3">
          <button type="button" className="mo-seg-item" data-active={side === 'front'} onClick={() => setSide('front')}>正面</button>
          <button type="button" className="mo-seg-item" data-active={side === 'back'} onClick={() => setSide('back')}>背面</button>
        </div>
      )}
      <Card className="!p-2">
        <div className="flex justify-center overflow-hidden rounded-xl bg-neutral-100 p-2">
          <div style={{ width: dims.w * PX * zoom, height: dims.h * PX * zoom }}>
            <CardSheet doc={current} zoom={zoom} />
          </div>
        </div>
      </Card>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <Btn variant="ghost" onClick={() => window.print()}>系统打印</Btn>
        <Btn onClick={() => window.print()}>打印 / 存 PDF</Btn>
      </div>
      <p className="mo-muted mt-2">打印时请选择 100% 缩放、无边距；手机上可先「打印/存 PDF」再发送。</p>

      <style>{`@media print { @page { size: ${dims.w}mm ${dims.h}mm; margin: 0; } .mo-page { display: none !important; } .mo-print-root { display: block !important; } }`}</style>
      <div className="mo-print-root hidden">
        {(back ? [doc, back] : [doc]).map((d, i) => (
          <div key={i} style={{ width: dims.w * PX, height: dims.h * PX, pageBreakAfter: 'always', background: '#fff' }}>
            <CardSheet doc={d} zoom={1} />
          </div>
        ))}
      </div>
    </Page>
  )
}

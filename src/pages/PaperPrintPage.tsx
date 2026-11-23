import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { CardSheet } from '../lib/card/render'
import { paperMm } from '../lib/card/types'
import { backAsDoc } from '../lib/card/back'
import { papersApi } from '../m/api'
import { errorText } from '../api/client'
import { resolveDoc, takeStashedDoc } from '../lib/card/store'
import { validateCard } from '../lib/card/types'
import { requestPrint } from '../lib/print'

const PX_PER_MM = 96 / 25.4

/**
 * 打印 / 存 PDF：使用 mm 尺寸 + 矢量 DOM，打印缩放 100% 即为原尺寸。
 * 支持三种来源：
 *  - /#/papers/print            当前会话里暂存的卡片（模板工坊/编辑器跳转）
 *  - /#/papers/{id}/print       后端试卷 + 本机设计草稿
 *  - /#/papers/print?paper=12   显式指定试卷
 */
export default function PaperPrintPage() {
  const { id } = useParams()
  const nav = useNavigate()
  const [doc, setDoc] = useState<ReturnType<typeof takeStashedDoc>>(null)
  const [name, setName] = useState('')
  const [err, setErr] = useState('')
  const [zoom, setZoom] = useState(0.8)

  const query = useMemo(() => {
    const hashQ = window.location.hash.split('?')[1] ?? ''
    return new URLSearchParams(hashQ || window.location.search)
  }, [])

  useEffect(() => {
    const pid = Number(id ?? query.get('paper') ?? '')
    if (Number.isFinite(pid) && pid > 0) {
      papersApi
        .get(pid)
        .then((p) => {
          setName(p.name)
          const resolved = resolveDoc(pid, p.paper as never, p.name)
          setDoc(resolved.doc)
        })
        .catch((e) => setErr(errorText(e)))
      return
    }
    const stashed = takeStashedDoc()
    if (stashed) {
      setDoc(stashed)
      setName(stashed.meta.title || '答题卡')
      return
    }
    setErr('没有可打印的答题卡：请从「答题卡制作」或试卷编辑页进入打印预览')
  }, [id, query])

  const dims = doc ? paperMm(doc.meta.paperSize, doc.meta.orientation) : { w: 210, h: 297 }
  const back = doc?.back ? backAsDoc(doc) : null
  const pageDocs = doc ? (back ? [doc, back] : [doc]) : []
  const issues = doc ? validateCard(doc) : []
  const errors = issues.filter((i) => i.level === 'error')

  return (
    <div className="min-h-screen bg-neutral-200">
      <style>{`
        @media print {
          @page { size: ${dims.w}mm ${dims.h}mm; margin: 0; }
          body { background: #fff !important; }
          body * { visibility: visible !important; }
          .pp-bar { display: none !important; }
          .pointer-events-none.fixed { display: none !important; }
          .pp-wrap { padding: 0 !important; background: #fff !important; display: block !important; }
          .pp-zoom { width: ${dims.w}mm !important; height: ${dims.h}mm !important; }
          .pp-zoom > div { transform: none !important; }
          .pp-zoom .card-sheet { transform: none !important; }
          .pp-page { box-shadow: none !important; }
          .pp-sheet { page-break-after: always; break-after: page; margin: 0 !important; }
          .pp-sheet:last-child { page-break-after: auto; break-after: auto; }
          .pp-sheet > p { display: none !important; }
          .card-frame { display: none !important; }
        }
      `}</style>

      <div className="pp-bar sticky top-0 z-20 flex flex-wrap items-center gap-2 border-b border-neutral-300 bg-white px-4 py-3">
        <button
          type="button"
          onClick={() => nav(-1)}
          className="rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-[12px] font-bold text-neutral-700"
        >
          返回
        </button>
        <span className="text-[12.5px] font-black text-neutral-800">{name || '答题卡打印'}</span>
        <span className="rounded-md bg-neutral-100 px-2 py-1 text-[11px] font-semibold text-neutral-600">
          {dims.w}×{dims.h}mm · {doc?.meta.paperSize} {doc?.meta.orientation === 'landscape' ? '横版' : '竖版'} · {pageDocs.length > 1 ? '双面' : '单面'}
        </span>
        <select
          value={zoom}
          onChange={(e) => setZoom(Number(e.target.value))}
          className="rounded-lg border border-neutral-300 bg-white px-2 py-1.5 text-[12px] font-semibold"
        >
          {[0.4, 0.6, 0.75, 0.9, 1].map((z) => (
            <option key={z} value={z}>
              屏幕缩放 {Math.round(z * 100)}%
            </option>
          ))}
        </select>
        <span className="text-[11px] text-neutral-500">打印时请选「背景图形」开、缩放 100%、边距无</span>
        <div className="ml-auto flex items-center gap-2">
          {errors.length > 0 && (
            <span className="rounded-md bg-red-50 px-2 py-1 text-[11px] font-bold text-red-600">
              {errors.length} 个排布错误，打印前建议先修正
            </span>
          )}
          <button
            type="button"
            onClick={() => requestPrint({
              kind: 'answer-card',
              title: name || '答题卡',
              paperSize: doc?.meta.paperSize ?? 'A4',
              orientation: doc?.meta.orientation ?? 'portrait',
              widthMm: dims.w,
              heightMm: dims.h,
              pages: pageDocs.length,
              doubleSided: pageDocs.length > 1,
              source: '/papers/print',
            })}
            className="rounded-lg bg-neutral-900 px-4 py-1.5 text-[12px] font-bold text-white"
          >
            打印 / 存 PDF
          </button>
        </div>
      </div>

      <div className="pp-wrap flex items-start justify-center gap-6 p-6">
        {err ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-8 text-center text-[12.5px] font-semibold text-amber-800">
            {err}
            <div className="mt-3">
              <button
                type="button"
                onClick={() => nav('/papers/studio')}
                className="rounded-lg bg-neutral-900 px-4 py-2 text-[12px] font-bold text-white"
              >
                去答题卡制作
              </button>
            </div>
          </div>
        ) : !doc ? (
          <p className="py-20 text-[12px] text-neutral-500">正在生成打印页…</p>
        ) : (
          pageDocs.map((pageDoc, i) => (
            <div
              key={i}
              className="pp-zoom pp-sheet"
              style={{
                width: dims.w * PX_PER_MM * zoom,
                height: dims.h * PX_PER_MM * zoom,
                flex: 'none',
              }}
            >
              <div style={{ width: dims.w * PX_PER_MM, height: dims.h * PX_PER_MM }}>
                <div className="pp-page">
                  <CardSheet doc={pageDoc} zoom={zoom} />
                </div>
              </div>
              <p className="mt-1 text-center text-[10px] font-bold text-neutral-500">
                {pageDocs.length > 1 ? (i === 0 ? '正面' : '背面') : ''}
              </p>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

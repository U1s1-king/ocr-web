/**
 * 答题卡渲染器：mm 为单位直接输出 DOM，屏幕上按 zoom 缩放，打印时 1mm = 1mm。
 * 渲染只依赖 CardDoc（content + qmeta + bmeta），所以模板预览、编辑器、打印完全一致。
 */
import type { CSSProperties, ReactNode } from 'react'
import type { Block, Question } from '../../api/types'
import { MM_PER_UNIT, paperMm, u2mm, type CardDoc } from './types'

const PX_PER_MM = 96 / 25.4
const INK = '#20242a'
const RED = '#c0392b'
const LINE = '#9aa3ad'
const SOFT = '#c9d0d8'

const mm = (v: number) => `${Math.round(v * 100) / 100}mm`

export interface CardSheetProps {
  doc: CardDoc
  /** 屏幕缩放：1 = 96dpi 下的 1:1，通常用 fit 计算出的值 */
  zoom?: number
  className?: string
  children?: ReactNode
  /** 编辑时关闭阴影/圆角 */
  flat?: boolean
}

export function CardSheet({ doc, zoom = 1, className = '', children, flat }: CardSheetProps) {
  const page = paperMm(doc.meta.paperSize, doc.meta.orientation)
  return (
    <div
      className={className}
      style={{
        width: mm(page.w),
        height: mm(page.h),
        transform: `scale(${zoom})`,
        transformOrigin: 'top left',
        flex: 'none',
      }}
    >
      <div
        className={flat ? 'relative bg-white' : 'relative overflow-hidden bg-white shadow-[0_12px_40px_-12px_rgba(20,24,30,0.35)]'}
        style={{ width: mm(page.w), height: mm(page.h) }}
      >
        <CardBody doc={doc} />
        {children}
      </div>
    </div>
  )
}

/** 只画内容，不负责缩放 */
export function CardBody({ doc }: { doc: CardDoc }) {
  return (
    <div
      className="card-body absolute inset-0 overflow-hidden bg-white"
      style={{
        color: INK,
        fontFamily: doc.meta.gaokao ? '"Songti SC", "SimSun", "Noto Serif SC", serif' : undefined,
      }}
    >
      {doc.content.blocks?.filter((b) => !doc.hidden?.includes(b.id)).map((b) => (
        <BlockView key={b.id} doc={doc} block={b} />
      ))}
      {doc.content.questions?.filter((q) => !doc.hidden?.includes(q.id)).map((q) => (
        <QuestionView key={q.id} doc={doc} q={q} />
      ))}
      {doc.content.markers?.map((m) => (
        <div
          key={m.id}
          className="absolute bg-[#111]"
          style={{ left: mm(u2mm(m.x)), top: mm(u2mm(m.y)), width: mm(u2mm(m.size)), height: mm(u2mm(m.size)) }}
        />
      ))}
      {/* 页面外框只做屏幕提示，不进纸面内容 */}
      <div
        className="card-frame pointer-events-none absolute"
        style={{ inset: 0, border: `0.15mm dashed ${SOFT}`, opacity: 0.35 }}
      />
    </div>
  )
}

/* ---------------- 文本块 ---------------- */

function BlockView({ doc, block }: { doc: CardDoc; block: Block }) {
  const r = block.region
  const box: CSSProperties = {
    left: mm(u2mm(r.x)),
    top: mm(u2mm(r.y)),
    width: mm(u2mm(r.width)),
    height: mm(u2mm(r.height)),
    position: 'absolute',
    transform: doc.bmeta[block.id]?.rotate ? `rotate(${doc.bmeta[block.id]!.rotate}deg)` : undefined,
    transformOrigin: 'center center',
  }
  const meta = doc.bmeta[block.id]
  const kind = meta?.kind ?? 'text'
  const st = block.style ?? {}
  const fontSize = st.fontSize ?? 4
  const base: CSSProperties = {
    fontSize: mm(fontSize),
    fontWeight: st.fontWeight === 'bold' ? 700 : 400,
    textAlign: st.textAlign ?? 'left',
    color: st.color ?? INK,
    lineHeight: st.lineHeight ?? 1.35,
    whiteSpace: 'pre-wrap',
    overflow: 'hidden',
  }

  if (kind === 'examLine') {
    return (
      <div style={{ ...box, ...base, color: RED, fontSize: mm(fontSize), letterSpacing: '0.08em' }}>{block.text}</div>
    )
  }
  if (kind === 'title') {
    return (
      <div style={{ ...box, ...base, letterSpacing: '0.22em', lineHeight: 1.05 }}>{block.text}</div>
    )
  }
  if (kind === 'student') {
    return (
      <div style={{ ...box, border: `0.25mm solid ${INK}`, display: 'flex', alignItems: 'center', padding: `0 ${mm(1.6)}`, ...base }}>
        {block.text}
      </div>
    )
  }
  if (kind === 'notice') {
    return (
      <div style={{ ...box, border: `0.3mm solid ${RED}`, display: 'flex', overflow: 'hidden' }}>
        <div
          style={{
            width: mm(4.2),
            flexShrink: 0,
            borderRight: `0.2mm solid ${RED}`,
            display: 'grid',
            placeItems: 'center',
            color: RED,
            fontWeight: 700,
            fontSize: mm(2.9),
            writingMode: 'vertical-rl',
            letterSpacing: '0.1em',
          }}
        >
          注意事项
        </div>
        <div style={{ ...base, flex: 1, minWidth: 0, padding: `${mm(0.8)} ${mm(1.4)}` }}>{block.text}</div>
      </div>
    )
  }
  if (kind === 'legend') {
    return <div style={{ ...box, ...base, display: 'flex', alignItems: 'center', whiteSpace: 'nowrap', fontSize: mm(2.7) }}>{block.text}</div>
  }
  if (kind === 'section') {
    return (
      <div
        style={{
          ...box,
          ...base,
          display: 'flex',
          alignItems: 'center',
          borderBottom: `0.2mm solid ${INK}`,
          fontSize: mm(fontSize),
          letterSpacing: '0.02em',
        }}
      >
        {block.text}
      </div>
    )
  }
  if (kind === 'footer') {
    return (
      <div style={{ ...box, ...base, color: '#555', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: mm(2.4) }}>
        {block.text}
      </div>
    )
  }
  if (kind === 'examNo') {
    const digits = meta?.digits ?? 12
    return (
      <div style={{ ...box, display: 'flex', alignItems: 'center', gap: mm(1.2) }}>
        <span style={{ fontSize: mm(fontSize), fontWeight: 700, whiteSpace: 'nowrap' }}>{block.text}</span>
        <div style={{ display: 'flex', gap: mm(0.5), flex: 1, minWidth: 0, overflow: 'hidden' }}>
          {Array.from({ length: digits }).map((_, i) => (
            <span
              key={i}
              style={{
                flex: '1 1 0',
                maxWidth: mm(6.4),
                height: mm(6.2),
                border: `0.25mm solid ${INK}`,
                borderRadius: mm(0.6),
              }}
            />
          ))}
        </div>
      </div>
    )
  }
  if (kind === 'paperType') {
    const types = meta?.paperTypes ?? []
    return (
      <div
        style={{
          ...box,
          border: `0.25mm solid ${INK}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: mm(1.2),
          flexWrap: 'wrap',
          fontSize: mm(block.style?.fontSize ?? 2.8),
          padding: mm(0.6),
        }}
      >
        {types.length > 0 && (
          <span style={{ display: 'flex', alignItems: 'center', gap: mm(0.8), whiteSpace: 'nowrap' }}>
            试卷类型
            {types.map((t) => (
              <span key={t} style={{ display: 'inline-flex', alignItems: 'center', gap: mm(0.3) }}>
                <span style={{ width: mm(2.6), height: mm(2.6), border: `0.25mm solid ${INK}`, display: 'inline-block' }} />
                {t}
              </span>
            ))}
          </span>
        )}
        <span style={{ display: 'flex', alignItems: 'center', gap: mm(0.5), whiteSpace: 'nowrap' }}>
          缺考标记
          <span style={{ width: mm(2.6), height: mm(2.6), border: `0.25mm solid ${INK}`, display: 'inline-block' }} />
        </span>
      </div>
    )
  }
  if (kind === 'pageFooter') {
    return (
      <div style={{ ...box, ...base, color: RED, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: mm(fontSize) }}>
        {block.text}
      </div>
    )
  }
  if (kind === 'barcode') {
    // 示例学生条形码粘贴区：只画虚线框与说明，不生成真实条形码
    return (
      <div
        style={{
          ...box,
          border: `0.3mm dashed #444`,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: mm(0.9),
          color: '#444',
          background: '#fff',
          ...base,
        }}
      >
        <span style={{ fontSize: mm(2.8), fontWeight: 700 }}>{block.text || '贴条形码区'}</span>
        <span style={{ fontSize: mm(2.1), opacity: 0.65 }}>（示例学生粘贴处）</span>
      </div>
    )
  }
  if (kind === 'divider') {
    return <div style={{ ...box, borderTop: `0.25mm dashed ${LINE}` }} />
  }
  return <div style={{ ...box, ...base }}>{block.text}</div>
}


/* ---------------- 题目 ---------------- */

function QuestionView({ doc, q }: { doc: CardDoc; q: Question }) {
  const r = q.region
  const left = mm(u2mm(r.x))
  const top = mm(u2mm(r.y))
  const width = mm(u2mm(r.width))
  const height = mm(u2mm(r.height))

  if (q.type === 'subjective') {
    const qm = doc.qmeta[q.id] ?? { style: 'lines', rows: 4 }
    return (
      <div
        className="absolute"
        style={{ left, top, width, height, border: `0.3mm solid ${RED}`, background: '#fffefd' }}
      >
        <div
          className="absolute top-0 left-0 flex items-center gap-[0.8mm] bg-white"
          style={{ padding: '0.3mm 1mm', fontSize: '2.7mm', color: INK, maxWidth: '100%' }}
        >
          {qm.label ? (
            <>
              <b>{qm.label}</b>
            </>
          ) : (
            <>
              <b>{q.displayNumber ?? ''}</b>
              <span style={{ color: '#555' }}>（{q.score} 分）</span>
            </>
          )}
        </div>
        {qm.style === 'grid' ? (
          <GridLines cols={qm.gridCols ?? 20} topMm={4.5} />
        ) : qm.style === 'blank' ? null : (
          <RuledLines rows={qm.rows ?? 4} topMm={4.5} />
        )}
      </div>
    )
  }

  // 选择题：题号 + 选项框
  const options = q.choices ?? []
  return (
    <div className="absolute" style={{ left, top, width, height }}>
      <span
        style={{
          position: 'absolute',
          left: 0,
          top: '50%',
          transform: 'translateY(-50%)',
          fontSize: '3mm',
          color: '#333',
          fontWeight: 600,
          minWidth: '4.6mm',
          textAlign: 'right',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {q.displayNumber ?? ''}.
      </span>
      {options.map((c) => {
        const cr = c.region
        const bw = u2mm(r.width) * cr.width
        const bh = u2mm(r.height) * cr.height
        const cx = u2mm(r.width) * cr.x
        const cy = u2mm(r.height) * cr.y
        return (
          <div
            key={c.value}
            style={{
              position: 'absolute',
              left: mm(cx),
              top: mm(cy),
              width: mm(bw),
              height: mm(bh),
              border: `0.22mm solid ${LINE}`,
              borderRadius: '0.5mm',
              display: 'grid',
              placeItems: 'center',
              fontSize: mm(Math.min(3.1, bh * 0.72)),
              color: '#5b636d',
              lineHeight: 1,
            }}
          >
            {c.value}
          </div>
        )
      })}
    </div>
  )
}

function RuledLines({ rows, topMm }: { rows: number; topMm: number }) {
  const n = Math.max(1, rows)
  return (
    <div className="absolute right-0 bottom-0 left-0" style={{ top: mm(topMm), bottom: mm(1.2), margin: '0 1.2mm' }}>
      {Array.from({ length: n }).map((_, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: `calc(${((i + 1) / n) * 100}% - 0.1mm)`,
            borderTop: `0.22mm solid #c2c9d2`,
          }}
        />
      ))}
    </div>
  )
}

function GridLines({ cols, topMm }: { cols: number; topMm: number }) {
  const c = Math.max(4, cols)
  return (
    <div
      className="absolute right-0 bottom-0 left-0"
      style={{
        top: mm(topMm),
        bottom: mm(1),
        margin: '0 1.2mm',
        backgroundImage: `linear-gradient(to right, #c2c9d2 0.22mm, transparent 0.22mm), linear-gradient(to bottom, #c2c9d2 0.22mm, transparent 0.22mm)`,
        backgroundSize: `calc(100% / ${c}) 4.9mm`,
        backgroundColor: '#fff',
      }}
    />
  )
}

/* ---------------- 缩放工具 ---------------- */

/** 在给定容器宽度下把整页装进去 */
export function fitZoom(doc: CardDoc, containerWidthPx: number, padding = 0): number {
  const page = paperMm(doc.meta.paperSize, doc.meta.orientation)
  const px = page.w * PX_PER_MM
  return Math.max(0.1, (containerWidthPx - padding) / px)
}

export function pxPerMm(zoom: number): number {
  return PX_PER_MM * zoom
}

/** 画布单位 → 屏幕像素 */
export function unitToPx(unit: number, zoom: number): number {
  return u2mm(unit) * pxPerMm(zoom)
}

/** mm 字符串便捷函数，供编辑器浮层使用 */
export function mmValue(v: number): string {
  return mm(v)
}

export const CARD_COLORS = { ink: INK, red: RED, line: LINE, soft: SOFT, unitMm: MM_PER_UNIT }

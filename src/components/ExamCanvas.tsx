import type { ExamContent, Question, Region } from '../api/types'

interface Props {
  content: ExamContent
  selectedId: string | null
  onSelect: (id: string | null) => void
}

const PAD = 8

/** 题型配色 */
const COLORS = {
  mark: { fill: '#e982a2', stroke: '#c2506f' },
  subjective: { fill: '#8b9df0', stroke: '#5c6fd8' },
  block: { fill: '#9ed3b5', stroke: '#4f9d75' },
  marker: { fill: '#f0b24a', stroke: '#b87c15' },
}

/** 试卷可视化预览：按画布单位等比缩放到容器 */
export function ExamCanvas({ content, selectedId, onSelect }: Props) {
  const { canvas, markers, questions, blocks, barcode } = content
  const vw = canvas.width + PAD * 2
  const vh = canvas.height + PAD * 2

  const rect = (r: Region) => ({ x: r.x + PAD, y: r.y + PAD, width: r.width, height: r.height })

  return (
    <div className="rounded-3xl border border-brand-200 bg-white p-3 shadow-soft">
      <svg
        viewBox={`0 0 ${vw} ${vh}`}
        className="h-auto w-full select-none"
        onClick={() => onSelect(null)}
        role="img"
        aria-label="答题卡预览"
      >
        {/* 纸张 */}
        <rect x={0} y={0} width={vw} height={vh} fill="#fdf7fa" />
        <rect
          x={PAD}
          y={PAD}
          width={canvas.width}
          height={canvas.height}
          fill="#ffffff"
          stroke="#e982a2"
          strokeWidth={0.6}
          strokeDasharray="2 1.5"
        />

        {/* 定位块 */}
        {markers?.map((m) => (
          <g key={m.id}>
            <rect
              x={m.x + PAD}
              y={m.y + PAD}
              width={m.size}
              height={m.size}
              fill={COLORS.marker.fill}
              stroke={COLORS.marker.stroke}
              strokeWidth={0.4}
            />
            <text
              x={m.x + PAD + m.size / 2}
              y={m.y + PAD + m.size / 2}
              fontSize={m.size * 0.42}
              fill="#7a4e05"
              textAnchor="middle"
              dominantBaseline="central"
              fontWeight="bold"
            >
              {m.id === 'top-left' ? '1' : m.id === 'top-right' ? '2' : m.id === 'bottom-left' ? '3' : '4'}
            </text>
          </g>
        ))}

        {/* 内容块 */}
        {blocks?.map((b) => {
          const r = rect(b.region)
          const sel = selectedId === b.id
          const fs = b.style?.fontSize ?? 4
          const lines = b.text.split('\n')
          const lh = fs * (b.style?.lineHeight ?? 1.35)
          const anchor =
            b.style?.textAlign === 'center' ? 'middle' : b.style?.textAlign === 'right' ? 'end' : 'start'
          const tx =
            anchor === 'middle' ? r.x + r.width / 2 : anchor === 'end' ? r.x + r.width : r.x
          return (
            <g
              key={b.id}
              onClick={(e) => {
                e.stopPropagation()
                onSelect(b.id)
              }}
              className="cursor-pointer"
            >
              <rect
                x={r.x}
                y={r.y}
                width={r.width}
                height={r.height}
                fill={COLORS.block.fill + '22'}
                stroke={sel ? COLORS.block.stroke : COLORS.block.fill + '66'}
                strokeWidth={sel ? 0.8 : 0.35}
                strokeDasharray={sel ? undefined : '1.2 1'}
              />
              {lines.map((ln, i) => (
                <text
                  key={i}
                  x={tx}
                  y={r.y + fs + i * lh}
                  fontSize={fs}
                  fill={b.style?.color ?? '#2f4f3c'}
                  fontWeight={b.style?.fontWeight === 'bold' ? 'bold' : 'normal'}
                  textAnchor={anchor}
                >
                  {ln || ' '}
                </text>
              ))}
            </g>
          )
        })}

        {/* 小题 */}
        {questions?.map((q) => (
          <QuestionShape key={q.id} q={q} selected={selectedId === q.id} onSelect={() => onSelect(q.id)} />
        ))}

        {/* 条形码 */}
        {barcode && <BarcodeShape barcode={barcode} canvas={canvas} />}
      </svg>
    </div>
  )
}

function QuestionShape({ q, selected, onSelect }: { q: Question; selected: boolean; onSelect: () => void }) {
  const c = COLORS[q.type]
  const { x, y, width, height } = q.region
  const rx = x + PAD
  const ry = y + PAD

  return (
    <g onClick={(e) => { e.stopPropagation(); onSelect() }} className="cursor-pointer">
      <rect
        x={rx}
        y={ry}
        width={width}
        height={height}
        fill={selected ? c.fill + '38' : c.fill + '1c'}
        stroke={selected ? c.stroke : c.fill}
        strokeWidth={selected ? 0.9 : 0.4}
      />
      {q.type === 'mark' &&
        q.choices?.map((ch) => (
          <rect
            key={ch.value}
            x={rx + ch.region.x * width}
            y={ry + ch.region.y * height}
            width={ch.region.width * width}
            height={ch.region.height * height}
            fill="none"
            stroke={c.stroke}
            strokeWidth={0.35}
            rx={0.6}
          />
        ))}
      <text x={rx + 0.8} y={ry + 3.2} fontSize={2.6} fill={c.stroke} fontWeight="bold">
        {q.displayNumber ?? q.id}
      </text>
      {q.type === 'mark' &&
        q.choices?.map((ch) => (
          <text
            key={`t-${ch.value}`}
            x={rx + (ch.region.x + ch.region.width / 2) * width}
            y={ry + (ch.region.y + ch.region.height / 2) * height}
            fontSize={Math.min(ch.region.height * height * 0.55, 2.6)}
            fill={c.stroke}
            textAnchor="middle"
            dominantBaseline="central"
            opacity={0.85}
          >
            {ch.value}
          </text>
        ))}
    </g>
  )
}

function BarcodeShape({
  barcode,
  canvas,
}: {
  barcode: NonNullable<ExamContent['barcode']>
  canvas: ExamContent['canvas']
}) {
  const w = barcode.size.width
  const h = barcode.size.height
  let x = 0
  let y = 0
  if (barcode.anchor.includes('top')) y = barcode.offset.y
  else y = canvas.height - barcode.offset.y - h
  if (barcode.anchor.includes('left')) x = barcode.offset.x
  else x = canvas.width - barcode.offset.x - w

  const bars = Array.from({ length: 26 }).map((_, i) => (i * 7 + 3) % 5)

  return (
    <g>
      <rect x={x + PAD} y={y + PAD} width={w} height={h} fill="#fff" stroke="#999" strokeWidth={0.3} />
      {bars.map((bw, i) => (
        <rect
          key={i}
          x={x + PAD + (i * w) / 26 + 1}
          y={y + PAD + 1}
          width={Math.max(0.6, (bw / 6) * (w / 26))}
          height={h - 4}
          fill="#222"
        />
      ))}
      <text x={x + PAD + w / 2} y={y + PAD + h - 0.9} fontSize={1.8} textAnchor="middle" fill="#444">
        {barcode.value}
      </text>
    </g>
  )
}

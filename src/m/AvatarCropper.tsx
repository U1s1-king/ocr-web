/* 头像裁剪：拖动平移 + 滑条缩放，确定后只存参数（动图不重编码） */
import { useRef, useState } from 'react'
import { clamp } from './profile'
import { Btn } from './ui'

export type Crop = { zoom: number; x: number; y: number }

export default function AvatarCropper({
  src,
  value,
  onCancel,
  onDone,
  size = 200,
}: {
  src: string
  value: Crop
  onCancel: () => void
  onDone: (c: Crop) => void
  size?: number
}) {
  const [zoom, setZoom] = useState(clamp(value.zoom || 1, 1, 3))
  const [pos, setPos] = useState({ x: clamp(value.x || 0, -1, 1), y: clamp(value.y || 0, -1, 1) })
  const drag = useRef<{ id: number; sx: number; sy: number; x: number; y: number } | null>(null)

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    drag.current = { id: e.pointerId, sx: e.clientX, sy: e.clientY, x: pos.x, y: pos.y }
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const d = drag.current
    if (!d || d.id !== e.pointerId) return
    const range = size * Math.max(zoom - 1, 0.001)
    setPos({
      x: clamp(d.x + (e.clientX - d.sx) / range, -1, 1),
      y: clamp(d.y + (e.clientY - d.sy) / range, -1, 1),
    })
  }

  function onPointerUp() {
    drag.current = null
  }

  return (
    <div className="flex w-full flex-col items-center gap-3">
      <div
        className="relative isolate flex-none touch-none select-none"
        style={{ width: size, height: size, minWidth: size, minHeight: size }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <span className="absolute inset-0 overflow-hidden rounded-full bg-black/5">
          <img
            src={src}
            alt="裁剪预览"
            draggable={false}
            className="block max-w-none select-none"
            style={{
              position: 'absolute',
              left: '50%',
              top: '50%',
              width: size * zoom,
              height: size * zoom,
              objectFit: 'cover',
              objectPosition: `${50 + pos.x * 50}% ${50 + pos.y * 50}%`,
              transform: 'translate(-50%, -50%)',
              pointerEvents: 'none',
            }}
          />
        </span>
        <span className="pointer-events-none absolute inset-0 rounded-full ring-2 ring-white/85" />
      </div>

      <div className="w-full px-2">
        <div className="mb-1 flex items-center justify-between text-[11px] font-bold text-ink-soft">
          <span>缩放</span>
          <span>{zoom.toFixed(2)}x</span>
        </div>
        <input
          type="range"
          min={1}
          max={3}
          step={0.01}
          value={zoom}
          className="w-full accent-[var(--mo-accent)]"
          onChange={(e) => setZoom(Number(e.target.value))}
        />
        <p className="mo-muted mt-1">拖动图片调整位置，滑条放大缩小</p>
      </div>

      <div className="flex w-full gap-2">
        <Btn block variant="ghost" onClick={onCancel}>
          取消
        </Btn>
        <Btn block onClick={() => onDone({ zoom, x: pos.x, y: pos.y })}>
          用这张
        </Btn>
      </div>
    </div>
  )
}

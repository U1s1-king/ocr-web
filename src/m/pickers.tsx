import { useState } from 'react'
import { filesApi, papersApi, studentsApi, type PaperJson, type Student } from './api'
import { IcFile, IcLayers, IcSearch, IcUsers } from './icons'
import { Btn, CheckDot, Empty, ErrorBar, ListSkeleton, Row, Sheet, useLoad } from './ui'

/* ---------------- 试卷预览 ---------------- */

export function PaperPreview({ paper, tall }: { paper: PaperJson | Record<string, never>; tall?: boolean }) {
  const json = paper as PaperJson
  if (!json || !json.canvas) {
    return (
      <div className="grid place-items-center rounded-2xl border border-dashed border-brand-300 bg-brand-50 py-10 text-[11px] font-bold text-brand-700/60">
        这张试卷还没有配置内容
      </div>
    )
  }
  const { canvas } = json
  return (
    <div
      className="relative w-full overflow-hidden rounded-2xl border border-brand-200 bg-white"
      style={{ aspectRatio: `${canvas.width} / ${canvas.height}`, maxHeight: tall ? 420 : 260 }}
    >
      {(json.questions ?? []).map((q, i) => {
        const x = (q.region.x / canvas.width) * 100
        const y = (q.region.y / canvas.height) * 100
        const w = (q.region.width / canvas.width) * 100
        const h = (q.region.height / canvas.height) * 100
        return (
          <div
            key={q.id}
            className="absolute rounded-[3px] border border-brand-300/80 bg-brand-100/40"
            style={{ left: `${x}%`, top: `${y}%`, width: `${w}%`, height: `${h}%`, animationDelay: `${i * 18}ms` }}
          >
            <span className="absolute -top-[7px] left-0 text-[6px] font-black text-brand-700/70">{q.displayNumber ?? q.id}</span>
            {(q.choices ?? []).map((c, k) => (
              <span
                key={c.value}
                className="absolute top-1/2 h-[46%] -translate-y-1/2 rounded-full border border-brand-400/50 bg-white/70"
                style={{
                  left: `${(c.region.x + c.region.width / 2) * 100}%`,
                  width: `${c.region.width * 100}%`,
                  transform: 'translate(-50%, -50%)',
                  animationDelay: `${k * 10}ms`,
                }}
              />
            ))}
          </div>
        )
      })}
      {(json.blocks ?? []).map((b) => (
        <div
          key={b.id}
          className="absolute truncate px-1 text-[6px] font-bold text-ink/80"
          style={{
            left: `${(b.region.x / canvas.width) * 100}%`,
            top: `${(b.region.y / canvas.height) * 100}%`,
            width: `${(b.region.width / canvas.width) * 100}%`,
            height: `${(b.region.height / canvas.height) * 100}%`,
          }}
        >
          {b.text}
        </div>
      ))}
      <div className="pointer-events-none absolute left-[2%] top-[2%] h-3 w-3 rounded-sm border-2 border-brand-700/60" />
      <div className="pointer-events-none absolute right-[2%] top-[2%] h-3 w-3 rounded-sm border-2 border-brand-700/60" />
      <div className="pointer-events-none absolute bottom-[2%] left-[2%] h-3 w-3 rounded-sm border-2 border-brand-700/60" />
      <div className="pointer-events-none absolute bottom-[2%] right-[2%] h-3 w-3 rounded-sm border-2 border-brand-700/60" />
    </div>
  )
}

/* ---------------- 试卷选择 ---------------- */

export function PaperPicker({
  open,
  onClose,
  onPick,
  selected,
}: {
  open: boolean
  onClose: () => void
  onPick: (id: number, name: string) => void
  selected?: number | null
}) {
  const { data, loading, error, reload } = useLoad(() => papersApi.list(), [] as { id: number; name: string }[], [open])
  return (
    <Sheet open={open} onClose={onClose} title="选择试卷">
      {error && <ErrorBar text={error} onRetry={reload} />}
      {loading ? (
        <ListSkeleton rows={3} />
      ) : data.length === 0 ? (
        <Empty icon={<IcLayers style={{ fontSize: 24 }} />} title="还没有试卷" tip="先在「试卷」里创建一张答题卡" />
      ) : (
        <div className="mo-rows">
          {data.map((p) => (
            <Row
              key={p.id}
              icon={<IcLayers style={{ fontSize: 17 }} />}
              title={p.name}
              sub={`试卷 #${p.id}`}
              right={<CheckDot on={selected === p.id} />}
              onClick={() => {
                onPick(p.id, p.name)
                onClose()
              }}
            />
          ))}
        </div>
      )}
    </Sheet>
  )
}

/* ---------------- 文件选择 ---------------- */

export function FilePicker({
  open,
  onClose,
  onPick,
  selected = [],
}: {
  open: boolean
  onClose: () => void
  onPick: (ids: number[]) => void
  selected?: number[]
}) {
  const [q, setQ] = useState('')
  const [picked, setPicked] = useState<number[]>(selected)
  const { data, loading, error, reload } = useLoad(
    () => filesApi.search({ q: q || undefined, limit: 30 }),
    { query: q, suffix: '', total: 0, limit: 30, offset: 0, items: [] },
    [q, open],
  )
  const items = data.items.filter((f) => !q || f.name.includes(q))

  function toggle(id: number) {
    setPicked((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={`选择文件${picked.length ? ` · 已选 ${picked.length}` : ''}`}
      footer={
        <Btn
          block
          disabled={!picked.length}
          onClick={() => {
            onPick(picked)
            onClose()
          }}
        >
          确认选择
        </Btn>
      }
    >
      <div className="relative mb-3">
        <IcSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-brand-400" style={{ fontSize: 16 }} />
        <input
          className="mo-input pl-10"
          placeholder="搜索文件名 / 后缀"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>
      {error && <ErrorBar text={error} onRetry={reload} />}
      {loading ? (
        <ListSkeleton rows={4} />
      ) : items.length === 0 ? (
        <Empty icon={<IcFile style={{ fontSize: 24 }} />} title="没有匹配的文件" tip="先到「文件库」上传答题卡照片" />
      ) : (
        <div className="mo-rows">
          {items.map((f) => (
            <Row
              key={f.fileId}
              icon={<IcFile style={{ fontSize: 17 }} />}
              title={f.name}
              sub={`#${f.fileId} · ${f.suffix.toUpperCase()}`}
              right={<CheckDot on={picked.includes(f.fileId)} />}
              onClick={() => toggle(f.fileId)}
            />
          ))}
        </div>
      )}
    </Sheet>
  )
}

/* ---------------- 学生选择 / 考号映射 ---------------- */

export function StudentPicker({
  open,
  onClose,
  onPick,
}: {
  open: boolean
  onClose: () => void
  onPick: (s: Student) => void
}) {
  const { data, loading, error, reload } = useLoad(() => studentsApi.list(), [], [open])
  return (
    <Sheet open={open} onClose={onClose} title="选择考生">
      {error && <ErrorBar text={error} onRetry={reload} />}
      {loading ? (
        <ListSkeleton rows={4} />
      ) : (
        <div className="mo-rows">
          {data.map((s, i) => (
            <Row
              key={s.id ?? i}
              icon={<IcUsers style={{ fontSize: 17 }} />}
              title={s.name}
              sub={`${s.candidateNumber ?? '无考号'} · ${s.className ?? '—'}`}
              onClick={() => {
                onPick(s)
                onClose()
              }}
            />
          ))}
        </div>
      )}
    </Sheet>
  )
}

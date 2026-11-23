import { useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { examsApi, filesApi, papersApi, type CheckItem, type CheckResponse } from '../api'
import { IcAlert, IcCamera, IcCheck, IcClock, IcFile, IcImage, IcLayers, IcRefresh, IcSpark, IcX } from '../icons'
import { PaperPicker } from '../pickers'
import { Bar, Btn, Card, ErrorBar, Page, Ring, Skeleton } from '../ui'
import { cropDataURL, prepareImage, rotateDataURL } from '../../lib/image'
import {
  makeScanId,
  saveScan,
  type OfflineScan,
} from '../../lib/offlineHistory'
import { scanFromCheckItem } from '../../lib/scanRecord'
import { EXPORT_FORMATS, downloadScans } from '../../lib/export'

type Step = 'pick' | 'crop' | 'scan' | 'ready' | 'done'
type UploadedPage = { fileId: number; preview: string; page: number }
type Box = { x: number; y: number; w: number; h: number }
type DragMode = 'move' | 'nw' | 'ne' | 'sw' | 'se'

const DEFAULT_BOX: Box = { x: 4, y: 6, w: 92, h: 88 }
const MIN_SIZE = 12

export default function Capture() {
  const nav = useNavigate()
  const [search] = useSearchParams()
  const examId = Number(search.get('examId') || 0)
  const fileRef = useRef<HTMLInputElement>(null)
  const frameRef = useRef<HTMLDivElement>(null)
  const [step, setStep] = useState<Step>('pick')
  const [src, setSrc] = useState('')
  const [fileName, setFileName] = useState('')
  const [box, setBox] = useState<Box>(DEFAULT_BOX)
  const [rotating, setRotating] = useState(false)
  const [pct, setPct] = useState(0)
  const [paperId, setPaperId] = useState<number | null>(1)
  const [paperName, setPaperName] = useState('高一数学第一次月考答题卡')
  const [pickOpen, setPickOpen] = useState(false)
  const [result, setResult] = useState<CheckResponse | null>(null)
  const [pages, setPages] = useState<UploadedPage[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [saved, setSaved] = useState<OfflineScan[]>([])
  const [err, setErr] = useState('')
  const drag = useRef<{ mode: DragMode; sx: number; sy: number; box: Box; w: number; h: number } | null>(null)

  async function onFile(file?: File | null) {
    if (!file) return
    setErr('')
    setFileName(file.name)
    setResult(null)
    setSaved([])
    try {
      // 大图先压到长边 2400，避免超过后端的 10 MiB 上限
      const prep = await prepareImage(file)
      setSrc(prep.preview)
      setBox(DEFAULT_BOX)
      setStep('crop')
    } catch (e) {
      setErr(e instanceof Error ? e.message : '图片读取失败')
      setStep('pick')
    }
  }

  async function rotate() {
    if (!src || rotating) return
    setRotating(true)
    try {
      const next = await rotateDataURL(src, 90)
      setSrc(next.dataURL)
      setBox(DEFAULT_BOX)
    } catch {
      setErr('旋转失败，请重新选图')
    } finally {
      setRotating(false)
    }
  }

  function beginDrag(mode: DragMode, e: React.PointerEvent) {
    e.preventDefault()
    e.stopPropagation()
    const r = frameRef.current?.getBoundingClientRect()
    if (!r) return
    ;(e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId)
    drag.current = { mode, sx: e.clientX, sy: e.clientY, box: { ...box }, w: r.width, h: r.height }
  }

  function onDragMove(e: React.PointerEvent) {
    const d = drag.current
    if (!d) return
    const dx = ((e.clientX - d.sx) / d.w) * 100
    const dy = ((e.clientY - d.sy) / d.h) * 100
    const b = d.box
    if (d.mode === 'move') {
      setBox({
        ...b,
        x: clamp(b.x + dx, 0, 100 - b.w),
        y: clamp(b.y + dy, 0, 100 - b.h),
      })
      return
    }
    let left = b.x
    let top = b.y
    let right = b.x + b.w
    let bottom = b.y + b.h
    if (d.mode.includes('w')) left = clamp(b.x + dx, 0, right - MIN_SIZE)
    if (d.mode.includes('e')) right = clamp(b.x + b.w + dx, left + MIN_SIZE, 100)
    if (d.mode.includes('n')) top = clamp(b.y + dy, 0, bottom - MIN_SIZE)
    if (d.mode.includes('s')) bottom = clamp(b.y + b.h + dy, top + MIN_SIZE, 100)
    setBox({ x: left, y: top, w: right - left, h: bottom - top })
  }

  function endDrag() {
    drag.current = null
  }

  async function cropAndUpload() {
    if (!src) return
    setStep('scan')
    setPct(4)
    setErr('')
    try {
      const cropped = await cropDataURL(src, {
        x: box.x / 100,
        y: box.y / 100,
        w: box.w / 100,
        h: box.h / 100,
      })
      const file = new File([cropped.blob], fileName.replace(/\.\w+$/, '') + '_crop.jpg', {
        type: 'image/jpeg',
      })
      const up = await filesApi.upload(file, (p) => setPct(Math.max(6, Math.round(p * 0.85))))
      setPct(100)
      setPages((list) => [...list, { fileId: up.fileId, preview: src, page: list.length + 1 }])
      setSrc('')
      setFileName('')
      setStep('ready')
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      setErr(msg)
      setStep('ready')
    }
  }

  async function submitPages() {
    if (!pages.length) return
    setSubmitting(true)
    setErr('')
    setStep('scan')
    setPct(12)
    try {
      if (examId > 0) {
        await examsApi.gradeSubmissions(examId, [
          { files: pages.map((p, i) => ({ page: i + 1, fileId: p.fileId })) },
        ])
        nav(`/m/exams/${examId}`, { replace: true })
        return
      }
      const check = await papersApi.checkPages(
        paperId ?? 1,
        pages.map((p, i) => ({ page: i + 1, fileId: p.fileId })),
      )
      setPct(100)
      setResult(check)
      setSaved(await persistScans(check, paperName))
      setStep('done')
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
      setStep('ready')
    } finally {
      setSubmitting(false)
    }
  }


  return (
    <Page
      title="拍照识别"
      sub="CAPTURE · CROP · OCR"
      back
      actions={<span className="mo-badge">{STEP_LABEL[step]}</span>}
    >
      <div className="mb-3 flex items-center gap-2">
        <button type="button" className="mo-chip flex-1 justify-start" onClick={() => setPickOpen(true)}>
          <IcLayers style={{ fontSize: 13 }} />
          <span className="truncate">{paperName}</span>
        </button>
        <button
          type="button"
          className="mo-chip flex-none"
          onClick={() => nav('/m/history')}
          aria-label="本机识别历史"
        >
          <IcClock style={{ fontSize: 13 }} /> 历史
        </button>
      </div>

      {step === 'pick' && (
        <Card delay={0} className="!p-4">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="relative grid w-full place-items-center overflow-hidden rounded-2xl border border-dashed border-brand-300 bg-brand-50/60 py-12"
          >
            <span className="mo-badge mb-3">第一步</span>
            <IcCamera style={{ fontSize: 34 }} className="text-brand-500" />
            <p className="mt-3 text-[13px] font-extrabold">拍照或从相册选择</p>
            <p className="mo-muted mt-1">自动压缩长边 2400，支持 JPG / PNG</p>
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => onFile(e.target.files?.[0])}
          />
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Btn variant="ghost" onClick={() => fileRef.current?.click()}>
              <IcImage style={{ fontSize: 16 }} /> 相册
            </Btn>
            <Btn variant="ghost" onClick={() => nav('/m/files')}>
              <IcLayers style={{ fontSize: 16 }} /> 文件库
            </Btn>
          </div>
          {err && (
            <div className="mt-3">
              <ErrorBar text={err} />
            </div>
          )}
        </Card>
      )}

      {step === 'crop' && (
        <div className="mo-page">
          <Card className="!p-3">
            <div
              ref={frameRef}
              className="relative select-none overflow-hidden rounded-2xl bg-[#191b20]"
              style={{ touchAction: 'none' }}
              onPointerMove={onDragMove}
              onPointerUp={endDrag}
              onPointerCancel={endDrag}
            >
              <img src={src} alt="待识别" className="block w-full" draggable={false} />
              <div className="pointer-events-none absolute inset-0 bg-[#101216]/55" />
              <div
                className="absolute border-2 border-white/95"
                style={{ left: `${box.x}%`, top: `${box.y}%`, width: `${box.w}%`, height: `${box.h}%` }}
                onPointerDown={(e) => beginDrag('move', e)}
              >
                <span className="mo-scanline" />
                {CORNERS.map((c) => (
                  <span
                    key={c.key}
                    onPointerDown={(e) => beginDrag(c.key, e)}
                    style={{ ...c.style, cursor: c.cursor }}
                    className="absolute h-6 w-6 rounded-full border-2 border-brand-300 bg-white/95 shadow-[0_2px_8px_rgba(0,0,0,.45)]"
                  >
                    <span className="absolute inset-[5px] rounded-full bg-brand-500/80" />
                  </span>
                ))}
                <span className="pointer-events-none absolute -top-6 left-0 rounded bg-black/60 px-1.5 py-0.5 font-mono text-[9px] text-brand-100">
                  {Math.round(box.w)}% × {Math.round(box.h)}%
                </span>
              </div>
            </div>
            <p className="mo-muted mt-3 text-center">拖动取景框或四角手柄，把四个定位块都框进去</p>
            <div className="mt-3 flex gap-2">
              <Btn variant="ghost" onClick={() => { setStep('pick'); setSrc('') }}>
                <IcX style={{ fontSize: 15 }} /> 重选
              </Btn>
              <Btn variant="ghost" onClick={rotate} disabled={rotating}>
                <IcRefresh style={{ fontSize: 15 }} /> {rotating ? '旋转中' : '旋转 90°'}
              </Btn>
              <Btn block onClick={cropAndUpload}>
                <IcSpark style={{ fontSize: 16 }} /> 开始识别
              </Btn>
            </div>
          </Card>
        </div>
      )}

      {step === 'scan' && (
        <Card className="!p-5">
          <div className="mx-auto grid h-24 w-24 place-items-center rounded-3xl bg-brand-50">
            <div className="mo-scan-orb" />
          </div>
          <p className="mt-4 text-center text-[13px] font-extrabold">正在识别答题卡…</p>
          <p className="mo-muted mt-1 text-center">{pct < 60 ? '上传图片' : '定位定位块并识别涂卡'}</p>
          <div className="mt-4">
            <Bar pct={pct} />
          </div>
          <p className="mo-num mt-2 text-center text-[11px] font-bold text-brand-700">{pct}%</p>
          <div className="mt-4 space-y-2">
            <Skeleton h={10} w="70%" />
            <Skeleton h={10} w="46%" />
          </div>
        </Card>
      )}

      {step === 'ready' && (
        <div className="mo-page space-y-3">
          {err && <ErrorBar text={err} onRetry={submitPages} />}
          <Card className="!p-4">
            <p className="text-[13px] font-extrabold">已上传 {pages.length} 页</p>
            <p className="mo-muted mt-1">
              {examId > 0 ? '按顺序对应答题卡第 1、2 页，提交后进入考试批改。' : '按顺序对应答题卡第 1、2 页。'}
            </p>
            <div className="mt-3 flex gap-2 overflow-x-auto">
              {pages.map((p, i) => (
                <div key={p.fileId} className="w-[74px] shrink-0 overflow-hidden rounded-xl border border-brand-100 bg-white">
                  <img src={p.preview} alt={`第 ${i + 1} 页`} className="h-[92px] w-full object-cover" />
                  <p className="py-1 text-center text-[10px] font-bold text-ink-soft">第 {i + 1} 页</p>
                </div>
              ))}
            </div>
          </Card>
          <div className="flex gap-2">
            <Btn variant="ghost" onClick={() => setStep('pick')}>继续拍一页</Btn>
            <Btn block disabled={submitting || !pages.length} onClick={() => void submitPages()}>
              {submitting ? '提交中…' : `提交识别（${pages.length} 页）`}
            </Btn>
          </div>
          <button
            type="button"
            className="w-full text-center text-[10.5px] font-bold text-ink-soft/55"
            onClick={() => { setPages([]); setStep('pick') }}
          >
            清空重拍
          </button>
        </div>
      )}

      {step === 'done' && result && (
        <div className="mo-page space-y-3">
          {err && <ErrorBar text={err} onRetry={cropAndUpload} />}
          <Card className="!p-4">
            <div className="flex items-center gap-4">
              <Ring value={result.successCount} max={result.total} size={78} label={`${result.successCount}/${result.total}`} sub="成功" />
              <div>
                <p className="text-[14px] font-extrabold">识别完成</p>
                <p className="mo-muted mt-1">成功 {result.successCount} · 失败 {result.failureCount}</p>
                <div className="mt-2 flex gap-1.5">
                  <span className="mo-badge" data-tone="ok">已写入文件库</span>
                  <span className="mo-badge">试卷 #{result.paperId}</span>
                </div>
              </div>
            </div>
          </Card>

          {result.results.map((item) => (
            <CheckCard key={item.fileId} item={item} />
          ))}

          {saved.length > 0 && (
            <Card className="!p-4">
              <p className="mo-eyebrow mb-2">导出与留存</p>
              <p className="mo-muted mb-3">结果已保存到本机历史，待后端恢复后可回看与导出。</p>
              <div className="grid grid-cols-3 gap-2">
                {EXPORT_FORMATS.map((f) => (
                  <Btn key={f.key} variant="ghost" onClick={() => downloadScans(saved, f.key)}>
                    <IcFile style={{ fontSize: 14 }} /> {f.label}
                  </Btn>
                ))}
              </div>
              <button
                type="button"
                className="mt-3 flex w-full items-center justify-center gap-1.5 text-[11px] font-extrabold text-brand-700"
                onClick={() => nav('/m/history')}
              >
                <IcClock style={{ fontSize: 13 }} /> 查看本机识别历史
              </button>
            </Card>
          )}

          <div className="flex gap-2">
            <Btn variant="ghost" onClick={() => { setStep('pick'); setSrc(''); setResult(null); setSaved([]); setPages([]) }}>
              再拍一张
            </Btn>
            <Btn block onClick={() => nav('/m/exams')}>
              去批改记录
            </Btn>
          </div>
        </div>
      )}

      <PaperPicker
        open={pickOpen}
        onClose={() => setPickOpen(false)}
        selected={paperId}
        onPick={(id, name) => {
          setPaperId(id)
          setPaperName(name)
        }}
      />
    </Page>
  )
}

const STEP_LABEL: Record<Step, string> = { pick: '选择图片', crop: '裁切取景', scan: '识别中', ready: '待提交', done: '识别结果' }

const CORNERS: Array<{ key: DragMode; style: React.CSSProperties; cursor: string }> = [
  { key: 'nw', style: { left: -12, top: -12 }, cursor: 'nwse-resize' },
  { key: 'ne', style: { right: -12, top: -12 }, cursor: 'nesw-resize' },
  { key: 'sw', style: { left: -12, bottom: -12 }, cursor: 'nesw-resize' },
  { key: 'se', style: { right: -12, bottom: -12 }, cursor: 'nwse-resize' },
]

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v))
}

/** 把一次 check 的每张成功图片存成本机记录 */
async function persistScans(check: CheckResponse, paperName: string): Promise<OfflineScan[]> {
  const out: OfflineScan[] = []
  for (const item of check.results) {
    if (!item.success) continue
    const scan = scanFromCheckItem(item, {
      paperId: check.paperId,
      paperName,
      title: `${paperName} · 文件 #${item.fileId}`,
    })
    scan.id = makeScanId()
    try {
      await saveScan(scan)
      out.push(scan)
    } catch {
      /* 单张保存失败不阻断识别结果展示 */
    }
  }
  return out
}

function CheckCard({ item }: { item: CheckItem }) {
  const [open, setOpen] = useState(true)
  if (!item.success) {
    return (
      <Card className="!p-4">
        <div className="flex items-start gap-3">
          <span className="grid h-9 w-9 flex-none place-items-center rounded-xl bg-[#ffe6d9] text-[#b5643a]">
            <IcAlert style={{ fontSize: 17 }} />
          </span>
          <div className="min-w-0">
            <p className="text-[13px] font-extrabold">文件 #{item.fileId} 识别失败</p>
            <p className="mo-muted mt-1">{item.code} · {item.error}</p>
          </div>
        </div>
      </Card>
    )
  }
  const metrics = Object.entries(item.metrics ?? {})
  return (
    <Card className="!p-4">
      <button type="button" className="flex w-full items-center gap-2" onClick={() => setOpen((v) => !v)}>
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-emerald-50 text-emerald-600">
          <IcCheck style={{ fontSize: 15 }} />
        </span>
        <span className="flex-1 text-left">
          <span className="block text-[13px] font-extrabold">文件 #{item.fileId}</span>
          <span className="mo-muted block">{item.image ? `${item.image.width}×${item.image.height}` : '已识别'}</span>
        </span>
        <span className="mo-badge" data-tone="ok">{metrics.length} 题</span>
      </button>
      <div className="mo-collapse" data-open={open}>
        <div>
          <div className="mt-3 space-y-2">
            {metrics.map(([qid, m]) => {
              const conf = Math.round((m.confidence ?? 0) * 100)
              return (
                <div key={qid} className="rounded-xl bg-brand-50/70 px-3 py-2">
                  <div className="flex items-center gap-2">
                    <span className="w-9 text-[10px] font-black text-brand-700">{qid}</span>
                    <span className="text-[12px] font-extrabold">{m.answer ?? '空'}</span>
                    {m.expected && <span className="text-[10px] text-ink-soft/60">答: {m.expected}</span>}
                    <span className="ml-auto flex gap-1">
                      {m.uncertain && <span className="mo-badge" data-tone="warn">存疑</span>}
                      <span className={`mo-badge ${m.correct ? '' : ''}`} data-tone={m.correct ? 'ok' : 'warn'}>
                        {m.correct ? '对' : '错'}
                      </span>
                    </span>
                  </div>
                  {typeof m.confidence === 'number' && (
                    <div className="mt-1.5 flex items-center gap-2">
                      <Bar pct={conf} />
                      <span className="mo-num w-8 text-right text-[9px] font-bold text-ink-soft/60">{conf}%</span>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </Card>
  )
}

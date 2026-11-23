import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { errorText } from '../api/client'
import { papersApi, type CheckItem, type CheckResponse } from '../m/api'
import { uploadFiles } from '../api/files'
import type { UploadedFile } from '../api/types'
import { useToast } from '../components/Toast'
import { CheckIcon, DownloadIcon, ImageIcon, UploadIcon } from '../components/icons'
import { Badge, Button, Card, Field, SectionTitle, Spinner, inputCls } from '../components/ui'
import { saveScan, type OfflineScan } from '../lib/offlineHistory'
import { scanFromCheckItem } from '../lib/scanRecord'
import { EXPORT_FORMATS, downloadScans } from '../lib/export'

export default function CheckPage() {
  const toast = useToast()
  const [params] = useSearchParams()

  const [examId, setExamId] = useState(params.get('examId') ?? '')
  const [examName, setExamName] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [pageMap, setPageMap] = useState<number[]>([])
  const [uploading, setUploading] = useState(false)
  const [uploaded, setUploaded] = useState<UploadedFile[]>([])
  const [checking, setChecking] = useState(false)
  const [result, setResult] = useState<CheckResponse | null>(null)
  const [saved, setSaved] = useState<OfflineScan[]>([])
  const [activeFile, setActiveFile] = useState<number | null>(null)


  useEffect(() => {
    const id = Number(examId)
    if (!Number.isFinite(id) || id <= 0) {
      setExamName('')
      return
    }
    let alive = true
    void (async () => {
      try {
        const p = await papersApi.get(id)
        if (alive) setExamName(p.name)
      } catch {
        if (alive) setExamName('')
      }
    })()
    return () => {
      alive = false
    }
  }, [examId])

  function addFiles(list: FileList | null) {
    if (!list) return
    const arr = Array.from(list).filter((f) => f.type.startsWith('image/'))
    const over = arr.filter((f) => f.size >= 10 * 1024 * 1024)
    if (over.length) toast(`${over.length} 个文件超过 10 MiB，已忽略`, 'err')
    const ok = arr.filter((f) => f.size < 10 * 1024 * 1024)
    setFiles((prev) => [...prev, ...ok].slice(0, 50))
    setPageMap((prev) => {
      const next = [...prev]
      ok.forEach((_, i) => next.push(Math.max(1, ...next, 0) + 1 + i))
      return next.slice(0, 50)
    })
    setUploaded([])
    setResult(null)
    setSaved([])
  }

  async function handleCheck() {
    const id = Number(examId)
    if (!Number.isFinite(id) || id <= 0) {
      toast('请填写正确的试卷 id', 'err')
      return
    }
    if (!files.length) {
      toast('请先选择答题卡图片', 'err')
      return
    }
    setChecking(true)
    setResult(null)
    try {
      let pool = uploaded
      if (!pool.length) {
        setUploading(true)
        pool = await uploadFiles(files, (done, total, cur) => {
          if (cur) setExamName((n) => n)
          void done
          void total
        })
        setUploaded(pool)
        setUploading(false)
      }
      const pageFiles = pool.slice(0, 50).map((u, i) => ({
        fileId: u.fileId,
        page: pageMap[i] ?? i + 1,
      }))
      const r = await papersApi.checkPages(id, pageFiles)
      setResult(r)
      setActiveFile(r.results[0]?.fileId ?? null)
      // 整份结果写入本机历史，便于回看与导出
      const scans: OfflineScan[] = []
      for (const item of r.results) {
        if (!item.success) continue
        const scan = scanFromCheckItem(item, {
          paperId: r.paperId,
          paperName: examName || `试卷 #${id}`,
          title: `${examName || `试卷 #${id}`} · 文件 #${item.fileId}`,
        })
        try {
          await saveScan(scan)
          scans.push(scan)
        } catch {
          /* 本机存储失败不影响识别结果 */
        }
      }
      setSaved(scans)
      toast(`检查完成：成功 ${r.successCount}，失败 ${r.failureCount}`, r.failureCount ? 'err' : 'ok')
    } catch (e) {
      setUploading(false)
      toast(errorText(e), 'err')
    } finally {
      setChecking(false)
    }
  }

  const current = result?.results.find((r) => r.fileId === activeFile) ?? null

  return (
    <div className="anim-page-in space-y-5">
      <header>
        <h1 className="text-xl font-black tracking-tight">答题卡检查</h1>
        <p className="mt-1 text-xs text-ink-soft">
          上传答题卡图片后，可逐张指定对应答题卡页码；多页会按 files: [page/fileId] 提交，后端分别使用每页的四角定位块和题区识别。
        </p>
      </header>

      <Card>
        <SectionTitle>选择试卷</SectionTitle>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="试卷 id" hint="在试卷管理页可查看">
            <div className="flex gap-2">
              <input
                className={inputCls}
                inputMode="numeric"
                value={examId}
                placeholder="在试卷管理页查看"
                onChange={(e) => setExamId(e.target.value.replace(/[^\d]/g, ''))}
              />
            </div>
          </Field>
          <Field label="试卷名">
            <div className={`${inputCls} flex items-center text-ink-soft`}>{examName || '—'}</div>
          </Field>
        </div>
      </Card>

      <Card>
        <SectionTitle extra={<Badge tone={files.length ? 'brand' : 'mute'}>{files.length} 张</Badge>}>
          答题卡图片
        </SectionTitle>
        <label className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-brand-300 bg-brand-50/60 px-4 py-10 text-center transition hover:bg-brand-100/60">
          <input
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => addFiles(e.target.files)}
          />
          <UploadIcon className="mb-2 h-8 w-8 text-brand-500" />
          <p className="text-sm font-semibold text-ink">点击选择图片</p>
          <p className="mt-1 text-[11px] text-ink-soft/60">单张 &lt; 10 MiB，最多 50 张；每张可指定第几页</p>
        </label>

        {files.length > 0 && (
          <div className="mt-3 space-y-1.5">
            {files.map((f, i) => (
              <div key={i} className="flex items-center gap-2 rounded-xl border border-brand-200/70 px-3 py-2 text-xs">
                <ImageIcon className="h-4 w-4 shrink-0 text-brand-400" />
                <span className="min-w-0 flex-1 truncate text-ink">{f.name}</span>
                <label className="flex shrink-0 items-center gap-1 text-[10px] font-bold text-ink-soft/60">
                  第
                  <input
                    type="number"
                    min={1}
                    value={pageMap[i] ?? i + 1}
                    onChange={(e) => {
                      const page = Math.max(1, Number(e.target.value) || 1)
                      setPageMap((xs) => xs.map((v, j) => (j === i ? page : v)))
                    }}
                    className="w-12 rounded-md border border-brand-200 px-1 py-0.5 text-center text-[11px] outline-none"
                  />
                  页
                </label>
                <span className="shrink-0 text-[10px] text-ink-soft/50">{(f.size / 1024).toFixed(0)} KB</span>
                <button
                  type="button"
                  onClick={() => {
                    setFiles((xs) => xs.filter((_, j) => j !== i))
                    setPageMap((xs) => xs.filter((_, j) => j !== i))
                    setUploaded([])
                  }}
                  className="shrink-0 rounded-lg px-1.5 text-ink-soft/40 hover:text-red-500"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="mt-4 flex items-center gap-3">
          <Button onClick={handleCheck} disabled={checking || !files.length}>
            {checking ? <Spinner /> : <CheckIcon className="h-4 w-4" />}
            {uploading ? '上传中…' : checking ? '检查中…' : '开始检查'}
          </Button>
          {uploaded.length > 0 && (
            <span className="text-[11px] text-ink-soft/60">
              已上传 {uploaded.length} 个文件（fileId: {uploaded.map((u) => u.fileId).join(', ')}）
            </span>
          )}
        </div>
      </Card>

      {result && (
        <div className="anim-fade-up space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <StatCard label="总数" value={result.total} tone="mute" />
            <StatCard label="成功" value={result.successCount} tone="ok" />
            <StatCard label="失败" value={result.failureCount} tone={result.failureCount ? 'err' : 'mute'} />
          </div>

          {saved.length > 0 && (
            <Card>
              <SectionTitle extra={<Badge tone="ok">已存 {saved.length} 条</Badge>}>本机识别记录</SectionTitle>
              <p className="mb-3 text-[11.5px] leading-relaxed text-ink-soft/70">
                识别结果已整份保存到本机（IndexedDB），待后端恢复后可回看每道题的答案与置信度。
              </p>
              <div className="flex flex-wrap items-center gap-2">
                {EXPORT_FORMATS.map((f) => (
                  <Button key={f.key} variant="ghost" size="sm" onClick={() => downloadScans(saved, f.key)}>
                    <DownloadIcon className="h-3.5 w-3.5" />
                    导出{f.label}
                  </Button>
                ))}
                <Link to="/check/history" className="text-[11.5px] font-bold text-brand-700 hover:underline">
                  查看全部识别记录 →
                </Link>
              </div>
            </Card>
          )}

          <div className="grid gap-4 lg:grid-cols-[240px_minmax(0,1fr)]">
            <Card className="p-3">
              <p className="mb-2 px-1 text-[11px] font-semibold text-ink-soft">文件结果</p>
              <div className="space-y-1">
                {result.results.map((r) => (
                  <button
                    key={r.fileId}
                    type="button"
                    onClick={() => setActiveFile(r.fileId)}
                    className={`flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left text-xs transition ${
                      activeFile === r.fileId ? 'bg-brand-100 text-brand-800' : 'text-ink-soft hover:bg-brand-50'
                    }`}
                  >
                    <span className="font-mono text-[10px]">#{r.fileId}</span>
                    <span className="flex-1">{r.success ? '成功' : '失败'}</span>
                    <Badge tone={r.success ? 'ok' : 'err'}>{r.success ? 'OK' : 'ERR'}</Badge>
                  </button>
                ))}
              </div>
            </Card>

            {current && <FileDetail r={current} />}
          </div>
        </div>
      )}
    </div>
  )
}

function StatCard({ label, value, tone }: { label: string; value: number; tone: 'ok' | 'err' | 'mute' }) {
  const color = tone === 'ok' ? 'text-emerald-600' : tone === 'err' ? 'text-red-500' : 'text-ink'
  return (
    <Card className="py-4 text-center">
      <p className={`text-2xl font-black ${color}`}>{value}</p>
      <p className="mt-0.5 text-[11px] text-ink-soft/60">{label}</p>
    </Card>
  )
}

function FileDetail({ r }: { r: CheckItem }) {
  if (!r.success) {
    return (
      <Card className="border-red-200 bg-red-50/50">
        <SectionTitle>文件 #{r.fileId} 识别失败</SectionTitle>
        <p className="text-xs text-red-600">{r.error ?? '未知错误'}</p>
        {r.code && <p className="mt-1 font-mono text-[10px] text-red-400">{r.code}</p>}
      </Card>
    )
  }

  const metricEntries = Object.entries(r.metrics ?? {})
  const right = metricEntries.filter(([, m]) => m.correct === true).length
  const wrong = metricEntries.filter(([, m]) => m.correct === false).length
  const unsure = metricEntries.filter(([, m]) => m.uncertain).length

  return (
    <Card>
      <SectionTitle
        extra={
          <div className="flex gap-1.5">
            <Badge tone="ok">对 {right}</Badge>
            <Badge tone="err">错 {wrong}</Badge>
            <Badge tone="warn">存疑 {unsure}</Badge>
          </div>
        }
      >
        文件 #{r.fileId} 结果
      </SectionTitle>

      <div className="max-h-[420px] space-y-1.5 overflow-y-auto pr-1">
        {metricEntries.map(([qid, m]) => (
          <div
            key={qid}
            className={`flex items-center gap-2 rounded-xl border px-2.5 py-1.5 text-xs ${
              m.correct === true
                ? 'border-emerald-200 bg-emerald-50/60'
                : m.correct === false
                  ? 'border-red-200 bg-red-50/60'
                  : 'border-brand-200/70'
            }`}
          >
            <span className="w-14 shrink-0 truncate font-mono text-[10px] text-ink-soft/70">{qid}</span>
            <Badge tone={m.type === 'mark' ? 'brand' : 'mute'}>{m.type === 'mark' ? (m as { mode?: string }).mode ?? 'mark' : '主观'}</Badge>
            <span className="font-semibold text-ink">{m.answer ?? '—'}</span>
            {m.expected && m.expected !== m.answer && (
              <span className="text-[10px] text-ink-soft/50">应为 {m.expected}</span>
            )}
            {m.confidence !== undefined && (
              <span className="ml-auto text-[10px] text-ink-soft/45">{(m.confidence * 100).toFixed(0)}%</span>
            )}
            {m.uncertain && <Badge tone="warn">存疑</Badge>}
          </div>
        ))}
        {metricEntries.length === 0 && <p className="py-6 text-center text-[11px] text-ink-soft/50">无识别明细</p>}
      </div>
    </Card>
  )
}

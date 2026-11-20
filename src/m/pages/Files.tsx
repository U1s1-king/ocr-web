import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useToast } from '../../components/Toast'
import { examsApi, filesApi, type ExamSummary, type FileItem } from '../api'
import { IcAlert, IcCalendar, IcCheck, IcFile, IcImage, IcSearch, IcUpload, IcX } from '../icons'
import {
  Bar,
  Btn,
  Card,
  Chip,
  DemoTag,
  Empty,
  ErrorBar,
  ListSkeleton,
  Page,
  Row,
  Sheet,
  fmtTime,
  useLoad,
} from '../ui'

const SUFFIXES = ['全部', 'jpg', 'png', 'pdf'] as const

export default function Files() {
  const nav = useNavigate()
  const toast = useToast()
  const inputRef = useRef<HTMLInputElement>(null)

  const [q, setQ] = useState('')
  const [suffix, setSuffix] = useState<(typeof SUFFIXES)[number]>('全部')
  const [picked, setPicked] = useState<number[]>([])
  const [uploading, setUploading] = useState<{ name: string; pct: number } | null>(null)
  const [gradeOpen, setGradeOpen] = useState(false)
  const [extra, setExtra] = useState<FileItem[]>([])
  const [moreLoading, setMoreLoading] = useState(false)
  const [noMore, setNoMore] = useState(false)
  const [grading, setGrading] = useState(false)

  const files = useLoad(
    () =>
      filesApi.search({
        q: q || undefined,
        suffix: suffix === '全部' ? undefined : suffix,
        limit: 50,
      }),
    {
      query: '',
      suffix: '',
      total: 0,
      limit: 50,
      offset: 0,
      items: [],
    },
    [q, suffix],
  )

  const exams = useLoad<ExamSummary[]>(() => examsApi.list(), [] as ExamSummary[], [], 'exams.list')

  const all = useMemo(() => [...files.data.items, ...extra], [files.data.items, extra])

  const items = useMemo(() => {
    const list = all.filter((f) => !q || f.name.includes(q))
    return suffix === '全部' ? list : list.filter((f) => f.suffix === suffix)
  }, [all, q, suffix])

  useEffect(() => {
    setExtra([])
    setNoMore(false)
  }, [q, suffix])

  async function loadMore() {
    if (moreLoading || noMore) return
    setMoreLoading(true)
    try {
      const r = await filesApi.search({
        q: q || undefined,
        suffix: suffix === '全部' ? undefined : suffix,
        limit: 50,
        offset: all.length,
      })
      const fresh = r.items.filter((x) => !all.some((y) => y.fileId === x.fileId))
      setExtra((prev) => [...prev, ...fresh])
      if (r.items.length < 50) setNoMore(true)
    } catch (err) {
      toast(err instanceof Error ? err.message : '加载更多失败', 'err')
      setNoMore(true)
    } finally {
      setMoreLoading(false)
    }
  }

  async function onFiles(list: FileList | null) {
    if (!list || list.length === 0) return
    const arr = Array.from(list)
    for (const f of arr) {
      setUploading({ name: f.name, pct: 0 })
      try {
        await filesApi.upload(f, (pct) => setUploading({ name: f.name, pct }))
        toast(`${f.name} 上传成功`, 'ok')
      } catch (err) {
        toast(err instanceof Error ? err.message : `${f.name} 上传失败`, 'err')
      }
    }
    setUploading(null)
    files.reload()
    if (inputRef.current) inputRef.current.value = ''
  }

  function toggle(id: number) {
    setPicked((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  async function grade(examId: number, examName: string) {
    setGrading(true)
    try {
      const res = await examsApi.grade(examId, picked)
      toast(`已批改 ${res.successCount}/${res.total} · ${examName}`, res.failureCount ? 'err' : 'ok')
      setGradeOpen(false)
      setPicked([])
      if (res.results[0]?.resultId) nav(`/m/results/${res.results[0].resultId}`)
    } catch (err) {
      toast(err instanceof Error ? err.message : '批改失败', 'err')
    } finally {
      setGrading(false)
    }
  }

  return (
    <Page
      title="文件库"
      sub="FILES"
      back
      actions={
        <div className="flex gap-2">
          {files.demo && <DemoTag />}
          <button type="button" className="mo-icon-btn" aria-label="上传" onClick={() => inputRef.current?.click()}>
            <IcUpload style={{ fontSize: 17 }} />
          </button>
        </div>
      }
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/*,.pdf"
        multiple
        className="hidden"
        onChange={(e) => void onFiles(e.target.files)}
      />

      <div className="relative">
        <IcSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-brand-400" style={{ fontSize: 16 }} />
        <input
          className="mo-input pl-10"
          placeholder="搜索文件名"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      <div className="mo-scroll-x mt-3 flex gap-1.5 overflow-x-auto pb-1">
        {SUFFIXES.map((s) => (
          <Chip key={s} active={suffix === s} onClick={() => setSuffix(s)}>
            {s === '全部' ? '全部' : s.toUpperCase()}
          </Chip>
        ))}
      </div>

      <button
        type="button"
        className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-brand-300 bg-brand-50/70 py-4 text-[12px] font-extrabold text-brand-700 active:scale-[.995]"
        onClick={() => inputRef.current?.click()}
      >
        <IcImage style={{ fontSize: 18 }} /> 拍照 / 选择图片上传
      </button>

      {uploading && (
        <Card className="mo-pop mt-3 !py-3">
          <div className="flex items-center gap-2">
            <IcUpload style={{ fontSize: 14 }} className="text-brand-600" />
            <span className="min-w-0 flex-1 truncate text-[11.5px] font-extrabold">{uploading.name}</span>
            <span className="text-[11px] font-black text-brand-800">{uploading.pct}%</span>
          </div>
          <div className="mt-2">
            <Bar pct={uploading.pct} />
          </div>
        </Card>
      )}

      {files.error && (
        <div className="mt-3">
          <ErrorBar text={files.error} onRetry={files.reload} />
        </div>
      )}

      <div className="mt-3 flex items-center gap-2">
        <p className="mo-eyebrow">共 {items.length} 个文件</p>
        {picked.length > 0 && (
          <span className="mo-badge ml-auto" data-tone="ok">
            已选 {picked.length}
          </span>
        )}
      </div>

      <div className="mt-2">
        {files.loading ? (
          <ListSkeleton rows={5} />
        ) : items.length === 0 ? (
          <Empty
            icon={<IcFile style={{ fontSize: 24 }} />}
            title="没有文件"
            tip="上传答题卡照片后，就能在考试里批改"
            action={
              <Btn onClick={() => inputRef.current?.click()}>
                <IcUpload style={{ fontSize: 16 }} /> 上传第一张
              </Btn>
            }
          />
        ) : (
          <div className="mo-rows">
            {items.map((f: FileItem) => {
              const on = picked.includes(f.fileId)
              return (
                <Row
                  key={f.fileId}
                  icon={<IcFile style={{ fontSize: 17 }} />}
                  title={f.name}
                  sub={`#${f.fileId} · ${f.suffix.toUpperCase()} · ${fmtTime(f.uTime)}`}
                  right={
                    <span
                      className="grid h-6 w-6 place-items-center rounded-full"
                      style={on ? { background: 'var(--mo-accent)', color: '#fff' } : { background: '#f2f4f7', color: '#9aa0aa' }}
                    >
                      {on ? <IcCheck style={{ fontSize: 13 }} /> : <span className="h-1.5 w-1.5 rounded-full bg-current" />}
                    </span>
                  }
                  onClick={() => toggle(f.fileId)}
                />
              )
            })}
          </div>
        )}
        {!files.loading && items.length > 0 && !noMore && (
          <button
            type="button"
            onClick={() => void loadMore()}
            disabled={moreLoading}
            className="mt-3 w-full rounded-2xl border border-brand-200 bg-white py-3 text-[12px] font-extrabold text-brand-700 disabled:opacity-50"
          >
            {moreLoading ? '正在加载…' : '加载更多'}
          </button>
        )}
      </div>

      {/* 底部选择操作条 */}
      {picked.length > 0 && (
        <div className="fixed inset-x-0 bottom-[calc(96px+var(--mo-safe))] z-30 mx-auto flex max-w-[560px] items-center gap-2 px-4">
          <div className="mo-pop flex w-full items-center gap-2 rounded-2xl border border-brand-200 bg-white/95 p-2.5 shadow-lift backdrop-blur">
            <span className="pl-1 text-[11.5px] font-extrabold text-brand-800">已选 {picked.length}</span>
            <Btn sm variant="ghost" onClick={() => setPicked([])}>
              <IcX style={{ fontSize: 13 }} /> 清空
            </Btn>
            <Btn sm onClick={() => setGradeOpen(true)}>
              开始批改
            </Btn>
          </div>
        </div>
      )}

      <Sheet open={gradeOpen} onClose={() => setGradeOpen(false)} title="批改到哪场考试">
        {exams.error && <ErrorBar text={exams.error} onRetry={exams.reload} />}
        <div className="mo-rows">
          {exams.data.map((e) => (
            <Row
              key={e.id}
              icon={<IcCalendar style={{ fontSize: 16 }} />}
              title={e.name}
              sub={`${e.paperName} · ${e.resultCount} 份成绩`}
              right={<IcCheck style={{ fontSize: 14 }} className="text-brand-400" />}
              onClick={() => {
                if (!grading) void grade(e.id, e.name)
              }}
            />
          ))}
        </div>
        <p className="mo-muted mt-3 flex items-center gap-1.5">
          <IcAlert style={{ fontSize: 12 }} /> 批改会用试卷的标准答案比对，文件不会被删除
        </p>
      </Sheet>
    </Page>
  )
}

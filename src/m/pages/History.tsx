import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { IcAlert, IcCheck, IcClock, IcFile, IcRight, IcSearch, IcTrash, IcX } from '../icons'
import { Btn, Card, Page, Segmented, useCountUp } from '../ui'
import {
  clearScans,
  computeStats,
  deleteScan,
  formatScanTime,
  listScans,
  type OfflineScan,
} from '../../lib/offlineHistory'
import { EXPORT_FORMATS, downloadScan } from '../../lib/export'
import { useToast } from '../../components/Toast'
import { confirmAction } from '../confirm'

type Filter = 'all' | 'today' | 'issue'

const FILTERS: Array<{ key: Filter; label: string }> = [
  { key: 'all', label: '全部' },
  { key: 'today', label: '今天' },
  { key: 'issue', label: '有错题/存疑' },
]

export default function History() {
  const nav = useNavigate()
  const toast = useToast()
  const [rows, setRows] = useState<OfflineScan[]>([])
  const [loading, setLoading] = useState(true)
  const [keyword, setKeyword] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [openId, setOpenId] = useState<string | null>(null)

  const load = () => {
    setLoading(true)
    listScans()
      .then(setRows)
      .catch(() => setRows([]))
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

  const stats = useMemo(() => computeStats(rows), [rows])

  const filtered = useMemo(() => {
    const kw = keyword.trim().toLowerCase()
    return rows.filter((r) => {
      if (filter === 'today') {
        const d = new Date(r.at)
        const now = new Date()
        if (d.toDateString() !== now.toDateString()) return false
      }
      if (filter === 'issue' && r.wrong === 0 && r.uncertain === 0) return false
      if (!kw) return true
      const hay = [
        r.title,
        r.paperName ?? '',
        r.candidateNumber ?? '',
        String(r.score ?? ''),
        ...r.questions.map((q) => `${q.id}:${q.answer ?? ''}`),
      ]
        .join(' ')
        .toLowerCase()
      return hay.includes(kw)
    })
  }, [rows, keyword, filter])

  async function remove(scan: OfflineScan) {
    if (!(await confirmAction('删除本机记录', `删除「${scan.title}」？此操作不可恢复。`))) return
    await deleteScan(scan.id)
    setRows((list) => list.filter((r) => r.id !== scan.id))
    toast('已删除本机记录', 'ok')
  }

  async function clearAll() {
    if (!(await confirmAction('清空本机记录', `清空全部 ${rows.length} 条本机识别记录？此操作不可恢复。`))) return
    await clearScans()
    setRows([])
    toast('已清空本机记录', 'ok')
  }

  return (
    <Page
      title="本机识别历史"
      sub="本机保存 · 待后端恢复后可查可导出"
      actions={
        rows.length > 0 ? (
          <button type="button" className="mo-icon-btn" aria-label="清空" onClick={clearAll}>
            <IcTrash style={{ fontSize: 16 }} />
          </button>
        ) : undefined
      }
    >
      <div className="mb-3 grid grid-cols-3 gap-2">
        <MiniStat num={stats.records} label="记录" />
        <MiniStat num={stats.answers} label="题目" />
        <MiniStat num={stats.uncertain} label="存疑" tone="warn" />
      </div>

      <Card className="!p-3">
        <div className="flex items-center gap-2">
          <span className="mo-list-ico">
            <IcSearch style={{ fontSize: 14 }} />
          </span>
          <input
            className="mo-input flex-1"
            value={keyword}
            placeholder="搜索标题 / 试卷 / 答案（如 3:C）"
            onChange={(e) => setKeyword(e.target.value)}
          />
          {keyword && (
            <button type="button" className="mo-icon-btn" aria-label="清空搜索" onClick={() => setKeyword('')}>
              <IcX style={{ fontSize: 14 }} />
            </button>
          )}
        </div>
        <div className="mt-3">
          <Segmented
            value={filter}
            items={FILTERS.map((f) => ({ value: f.key, label: f.label }))}
            onChange={setFilter}
          />
        </div>
      </Card>

      {loading ? (
        <p className="mo-muted py-10 text-center">正在读取本机记录…</p>
      ) : filtered.length === 0 ? (
        <div className="mo-empty mt-6">
          <div className="mo-empty-ico">
            <IcClock style={{ fontSize: 24 }} />
          </div>
          <p className="text-[13px] font-extrabold">{rows.length ? '没有匹配的记录' : '还没有本机记录'}</p>
          <p className="mo-muted mx-auto mt-1.5 max-w-[240px]">
            {rows.length ? '换个关键词或筛选条件试试' : '去拍照识别一次，结果会自动留在本机'}
          </p>
          {rows.length === 0 && (
            <div className="mt-4">
              <Btn onClick={() => nav('/m/capture')}>去拍照识别</Btn>
            </div>
          )}
        </div>
      ) : (
        <div className="mt-3 space-y-2.5">
          {filtered.map((scan, i) => {
            const open = openId === scan.id
            const state = scan.wrong > 0 ? 'bad' : scan.uncertain > 0 ? 'warn' : 'ok'
            return (
              <Card key={scan.id} delay={i} className="!p-3.5">
                <button
                  type="button"
                  className="flex w-full items-start gap-2.5 text-left"
                  onClick={() => setOpenId(open ? null : scan.id)}
                >
                  <span
                    className="grid h-9 w-9 flex-none place-items-center rounded-xl"
                    style={
                      state === 'bad'
                        ? { background: '#fff1f1', color: '#d94a4a' }
                        : state === 'warn'
                          ? { background: '#fff5e2', color: '#9a6413' }
                          : { background: '#e8f8f1', color: '#1a7a55' }
                    }
                  >
                    {state === 'ok' ? <IcCheck style={{ fontSize: 16 }} /> : <IcAlert style={{ fontSize: 16 }} />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[12.5px] font-extrabold">{scan.title}</span>
                    <span className="mo-muted block">
                      {formatScanTime(scan.at)} · {scan.total} 题
                      {scan.score !== undefined ? ` · ${scan.score}${scan.maxScore ? `/${scan.maxScore}` : ''} 分` : ''}
                    </span>
                    <span className="mt-1.5 flex flex-wrap gap-1">
                      <span className="mo-badge" data-tone="ok">对 {scan.ok}</span>
                      <span className="mo-badge" data-tone={scan.wrong ? 'err' : undefined}>错 {scan.wrong}</span>
                      <span className="mo-badge" data-tone={scan.uncertain ? 'warn' : undefined}>存疑 {scan.uncertain}</span>
                      {scan.candidateNumber && <span className="mo-badge">考号 {scan.candidateNumber}</span>}
                    </span>
                  </span>
                  <IcRight
                    style={{ fontSize: 15 }}
                    className={`mo-muted mt-1 flex-none transition-transform ${open ? 'rotate-90' : ''}`}
                  />
                </button>

                <div className="mo-collapse" data-open={open}>
                  <div>
                    <div className="mt-3 grid grid-cols-4 gap-1.5">
                      {scan.questions.map((q) => (
                        <div
                          key={q.id}
                          className="rounded-lg px-1.5 py-1.5 text-center"
                          style={
                            q.correct === true
                              ? { background: '#f2fdf8', color: '#1a7a55' }
                              : q.correct === false
                                ? { background: '#fff6f8', color: '#d94a4a' }
                                : { background: '#fffaf0', color: '#9a6413' }
                          }
                        >
                          <p className="text-[9px] font-bold opacity-70">{q.id}</p>
                          <p className="text-[12px] font-black">{q.answer ?? '空'}</p>
                          <p className="text-[8.5px] opacity-70">{q.expected ? `标准 ${q.expected}` : '—'}</p>
                        </div>
                      ))}
                      {scan.questions.length === 0 && <p className="mo-muted col-span-4 py-2 text-center">没有题目明细</p>}
                    </div>

                    <div className="mt-3 grid grid-cols-3 gap-1.5">
                      {EXPORT_FORMATS.map((f) => (
                        <button
                          key={f.key}
                          type="button"
                          className="mo-btn mo-btn-ghost mo-btn-sm"
                          onClick={() => {
                            downloadScan(scan, f.key)
                            toast(`已导出 ${f.label}`, 'ok')
                          }}
                        >
                          <IcFile style={{ fontSize: 13 }} /> {f.label}
                        </button>
                      ))}
                    </div>
                    <button
                      type="button"
                      className="mt-2 flex w-full items-center justify-center gap-1 text-[10.5px] font-bold text-ink-soft/60"
                      onClick={() => remove(scan)}
                    >
                      <IcTrash style={{ fontSize: 12 }} /> 删除这条本机记录
                    </button>
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      )}
    </Page>
  )
}

function MiniStat({ num, label, tone = 'ok' }: { num: number; label: string; tone?: 'ok' | 'warn' }) {
  const value = useCountUp(num)
  return (
    <div className="mo-card !px-2 !py-2.5 text-center">
      <p className="mo-num text-[19px] font-black leading-none" style={{ color: tone === 'warn' ? '#9a6413' : '#7a2f3a' }}>
        {Math.round(value)}
      </p>
      <p className="mt-1 text-[9.5px] font-bold text-ink-soft/70">{label}</p>
    </div>
  )
}

import { Fragment, useEffect, useMemo, useState } from 'react'
import { PageHeader, StatTile } from '../components/PageHeader'
import { Badge, Button, Card, Empty, inputCls } from '../components/ui'
import { AlertIcon, CheckCircleIcon, DownloadIcon, TrashIcon } from '../components/icons'
import {
  clearScans,
  deleteScan,
  formatScanTime,
  listScans,
  type OfflineScan,
} from '../lib/offlineHistory'
import { EXPORT_FORMATS, downloadScan, downloadScans } from '../lib/export'

type Filter = 'all' | 'today' | 'issue'

const FILTERS: Array<{ key: Filter; label: string }> = [
  { key: 'all', label: '全部' },
  { key: 'today', label: '今天' },
  { key: 'issue', label: '有错题/存疑' },
]

export default function CheckHistoryPage() {
  const [rows, setRows] = useState<OfflineScan[]>([])
  const [loading, setLoading] = useState(true)
  const [keyword, setKeyword] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [openId, setOpenId] = useState<string | null>(null)

  function load() {
    setLoading(true)
    listScans()
      .then(setRows)
      .catch(() => setRows([]))
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

  const filtered = useMemo(() => {
    const kw = keyword.trim().toLowerCase()
    return rows.filter((r) => {
      if (filter === 'today') {
        if (new Date(r.at).toDateString() !== new Date().toDateString()) return false
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

  const sum = useMemo(
    () => ({
      answers: rows.reduce((s, r) => s + r.total, 0),
      issue: rows.filter((r) => r.wrong > 0 || r.uncertain > 0).length,
      uncertain: rows.reduce((s, r) => s + r.uncertain, 0),
    }),
    [rows],
  )

  async function remove(scan: OfflineScan) {
    if (!window.confirm(`删除「${scan.title}」？`)) return
    await deleteScan(scan.id)
    setRows((list) => list.filter((r) => r.id !== scan.id))
  }

  async function clearAll() {
    if (!window.confirm(`清空全部 ${rows.length} 条本机识别记录？`)) return
    await clearScans()
    setRows([])
  }

  return (
    <div>
      <PageHeader
        title="识别记录"
        desc="识别结果整份保存在本机浏览器（IndexedDB），待后端恢复后可回看、搜索、导出；服务端成绩不受影响。"
        crumb={[{ label: '答题卡检查', to: '/check' }, { label: '识别记录' }]}
        extra={
          <>
            <Button variant="ghost" size="sm" onClick={() => downloadScans(filtered, 'txt')} disabled={filtered.length === 0}>
              <DownloadIcon className="h-3.5 w-3.5" />
              导出当前 {filtered.length} 条
            </Button>
            {rows.length > 0 && (
              <Button variant="ghost" size="sm" onClick={clearAll}>
                <TrashIcon className="h-3.5 w-3.5" />
                清空
              </Button>
            )}
          </>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="识别记录" value={rows.length} delay={0} />
        <StatTile label="题目总数" value={sum.answers} delay={60} />
        <StatTile label="有错题" value={sum.issue} tone="warn" delay={120} />
        <StatTile label="存疑题" value={sum.uncertain} tone="err" delay={180} />
      </div>

      <Card className="mb-4">
        <div className="flex flex-wrap items-center gap-2">
          <input
            className={`${inputCls} max-w-xs`}
            placeholder="搜索标题 / 试卷 / 答案，如 3:C"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
          />
          <div className="flex items-center gap-1 rounded-xl bg-brand-50 p-1">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                type="button"
                onClick={() => setFilter(f.key)}
                className={`rounded-lg px-3 py-1.5 text-[11.5px] font-bold transition ${
                  filter === f.key ? 'bg-white text-brand-800 shadow-sm' : 'text-ink-soft/70 hover:text-ink'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
          <span className="text-[11px] font-semibold text-ink-soft/60">共 {filtered.length} 条</span>
        </div>
      </Card>

      {loading ? (
        <Card>
          <p className="py-8 text-center text-[12px] font-semibold text-ink-soft/60">正在读取本机记录…</p>
        </Card>
      ) : filtered.length === 0 ? (
        <Empty
          title={rows.length ? '没有匹配的记录' : '还没有本机识别记录'}
          hint={rows.length ? '换个关键词或筛选条件试试' : '到「上传批改」识别一次，结果会自动留在本机。'}
        />
      ) : (
        <Card className="overflow-hidden p-0">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-brand-100 bg-brand-50/60 text-left text-[11px] text-ink-soft/70">
                <th className="px-4 py-2.5 font-semibold">时间</th>
                <th className="px-4 py-2.5 font-semibold">记录</th>
                <th className="px-4 py-2.5 text-right font-semibold">题数</th>
                <th className="px-4 py-2.5 text-right font-semibold">对 / 错</th>
                <th className="px-4 py-2.5 text-right font-semibold">存疑</th>
                <th className="px-4 py-2.5 text-right font-semibold">状态</th>
                <th className="w-10" />
              </tr>
            </thead>
            <tbody className="stagger">
              {filtered.map((r, i) => {
                const open = openId === r.id
                const tone = r.wrong > 0 ? 'err' : r.uncertain > 0 ? 'warn' : 'ok'
                return (
                  <Fragment key={r.id}>
                    <tr
                      className={`group cursor-pointer border-b border-brand-100/60 transition hover:bg-brand-50/60 ${
                        open ? 'bg-brand-50/70' : ''
                      }`}
                      onClick={() => setOpenId(open ? null : r.id)}
                    >
                      <td className="px-4 py-2.5 whitespace-nowrap tabnum text-ink-soft">{formatScanTime(r.at)}</td>
                      <td className="max-w-[280px] px-4 py-2.5">
                        <p className="truncate font-semibold text-ink">{r.title}</p>
                        <p className="truncate text-[10px] text-ink-soft/60">
                          {r.paperName ?? '—'}
                          {r.score !== undefined ? ` · ${r.score}${r.maxScore ? `/${r.maxScore}` : ''} 分` : ''}
                          {` · 第 ${i + 1} 条`}
                        </p>
                      </td>
                      <td className="px-4 py-2.5 text-right tabnum">{r.total}</td>
                      <td className="px-4 py-2.5 text-right tabnum">
                        <span className="text-emerald-700">{r.ok}</span> /{' '}
                        <span className={r.wrong ? 'text-red-600' : 'text-ink-soft/40'}>{r.wrong}</span>
                      </td>
                      <td className={`px-4 py-2.5 text-right tabnum ${r.uncertain ? 'text-amber-700' : 'text-ink-soft/40'}`}>
                        {r.uncertain}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <Badge tone={tone}>
                          {tone === 'ok' ? '全对' : tone === 'warn' ? '有存疑' : '有错题'}
                        </Badge>
                      </td>
                      <td className="pr-3 text-ink-soft/40">
                        {tone === 'ok' ? <CheckCircleIcon className="h-4 w-4" /> : <AlertIcon className="h-4 w-4" />}
                      </td>
                    </tr>
                    {open && (
                      <tr key={`${r.id}-detail`} className="border-b border-brand-100/60 bg-brand-50/30">
                        <td colSpan={7} className="px-4 py-3">
                          <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-6 lg:grid-cols-8">
                            {r.questions.map((q) => (
                              <div
                                key={q.id}
                                className="rounded-lg border px-2 py-1.5 text-center"
                                style={
                                  q.correct === true
                                    ? { background: '#f2fdf8', borderColor: '#bde8d4', color: '#1a7a55' }
                                    : q.correct === false
                                      ? { background: '#fff6f8', borderColor: '#f5c6c6', color: '#d94a4a' }
                                      : { background: '#fffaf0', borderColor: '#f0dcb0', color: '#9a6413' }
                                }
                              >
                                <p className="text-[9.5px] font-bold opacity-70">{q.id}</p>
                                <p className="text-[12.5px] font-black">{q.answer ?? '空'}</p>
                                <p className="text-[9px] opacity-70">{q.expected ? `标准 ${q.expected}` : '—'}</p>
                              </div>
                            ))}
                            {r.questions.length === 0 && (
                              <p className="col-span-full py-2 text-center text-[11px] text-ink-soft/50">
                                这条记录没有保存题目明细
                              </p>
                            )}
                          </div>
                          <div className="mt-3 flex flex-wrap items-center gap-2">
                            <span className="text-[10.5px] font-semibold text-ink-soft/60">导出：</span>
                            {EXPORT_FORMATS.map((f) => (
                              <Button key={f.key} variant="ghost" size="sm" onClick={() => downloadScan(r, f.key)}>
                                <DownloadIcon className="h-3.5 w-3.5" />
                                {f.label}
                              </Button>
                            ))}
                            <Button
                              variant="ghost"
                              size="sm"
                              className="ml-auto text-red-500"
                              onClick={() => remove(r)}
                            >
                              <TrashIcon className="h-3.5 w-3.5" />
                              删除
                            </Button>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  )
}

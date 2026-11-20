import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { PageHeader } from '../components/PageHeader'
import { AlertIcon, BoltIcon, CheckCircleIcon, ClockIcon, FileStackIcon } from '../components/icons'
import { Badge, Button, Card, Field, SectionTitle, Spinner, inputCls } from '../components/ui'
import { ERROR_TEXT, errorText, getApiBase, getApiToken } from '../api/client'
import { examsApi, filesApi, logsApi, papersApi, type ApiLogItem, type CheckResponse, type PaperSummary } from '../m/api'
import {
  clearLocalLogs,
  localLogStats,
  subscribeLocalLogs,
  type LocalRequestLog,
} from '../lib/requestLog'
import { prepareImage } from '../lib/image'
import { saveScan } from '../lib/offlineHistory'
import { scanFromCheckItem } from '../lib/scanRecord'
import { useToast } from '../components/Toast'

interface ProbeState {
  ok: boolean
  message: string
  durationMs: number
  papers?: number
  exams?: number
}

interface TestState {
  running: boolean
  message: string
  detail?: string
  raw?: string
  ok?: boolean
}

export default function DiagnosticsPage() {
  const toast = useToast()
  const [logs, setLogs] = useState<LocalRequestLog[]>([])
  const [probe, setProbe] = useState<ProbeState | null>(null)
  const [probing, setProbing] = useState(false)
  const [papers, setPapers] = useState<PaperSummary[]>([])
  const [paperId, setPaperId] = useState('')
  const [test, setTest] = useState<TestState>({ running: false, message: '' })
  const [serverLogs, setServerLogs] = useState<ApiLogItem[]>([])
  const [serverLogError, setServerLogError] = useState('')
  const [loadingLogs, setLoadingLogs] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => subscribeLocalLogs(setLogs), [])

  useEffect(() => {
    papersApi
      .list()
      .then((list) => {
        setPapers(list)
        if (list.length && !paperId) setPaperId(String(list[0].id))
      })
      .catch(() => setPapers([]))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const stats = localLogStats(logs)

  async function runProbe() {
    setProbing(true)
    setProbe(null)
    const started = performance.now()
    try {
      const [ps, es] = await Promise.all([papersApi.list(), examsApi.list()])
      setProbe({
        ok: true,
        message: '接口可达，鉴权正常',
        durationMs: Math.round(performance.now() - started),
        papers: ps.length,
        exams: es.length,
      })
      toast('接口可达', 'ok')
    } catch (e) {
      setProbe({
        ok: false,
        message: errorText(e),
        durationMs: Math.round(performance.now() - started),
      })
      toast('接口不可用', 'err')
    } finally {
      setProbing(false)
    }
  }

  async function runRealTest(file?: File | null) {
    if (!file) return
    const pid = Number(paperId)
    if (!pid) {
      toast('请先选择一份试卷', 'err')
      return
    }
    setTest({ running: true, message: '正在压缩图片…' })
    const started = performance.now()
    try {
      const prep = await prepareImage(file)
      const upload = new File([prep.blob], file.name.replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' })
      setTest({ running: true, message: '正在上传图片…' })
      const up = await filesApi.upload(upload)
      setTest({ running: true, message: `上传完成（fileId ${up.fileId}），正在识别…` })
      const res: CheckResponse = await papersApi.check(pid, [up.fileId])
      const ms = Math.round(performance.now() - started)
      const first = res.results[0]
      let savedNote = ''
      if (first?.success) {
        try {
          await saveScan(
            scanFromCheckItem(first, {
              paperId: pid,
              paperName: papers.find((p) => p.id === pid)?.name,
              title: `诊断自检 · 试卷 #${pid} · 文件 #${first.fileId}`,
            }),
          )
          savedNote = '，结果已存入本机历史'
        } catch {
          savedNote = '，但本机历史保存失败'
        }
      }
      setTest({
        running: false,
        ok: first?.success ?? false,
        message: first?.success
          ? `真实识别成功：耗时 ${ms} ms，答案 ${Object.keys(first.metrics ?? {}).length} 题${savedNote}`
          : `请求完成但识别失败：${first?.code ?? ''} ${first?.error ?? ''}`,
        detail: `总 ${res.total} 张 · 成功 ${res.successCount} · 失败 ${res.failureCount}`,
        raw: JSON.stringify(res, null, 2),
      })
    } catch (e) {
      setTest({
        running: false,
        ok: false,
        message: `识别测试失败：${errorText(e)}`,
        detail: `耗时 ${Math.round(performance.now() - started)} ms`,
      })
    }
  }

  async function loadServerLogs() {
    setLoadingLogs(true)
    setServerLogError('')
    try {
      const page = await logsApi.list({ limit: 20 })
      setServerLogs(page.items)
    } catch (e) {
      setServerLogs([])
      setServerLogError(errorText(e))
    } finally {
      setLoadingLogs(false)
    }
  }

  useEffect(() => {
    void loadServerLogs()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div>
      <PageHeader
        title="识别诊断"
        desc="连通性、真实识别链路、本机与服务端请求日志集中在这里，出问题时先跑一遍自检。"
        crumb={[{ label: '设置', to: '/settings' }, { label: '识别诊断' }]}
        extra={<Badge tone="mute">GET /papers · POST /papers/check</Badge>}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <SectionTitle extra={<Badge tone={probe ? (probe.ok ? 'ok' : 'err') : 'mute'}>{probe ? (probe.ok ? '可达' : '不可达') : '未测试'}</Badge>}>
            接口连通性
          </SectionTitle>
          <div className="space-y-2.5 text-[11.5px]">
            <p className="flex items-center gap-2 text-ink-soft">
              <span className="w-16 shrink-0 font-bold text-ink">接口地址</span>
              <span className="truncate font-mono">{getApiBase() || '同源 /api（开发代理 / 生产转发）'}</span>
            </p>
            <p className="flex items-center gap-2 text-ink-soft">
              <span className="w-16 shrink-0 font-bold text-ink">API 令牌</span>
              <span className="font-mono">{maskToken(getApiToken())}</span>
            </p>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Button onClick={runProbe} disabled={probing}>
              {probing ? <Spinner /> : <BoltIcon className="h-4 w-4" />}
              测试连接
            </Button>
            <Link to="/settings" className="text-[11.5px] font-bold text-brand-700 hover:underline">
              去修改接口设置 →
            </Link>
          </div>
          {probe && (
            <div className="anim-fade-up mt-4 rounded-xl border border-brand-200/70 bg-brand-50/60 px-3 py-2.5 text-[11.5px]">
              <p className={`font-bold ${probe.ok ? 'text-emerald-700' : 'text-red-600'}`}>
                {probe.ok ? <CheckCircleIcon className="mr-1 inline h-3.5 w-3.5" /> : <AlertIcon className="mr-1 inline h-3.5 w-3.5" />}
                {probe.message}
              </p>
              <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-ink-soft/70">
                <span className="inline-flex items-center gap-1">
                  <ClockIcon className="h-3 w-3" />
                  耗时 {probe.durationMs} ms
                </span>
                {probe.papers !== undefined && <span>试卷 {probe.papers} 份</span>}
                {probe.exams !== undefined && <span>考试 {probe.exams} 场</span>}
              </p>
            </div>
          )}
        </Card>

        <Card>
          <SectionTitle extra={<Badge tone="brand">真实请求</Badge>}>识别链路自检</SectionTitle>
          <p className="mb-3 text-[11.5px] leading-relaxed text-ink-soft/70">
            选一份已配置的试卷，上传一张真实答题卡，完整跑一遍「上传 → check」，结果写入本机历史。
          </p>
          <Field label="试卷">
            <div className="flex gap-2">
              <select className={inputCls} value={paperId} onChange={(e) => setPaperId(e.target.value)}>
                <option value="">选择试卷…</option>
                {papers.map((p) => (
                  <option key={p.id} value={p.id}>
                    #{p.id} {p.name}
                  </option>
                ))}
              </select>
              <Button variant="ghost" onClick={() => fileRef.current?.click()} disabled={test.running || !paperId}>
                <FileStackIcon className="h-4 w-4" />
                选择图片
              </Button>
            </div>
          </Field>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              void runRealTest(e.target.files?.[0])
              e.target.value = ''
            }}
          />
          {test.message && (
            <div className="anim-fade-up mt-4 space-y-2">
              <div
                className={`rounded-xl border px-3 py-2.5 text-[11.5px] font-semibold ${
                  test.running
                    ? 'border-brand-200 bg-brand-50 text-brand-800'
                    : test.ok
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                      : 'border-red-200 bg-red-50 text-red-600'
                }`}
              >
                {test.running && <Spinner className="mr-1.5" />}
                {test.message}
                {test.detail && <p className="mt-1 text-[10.5px] font-medium opacity-70">{test.detail}</p>}
              </div>
              {test.raw && (
                <details className="rounded-xl border border-brand-200/70 bg-white">
                  <summary className="cursor-pointer px-3 py-2 text-[11px] font-bold text-ink-soft">
                    查看原始响应（已截断）
                  </summary>
                  <pre className="max-h-56 overflow-auto border-t border-brand-100 px-3 py-2 font-mono text-[10px] leading-relaxed text-ink-soft">
                    {test.raw.slice(0, 4000)}
                  </pre>
                </details>
              )}
            </div>
          )}
        </Card>
      </div>

      <Card className="mt-4">
        <SectionTitle
          extra={
            <div className="flex items-center gap-2">
              <Badge tone={stats.errors ? 'err' : 'ok'}>本机 {stats.total} 条 · 错误 {stats.errors}</Badge>
              <Button variant="ghost" size="sm" onClick={clearLocalLogs} disabled={logs.length === 0}>
                清空
              </Button>
            </div>
          }
        >
          本机请求日志
        </SectionTitle>
        <p className="mb-3 text-[11px] text-ink-soft/60">页面内所有 fetch / 上传都会记在这里，刷新页面后清空。</p>
        {logs.length === 0 ? (
          <p className="py-6 text-center text-[11.5px] text-ink-soft/50">还没有请求记录</p>
        ) : (
          <div className="max-h-[320px] overflow-y-auto">
            <table className="w-full text-[11px]">
              <thead className="sticky top-0 bg-white">
                <tr className="border-b border-brand-100 text-left text-[10.5px] text-ink-soft/60">
                  <th className="px-2 py-1.5 font-semibold">时间</th>
                  <th className="px-2 py-1.5 font-semibold">方法</th>
                  <th className="px-2 py-1.5 font-semibold">路径</th>
                  <th className="px-2 py-1.5 text-right font-semibold">状态</th>
                  <th className="px-2 py-1.5 text-right font-semibold">耗时</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((l) => (
                  <tr key={l.id} className="border-b border-brand-50">
                    <td className="px-2 py-1.5 text-ink-soft/70">
                      {new Date(l.at).toLocaleTimeString('zh-CN', { hour12: false })}
                    </td>
                    <td className="px-2 py-1.5 font-mono font-bold">{l.method}</td>
                    <td className="max-w-[280px] truncate px-2 py-1.5 font-mono" title={l.error ?? l.path}>
                      {l.path}
                    </td>
                    <td className={`px-2 py-1.5 text-right font-bold ${l.ok ? 'text-emerald-700' : 'text-red-600'}`}>
                      {l.status ?? 'ERR'}
                    </td>
                    <td className="px-2 py-1.5 text-right tabnum text-ink-soft/70">{l.durationMs} ms</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <SectionTitle
            extra={
              <Button variant="ghost" size="sm" onClick={loadServerLogs} disabled={loadingLogs}>
                {loadingLogs ? <Spinner /> : null} 刷新
              </Button>
            }
          >
            服务端接口日志
          </SectionTitle>
          {serverLogError && false ? (
            <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[11.5px] text-amber-700">
              服务端日志不可用：{serverLogError}
            </p>
          ) : serverLogs.length === 0 ? (
            <p className="py-6 text-center text-[11.5px] text-ink-soft/50">暂无服务端日志</p>
          ) : (
            <div className="max-h-[260px] space-y-1.5 overflow-y-auto">
              {serverLogs.map((l) => (
                <div key={l.id} className="flex items-center gap-2 rounded-lg border border-brand-100 px-2.5 py-1.5 text-[11px]">
                  <span className="w-12 shrink-0 font-mono font-bold text-ink-soft">{l.method}</span>
                  <span className="min-w-0 flex-1 truncate font-mono">{l.path}</span>
                  <Badge tone={l.status >= 500 ? 'err' : l.status >= 400 ? 'warn' : 'ok'}>{l.status}</Badge>
                  <span className="w-14 shrink-0 text-right tabnum text-ink-soft/60">{l.duration ?? '—'} ms</span>
                </div>
              ))}
              <Link to="/logs" className="block pt-1 text-center text-[11px] font-bold text-brand-700 hover:underline">
                查看完整日志 →
              </Link>
            </div>
          )}
        </Card>

        <Card>
          <SectionTitle>排障提示</SectionTitle>
          <ul className="space-y-2 text-[11.5px] leading-relaxed text-ink-soft">
            <li>· <b className="text-ink">连不上</b>：先看「接口连通性」，确认地址与令牌；隧道地址变更后要在设置里更新。</li>
            <li>· <b className="text-ink">401 / 403</b>：令牌不正确或服务端未配置 <code>EXAM_API_TOKEN</code>。</li>
            <li>· <b className="text-ink">CHECK_FAILED</b>：四角定位块没拍全或透视变形过大，重拍时把整张答题卡框进去。</li>
            <li>· <b className="text-ink">FILE_TOO_LARGE</b>：单张图片达到或超过 10 MiB，拍照页会先压缩长边到 2400。</li>
            <li>· <b className="text-ink">识别全错</b>：优先检查试卷版式里的题号/选项区域是否与实际答题卡对齐。</li>
          </ul>
          <p className="mt-3 rounded-xl bg-brand-50/70 px-3 py-2 text-[10.5px] leading-relaxed text-ink-soft/70">
            常见错误码：{Object.keys(ERROR_TEXT).slice(0, 8).join(' · ')} … 完整对照见「检查说明」页。
          </p>
        </Card>
      </div>
    </div>
  )
}

function maskToken(token: string): string {
  if (!token) return '未配置（同源代理可留空）'
  if (token.length <= 8) return '••••••'
  return `${token.slice(0, 4)}••••${token.slice(-4)}`
}

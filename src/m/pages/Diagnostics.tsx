import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getApiBase, getApiToken } from '../../api/client'
import { examsApi, logsApi, papersApi } from '../api'
import { clearLocalLogs, getLocalLogs, subscribeLocalLogs } from '../../lib/requestLog'
import { Btn, Card, ErrorBar, Page } from '../ui'
import { IcAlert, IcRefresh } from '../icons'

/** 移动端识别诊断：连通性 + 请求日志 + 快捷排查 */
export default function Diagnostics() {
  const nav = useNavigate()
  const [probe, setProbe] = useState<{ state: 'idle' | 'busy' | 'ok' | 'fail'; text: string }>({ state: 'idle', text: '' })
  const [logs, setLogs] = useState(() => getLocalLogs(12))
  const [server, setServer] = useState<string[]>([])
  const lastErr = logs.find((l) => !l.ok)

  useEffect(() => subscribeLocalLogs((next) => setLogs(next.slice(0, 12))), [])

  async function ping() {
    setProbe({ state: 'busy', text: '正在连接…' })
    try {
      const [ps, es] = await Promise.all([papersApi.list(), examsApi.list()])
      setProbe({ state: 'ok', text: `接口正常：试卷 ${ps.length} 份，考试 ${es.length} 场` })
    } catch (e) {
      setProbe({ state: 'fail', text: e instanceof Error ? e.message : '连接失败' })
    }
  }

  async function loadLogs() {
    try {
      const page = await logsApi.list({ limit: 12 })
      setServer(page.items.map((x) => `${x.method} ${x.path} → ${x.status}`))
    } catch {
      setServer([])
    }
  }

  useEffect(() => { void loadLogs() }, [])

  return (
    <Page title="接口诊断" sub="连通性与日志" back>
      <Card className="!p-3">
        <p className="text-[12px] font-extrabold">当前接口</p>
        <p className="mt-1 break-all font-mono text-[10.5px] text-ink-soft">{getApiBase() || '同源 /api'}</p>
        <p className="mo-muted mt-1">Token：{getApiToken() ? '已配置' : '未配置'}</p>
        <div className="mt-2 flex gap-2">
          <Btn block onClick={() => void ping()} disabled={probe.state === 'busy'}><IcRefresh /> {probe.state === 'busy' ? '检测中…' : '测试连接'}</Btn>
          <Btn block variant="ghost" onClick={() => { setProbe({ state: 'idle', text: '' }); clearLocalLogs(); setLogs([]) }}>清空日志</Btn>
        </div>
        {probe.state !== 'idle' && (
          <div className={`mt-2 rounded-xl px-3 py-2 text-[11px] font-bold ${probe.state === 'ok' ? 'bg-emerald-50 text-emerald-700' : probe.state === 'fail' ? 'bg-red-50 text-red-600' : 'bg-brand-50 text-brand-700'}`}>
            {probe.text}
          </div>
        )}
        {lastErr && <ErrorBar text={`最近失败：${lastErr.method} ${lastErr.path} ${lastErr.status ?? 'NETWORK'}`} />}
      </Card>

      <Card className="mt-3 !p-3">
        <p className="flex items-center gap-1 text-[12px] font-extrabold"><IcAlert /> 本机请求日志</p>
        <div className="mt-2 space-y-1">
          {logs.length === 0 && <p className="mo-muted">还没有请求记录</p>}
          {logs.map((l, i) => (
            <div key={i} className="flex items-center gap-2 rounded-lg bg-neutral-50 px-2 py-1.5 text-[10.5px]">
              <span className={`font-black ${l.ok ? 'text-emerald-600' : 'text-red-600'}`}>{l.status ?? 'NET'}</span>
              <span className="min-w-0 flex-1 truncate font-mono text-ink-soft">{l.method} {l.path}</span>
              <span className="text-ink-soft/50">{l.durationMs}ms</span>
            </div>
          ))}
        </div>
      </Card>

      <Card className="mt-3 !p-3">
        <div className="flex items-center justify-between">
          <p className="text-[12px] font-extrabold">服务端日志</p>
          <button type="button" className="text-[10px] font-bold text-brand-700" onClick={() => void loadLogs()}>刷新</button>
        </div>
        <div className="mt-2 space-y-1">
          {server.length === 0 && <p className="mo-muted">服务端日志不可用或为空</p>}
          {server.map((s, i) => <p key={i} className="truncate font-mono text-[10px] text-ink-soft">{s}</p>)}
        </div>
      </Card>

      <Btn block variant="ghost" onClick={() => nav('/m/settings')}>去修改接口地址</Btn>
      <Btn block variant="ghost" onClick={() => nav('/m/mine')}>返回我的</Btn>
    </Page>
  )
}

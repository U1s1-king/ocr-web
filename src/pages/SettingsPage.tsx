import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { DEFAULT_BASE, getApiBase, getApiToken, setApiBase, setApiToken } from '../api/client'
import { getExam } from '../api/exams'
import { useToast } from '../components/Toast'
import { Badge, Button, Card, Field, SectionTitle, Spinner, inputCls } from '../components/ui'
import { setVisualPrefs, useVisualPrefs } from '../lib/visualPrefs'
import { clearLocalLogs, getLocalLogs, subscribeLocalLogs } from '../lib/requestLog'
import { diagnoseRequest } from '../lib/diagnose'
import {
  activeEndpointId,
  addEndpoint,
  loadEndpoints,
  maskToken,
  removeEndpoint,
  setActiveEndpoint,
  updateEndpoint,
  type Endpoint,
} from '../lib/endpoints'

export default function SettingsPage() {
  const toast = useToast()
  const visual = useVisualPrefs()
  const [logs, setLogs] = useState(() => getLocalLogs(20))
  const [base, setBase] = useState(getApiBase())
  const [token, setToken] = useState(getApiToken())
  const [eps, setEps] = useState<Endpoint[]>([])
  const [activeId, setActive] = useState('')
  const [testing, setTesting] = useState(false)
  const [state, setState] = useState<{ ok: boolean; text: string } | null>(null)
  const [effectiveBase, setEffectiveBase] = useState(getApiBase())
  const dirtyBase = base.trim().replace(/\/+$/, '') !== effectiveBase

  useEffect(() => subscribeLocalLogs((next) => setLogs(next.slice(0, 20))), [])

  useEffect(() => {
    setBase(getApiBase())
    setToken(getApiToken())
    setEps(loadEndpoints())
    setActive(activeEndpointId())
  }, [])

  function save() {
    setApiBase(base)
    setApiToken(token)
    setBase(getApiBase())
    setEffectiveBase(getApiBase())
    clearLocalLogs()
    setState(null)
    toast('已保存接口配置，已立即生效', 'ok')
  }

  async function test() {
    setTesting(true)
    setState(null)
    setApiBase(base)
    setApiToken(token)
    setEffectiveBase(getApiBase())
    clearLocalLogs()
    try {
      await getExam(1)
      clearLocalLogs()
      setState({ ok: true, text: '接口可达，试卷 1 读取成功' })
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      const status = (e as { status?: number }).status
      if (status === 401) setState({ ok: false, text: '接口可达，但鉴权失败（401），请检查令牌' })
      else if (status === 404) setState({ ok: true, text: '接口可达（试卷 1 不存在，返回 404）' })
      else setState({ ok: false, text: `请求失败：${msg}` })
    } finally {
      setTesting(false)
    }
  }

  function applyEp(ep: Endpoint) {
    setBase(ep.base)
    setToken(ep.token)
    setApiBase(ep.base)
    setApiToken(ep.token)
    setEffectiveBase(getApiBase())
    clearLocalLogs()
    setState(null)
    setActiveEndpoint(ep.id)
    setActive(ep.id)
    toast(`已切换到「${ep.name}」`, 'ok')
  }

  function saveAsEndpoint() {
    const name = window.prompt('给这套配置起个名字', base ? base.replace(/^https?:\/\//, '').slice(0, 24) : '默认同源')
    if (!name) return
    const next = addEndpoint({ name: name.trim(), base: base.trim(), token: token.trim() })
    setEps(next)
    const created = next[0]
    setActiveEndpoint(created.id)
    setActive(created.id)
    toast('已保存为方案', 'ok')
  }

  function editEndpoint(ep: Endpoint) {
    const name = window.prompt('方案名称', ep.name)
    if (name === null) return
    const b = window.prompt('接口地址（留空=同源 /api）', ep.base)
    if (b === null) return
    const t = window.prompt('API 令牌（留空=不带令牌）', ep.token)
    if (t === null) return
    setEps(updateEndpoint(ep.id, { name: name.trim() || ep.name, base: b.trim(), token: t.trim() }))
    toast('方案已更新', 'ok')
  }

  function dropEndpoint(ep: Endpoint) {
    if (!window.confirm(`删除方案「${ep.name}」？`)) return
    const next = removeEndpoint(ep.id)
    setEps(next)
    if (activeId === ep.id) setActive('')
    toast('已删除方案', 'ok')
  }

  return (
    <div className="anim-page-in space-y-5">
      <header>
        <h1 className="text-xl font-black tracking-tight">接口设置</h1>
        <p className="mt-1 text-xs text-ink-soft">
          配置后端地址与 API 令牌，可存多套方案随时切换，只保存在本机浏览器。
        </p>
      </header>

      <Card>
        <SectionTitle>接口诊断</SectionTitle>
        <SettingsDiagnosis logs={logs} base={effectiveBase} state={state} testing={testing} onTest={test} dirty={dirtyBase} />
      </Card>

      <Card>
        <SectionTitle>视觉与动效</SectionTitle>
        <div className="pref-row">
          <div className="pref-row-tx">
            <p className="pref-row-title">3D 粒子背景</p>
            <p className="pref-row-desc">漂浮粒子 + 鼠标靠近自动连线，跟随主题色，关闭后立即生效</p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={visual.particles}
            className="pref-switch"
            data-on={visual.particles}
            onClick={() => setVisualPrefs({ particles: !visual.particles })}
          />
        </div>
        <div className="pref-row">
          <div className="pref-row-tx">
            <p className="pref-row-title">页面交互动效</p>
            <p className="pref-row-desc">标题/导航/卡片进入与离开视口的动画、路由过渡</p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={visual.motion}
            className="pref-switch"
            data-on={visual.motion}
            onClick={() => setVisualPrefs({ motion: !visual.motion })}
          />
        </div>
      </Card>

      <Card>
        <SectionTitle>令牌方案</SectionTitle>
        {eps.length === 0 ? (
          <p className="text-[11.5px] leading-relaxed text-ink-soft/70">
            还没有方案。下面填好地址和令牌，点「存为方案」就能一键切换多套接口 / 令牌。
          </p>
        ) : (
          <div className="space-y-2">
            {eps.map((ep) => {
              const on = ep.id === activeId
              return (
                <div
                  key={ep.id}
                  className={`flex flex-wrap items-center gap-2 rounded-xl border px-3 py-2.5 ${
                    on ? 'border-brand-400 bg-brand-50/70' : 'border-brand-200/70 bg-white'
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-1.5 truncate text-[12px] font-bold text-ink">
                      {ep.name}
                      {on && <Badge tone="ok">使用中</Badge>}
                    </p>
                    <p className="mt-0.5 truncate text-[10.5px] text-ink-soft/60">
                      {ep.base || '同源 /api'} · {maskToken(ep.token)}
                    </p>
                  </div>
                  <Button size="sm" variant={on ? 'ghost' : 'primary'} onClick={() => applyEp(ep)}>
                    {on ? '重新应用' : '切换'}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => editEndpoint(ep)}>
                    编辑
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => dropEndpoint(ep)}>
                    删除
                  </Button>
                </div>
              )
            })}
          </div>
        )}
      </Card>

      <Card>
        <SectionTitle>连接配置</SectionTitle>
        <div className="space-y-3">
          <Field label="接口地址" hint="留空=同源 /api；自定义请写到 /api/v1 之前，不含末尾斜杠">
            <input
              className={inputCls}
              value={base}
              placeholder={DEFAULT_BASE}
              onChange={(e) => setBase(e.target.value)}
            />
          </Field>
          <Field label="API 令牌" hint="对应服务端 EXAM_API_TOKEN">
            <input
              className={inputCls}
              value={token}
              placeholder="Bearer token"
              onChange={(e) => setToken(e.target.value)}
            />
          </Field>
          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={save}>保存配置</Button>
            <Button variant="ghost" onClick={saveAsEndpoint}>
              存为方案
            </Button>
            <Button variant="ghost" onClick={test} disabled={testing}>
              {testing ? <Spinner /> : null}
              测试连接
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                setBase('')
                setToken('')
                setApiBase('')
                setApiToken('')
                setActive('')
                setActiveEndpoint('')
                toast('已恢复默认', 'info')
              }}
            >
              恢复默认
            </Button>
          </div>
          {state && (
            <div className="anim-fade-up">
              <Badge tone={state.ok ? 'ok' : 'err'}>{state.text}</Badge>
            </div>
          )}
        </div>
      </Card>

      <Card>
        <SectionTitle
          extra={
            <Link
              to="/settings/diagnostics"
              className="text-[11.5px] font-bold text-brand-700 hover:underline"
            >
              打开识别诊断 →
            </Link>
          }
        >
          识别诊断
        </SectionTitle>
        <p className="text-[11.5px] leading-relaxed text-ink-soft/70">
          接口连不上、识别失败、需要看每次请求的去向时，到诊断页跑一遍连通性与真实识别自检，
          并查看本机 / 服务端两套请求日志。
        </p>
      </Card>

      <Card>
        <SectionTitle>说明</SectionTitle>
        <ul className="space-y-1.5 text-[11px] leading-relaxed text-ink-soft">
          <li>· 方案存在本机 localStorage，换浏览器或清缓存会丢失。</li>
          <li>· 切换方案立即生效，不用刷新页面。</li>
          <li>· 试卷、文件、检查接口需要令牌，学生接口当前不需要。</li>
          <li>· 上传文件按 SHA-256 去重，同一张图重复上传会复用已有 fileId。</li>
        </ul>
      </Card>
    </div>
  )
}


function SettingsDiagnosis({
  logs,
  base,
  state,
  testing,
  onTest,
  dirty,
}: {
  logs: ReturnType<typeof getLocalLogs>
  base: string
  state: { ok: boolean; text: string } | null
  testing: boolean
  onTest: () => void
  dirty: boolean
}) {
  const last = logs.find((l) => !l.ok)
  const d = state?.ok
    ? { tone: 'ok' as const, title: '接口正常', desc: `${state.text}。当前地址已动态生效。` }
    : state
      ? { tone: 'error' as const, title: '本次检测失败', desc: state.text }
      : dirty
        ? { tone: 'warn' as const, title: '地址已修改', desc: '保存后立即生效；旧的失败记录不再作为当前诊断，请点「重新检测」或保存。' }
        : diagnoseRequest(last)
  const tone =
    d.tone === 'error'
      ? 'bg-red-50 text-red-700 border-red-200'
      : d.tone === 'warn'
        ? 'bg-amber-50 text-amber-800 border-amber-200'
        : 'bg-emerald-50 text-emerald-800 border-emerald-200'
  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <p className="text-[11px] font-semibold text-ink-soft">
          当前生效地址：<span className="font-mono text-[10.5px] text-ink">{base || '同源 /api'}</span>
        </p>
        <button
          type="button"
          onClick={onTest}
          disabled={testing}
          className="ml-auto rounded-lg border border-brand-200/70 bg-white px-2.5 py-1 text-[10.5px] font-bold text-brand-700 disabled:opacity-50"
        >
          {testing ? '检测中…' : '重新检测'}
        </button>
      </div>
      <div className={`rounded-xl border px-3 py-2.5 ${tone}`}>
        <p className="text-[12px] font-bold">{d.title}</p>
        <p className="mt-1 text-[11px] leading-relaxed opacity-85">{d.desc}</p>
        {last && !state && (
          <p className="mt-2 break-all font-mono text-[10px] opacity-70">
            {last.method} {last.path} · {last.status ?? 'NETWORK'} {last.code ? `· ${last.code}` : ''} ·{' '}
            {new Date(last.at).toLocaleTimeString('zh-CN')}
          </p>
        )}
        {last && !state && (
          <p className="mt-1 break-all font-mono text-[10px] opacity-60">{last.error ?? '无错误详情'}</p>
        )}
      </div>
      <p className="mt-2 text-[10.5px] leading-relaxed text-ink-soft/60">
        隧道地址变化时不用改代码：直接在这里改地址保存即可；也可以用
        <span className="font-mono"> ?api=https://... </span>
        临时覆盖。
      </p>
    </div>
  )
}

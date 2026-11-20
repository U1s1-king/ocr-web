import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useToast } from '../../components/Toast'
import { getApiBase, getApiToken, setApiBase, setApiToken } from '../../api/client'
import { examsApi } from '../api'
import { IcAlert, IcCheck, IcCloudOff, IcRefresh, IcSliders, IcSpark } from '../icons'
import { Btn, Card, Page } from '../ui'
import { cacheSize, purgeAllCaches } from '../cache'
import { setVisualPrefs, useVisualPrefs } from '../../lib/visualPrefs'
import { clearLocalLogs, getLocalLogs, subscribeLocalLogs } from '../../lib/requestLog'
import { diagnoseRequest } from '../../lib/diagnose'

type TestState = { state: 'idle' | 'busy' | 'ok' | 'fail'; text: string }

export default function Settings() {
  const nav = useNavigate()
  const toast = useToast()
  const [base, setBase] = useState(getApiBase())
  const [token, setToken] = useState(getApiToken())
  const [test, setTest] = useState<TestState>({ state: 'idle', text: '' })
  const visual = useVisualPrefs()
  const [logs, setLogs] = useState(() => getLocalLogs(20))
  const lastErr = logs.find((l) => !l.ok)
  const diag = diagnoseRequest(lastErr)
  const dirtyBase = base.trim().replace(/\/+$/, '') !== getApiBase()
  useEffect(() => subscribeLocalLogs((next) => setLogs(next.slice(0, 20))), [])

  function save() {
    setApiBase(base)
    setApiToken(token)
    setBase(getApiBase())
    clearLocalLogs()
    setTest({ state: 'idle', text: '' })
    toast('接口设置已保存，已立即生效', 'ok')
  }

  async function ping() {
    setTest({ state: 'busy', text: '正在连接…' })
    setApiBase(base)
    setApiToken(token)
    clearLocalLogs()
    try {
      const list = await examsApi.list()
      clearLocalLogs()
      setTest({ state: 'ok', text: `连通成功，读到 ${list.length} 场考试` })
    } catch (err) {
      setTest({ state: 'fail', text: err instanceof Error ? err.message : '连接失败' })
    }
  }

  return (
    <Page title="接口设置" sub="API" back>
      <Card className="mt-3 !p-4">
        <div className="flex items-center gap-2">
          <p className="text-[13px] font-extrabold">接口诊断</p>
          <button
            type="button"
            className="ml-auto rounded-lg border border-line bg-white px-2.5 py-1 text-[10px] font-bold text-brand-700 disabled:opacity-50"
            onClick={ping}
            disabled={test.state === 'busy'}
          >
            {test.state === 'busy' ? '检测中…' : '重新检测'}
          </button>
        </div>
        <p className="mt-2 break-all text-[10.5px] text-ink-soft">
          当前生效地址：<span className="font-mono text-ink">{getApiBase() || '同源 /api'}</span>
        </p>
        {test.state === 'ok' ? (
          <div className="diag-box ok mt-2">
            <p className="text-[12px] font-extrabold">接口正常</p>
            <p className="mt-1 text-[11px] leading-relaxed opacity-85">{test.text}。当前地址已动态生效。</p>
          </div>
        ) : test.state === 'fail' ? (
          <div className="diag-box error mt-2">
            <p className="text-[12px] font-extrabold">本次检测失败</p>
            <p className="mt-1 text-[11px] leading-relaxed opacity-85">{test.text}</p>
          </div>
        ) : dirtyBase ? (
          <div className="diag-box warn mt-2">
            <p className="text-[12px] font-extrabold">地址已修改</p>
            <p className="mt-1 text-[11px] leading-relaxed opacity-85">
              保存后立即生效；旧的失败记录不再作为当前诊断，请点「重新检测」或保存。
            </p>
          </div>
        ) : (
          <div className={`diag-box mt-2 ${diag.tone}`}>
            <p className="text-[12px] font-extrabold">{diag.title}</p>
            <p className="mt-1 text-[11px] leading-relaxed opacity-85">{diag.desc}</p>
            {lastErr && (
              <p className="mt-2 break-all font-mono text-[9.5px] opacity-60">
                {lastErr.method} {lastErr.path} · {lastErr.status ?? 'NETWORK'} {lastErr.code ? `· ${lastErr.code}` : ''}
              </p>
            )}
          </div>
        )}
        <p className="mt-2 text-[10px] leading-relaxed text-ink-soft/60">
          隧道地址变化时不用改代码：直接修改地址保存即可；也可用 <span className="font-mono">?api=https://...</span> 临时覆盖。
        </p>
      </Card>

      <Card className="mt-3 !p-4">
        <p className="text-[13px] font-extrabold">视觉与动效</p>
        <div className="mt-2 divide-y divide-line">
          <div className="flex items-center gap-3 py-3">
            <div className="min-w-0 flex-1">
              <p className="text-[12px] font-bold text-ink">页面交互动效</p>
              <p className="mt-0.5 text-[10.5px] text-ink-soft">滚动进入/离开动画与路由过渡</p>
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
          <div className="flex items-center gap-3 py-3">
            <div className="min-w-0 flex-1">
              <p className="text-[12px] font-bold text-ink">3D 粒子背景</p>
              <p className="mt-0.5 text-[10.5px] text-ink-soft">仅 Web 端生效</p>
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
        </div>
      </Card>

      <Card className="mt-3 !p-0">
        <div className="space-y-4 p-4">
          <p className="flex items-center gap-1.5 text-[13px] font-extrabold">
            <IcSliders style={{ fontSize: 15 }} /> 接口
          </p>
          <label className="mo-field">
            <span className="mo-field-label">API 地址</span>
            <input
              className="mo-input"
              value={base}
              onChange={(e) => {
                setBase(e.target.value)
                setTest({ state: 'idle', text: '' })
              }}
              placeholder="http://127.0.0.1:3000"
              spellCheck={false}
            />
          </label>
          <label className="mo-field">
            <span className="mo-field-label">API Token（可留空）</span>
            <input
              className="mo-input"
              value={token}
              onChange={(e) => {
                setToken(e.target.value)
                setTest({ state: 'idle', text: '' })
              }}
              placeholder="Bearer token"
              spellCheck={false}
            />
          </label>
        </div>
      </Card>

      <div className="mt-3 flex gap-2">
        <Btn block variant="ghost" onClick={ping} disabled={test.state === 'busy'}>
          <IcRefresh style={{ fontSize: 16 }} /> {test.state === 'busy' ? '连接中…' : '测试连通'}
        </Btn>
        <Btn block onClick={save}>
          <IcCheck style={{ fontSize: 16 }} /> 保存
        </Btn>
      </div>

      {test.state !== 'idle' && (
        <div className="mo-card mo-pop mt-3 flex items-start gap-3">
          <span className="mt-0.5 grid h-9 w-9 flex-none place-items-center rounded-xl bg-brand-100 text-brand-700">
            {test.state === 'ok' ? <IcCheck style={{ fontSize: 17 }} /> : <IcCloudOff style={{ fontSize: 17 }} />}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[12px] font-extrabold">
              {test.state === 'ok' ? '接口通了' : test.state === 'fail' ? '连不上服务' : '测试中'}
            </p>
            <p className="mo-muted mt-0.5 break-all">{test.text}</p>
          </div>
        </div>
      )}

      <Card className="mt-3">
        <p className="text-[12px] font-extrabold">地址存在本机</p>
        <p className="mo-muted mt-1">
          设置保存在浏览器 localStorage，换设备要重新填。接口不通时会显示空态和错误提示，不会白屏。
        </p>
      </Card>

      <Card className="mt-3">
        <p className="flex items-center gap-1.5 text-[12px] font-extrabold">
          <IcAlert style={{ fontSize: 15 }} className="text-amber-500" /> 常见问题
        </p>
        <ul className="mo-muted mt-1.5 space-y-1.5">
          <li>· 502 / 无法连接：后端没起或端口不对</li>
          <li>· 401：Token 和服务端配置不一致</li>
          <li>· 上传超过 10 MiB 会被服务端拒绝</li>
        </ul>
      </Card>

      <Card className="mt-3 !p-4">
        <p className="text-[13px] font-extrabold">缓存</p>
        <p className="mo-muted mt-1">
          当前会话缓存 {cacheSize()} 条，5 分钟内有效。页面切换会先显示缓存再后台刷新。
        </p>
        <button
          type="button"
          className="mt-2.5 w-full rounded-2xl border border-brand-200 bg-white py-2.5 text-[12px] font-extrabold text-brand-700 active:scale-[.99]"
          onClick={() => {
            const n = purgeAllCaches()
            toast(`已清除 ${n} 项缓存，正在刷新`, 'ok')
            window.setTimeout(() => window.location.reload(), 500)
          }}
        >
          清除本地缓存
        </button>
      </Card>

      <button
        type="button"
        className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-2xl bg-white py-3 text-[12px] font-extrabold text-ink-soft active:scale-[.99]"
        onClick={() => nav('/m/mine')}
      >
        <IcSpark style={{ fontSize: 14 }} /> 返回我的
      </button>
    </Page>
  )
}

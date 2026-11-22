import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useToast } from '../../components/Toast'
import { cacheSize, purgeAllCaches } from '../cache'
import { Btn, Card, Page } from '../ui'

const KEY = 'ac.prefs'
const DEFAULT = { reduceMotion: false, autoSave: true, pageSize: 20, showGrid: true }
type Prefs = typeof DEFAULT

function load(): Prefs {
  try {
    return { ...DEFAULT, ...(JSON.parse(localStorage.getItem(KEY) || '{}') as Partial<Prefs>) }
  } catch {
    return DEFAULT
  }
}

/** 移动端高级选项：偏好、缓存、本地数据 */
export default function Advanced() {
  const toast = useToast()
  const nav = useNavigate()
  const [p, setP] = useState<Prefs>(DEFAULT)

  useEffect(() => setP(load()), [])

  function set<K extends keyof Prefs>(k: K, v: Prefs[K]) {
    setP((old) => {
      const next = { ...old, [k]: v }
      localStorage.setItem(KEY, JSON.stringify(next))
      return next
    })
  }

  return (
    <Page title="高级选项" sub="本机偏好" back>
      <Card className="!p-3">
        {([
          ['reduceMotion', '减弱动效', '关闭页面过渡与浮起动画'],
          ['autoSave', '自动保存', '编辑器停止操作后自动保存'],
          ['showGrid', '编辑器网格', '画布叠加毫米参考网格'],
        ] as const).map(([k, label, desc]) => (
          <div key={k} className="flex items-center gap-3 border-b border-line py-3 last:border-0">
            <div className="min-w-0 flex-1">
              <p className="text-[12px] font-extrabold">{label}</p>
              <p className="mo-muted mt-0.5">{desc}</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={p[k]}
              className="pref-switch"
              data-on={p[k]}
              onClick={() => set(k, !p[k])}
            />
          </div>
        ))}
      </Card>

      <Card className="mt-3 !p-3">
        <p className="text-[12px] font-extrabold">列表每页数量</p>
        <div className="mt-2 flex gap-2">
          {[10, 20, 50, 100].map((n) => (
            <button key={n} type="button" className={`rounded-xl px-3 py-1.5 text-[11px] font-bold ${p.pageSize === n ? 'bg-brand-600 text-white' : 'bg-brand-50 text-brand-700'}`} onClick={() => set('pageSize', n)}>{n} 条</button>
          ))}
        </div>
      </Card>

      <Card className="mt-3 !p-3">
        <p className="text-[12px] font-extrabold">本地数据</p>
        <p className="mo-muted mt-1">当前会话缓存 {cacheSize()} 条。清除只影响本机，不影响服务端。</p>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <Btn variant="ghost" onClick={() => { localStorage.setItem(KEY, JSON.stringify(DEFAULT)); setP(DEFAULT); toast('已恢复默认', 'ok') }}>恢复默认</Btn>
          <Btn variant="ghost" onClick={() => {
            const n = purgeAllCaches()
            ;['ac.examIndex', 'ac.checkHistory', KEY].forEach((k) => localStorage.removeItem(k))
            toast(`已清除缓存（${n + 3} 项）`, 'ok')
            setTimeout(() => window.location.reload(), 400)
          }}>清除缓存</Btn>
        </div>
      </Card>

      <Btn block variant="ghost" onClick={() => nav('/m/mine')}>返回我的</Btn>
    </Page>
  )
}

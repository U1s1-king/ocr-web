import { useEffect, useState } from 'react'
import { PageHeader } from '../components/PageHeader'
import { Badge, Button, Card, Field, inputCls } from '../components/ui'
import { useToast } from '../components/Toast'
import { useConfirm } from '../components/Confirm'
import { cacheSize, purgeAllCaches } from '../m/cache'

type Prefs = {
  reduceMotion: boolean
  autoSave: boolean
  pageSize: number
  showGrid: boolean
}

const KEY = 'ac.prefs'
const DEFAULT: Prefs = { reduceMotion: false, autoSave: true, pageSize: 20, showGrid: true }

function load(): Prefs {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? { ...DEFAULT, ...(JSON.parse(raw) as Partial<Prefs>) } : DEFAULT
  } catch {
    return DEFAULT
  }
}

function Toggle({
  on,
  onChange,
  label,
  desc,
}: {
  on: boolean
  onChange: (v: boolean) => void
  label: string
  desc: string
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-brand-100/70 py-3 last:border-0">
      <div className="min-w-0">
        <p className="text-xs font-semibold text-ink">{label}</p>
        <p className="mt-0.5 text-[11px] leading-relaxed text-ink-soft/70">{desc}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        onClick={() => onChange(!on)}
        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors duration-300 ${
          on ? 'bg-brand-600' : 'bg-ink-soft/25'
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform duration-300 ease-[cubic-bezier(.22,1,.36,1)] ${
            on ? 'translate-x-5' : ''
          }`}
        />
      </button>
    </div>
  )
}

export default function AdvancedPage() {
  const toast = useToast()
  const confirm = useConfirm()
  const [p, setP] = useState<Prefs>(DEFAULT)

  useEffect(() => {
    setP(load())
  }, [])

  function patch<K extends keyof Prefs>(k: K, v: Prefs[K]) {
    setP((old) => {
      const next = { ...old, [k]: v }
      localStorage.setItem(KEY, JSON.stringify(next))
      return next
    })
  }

  async function reset() {
    if (!(await confirm({ title: '恢复默认设置', description: '所有偏好会回到初始状态，确定继续？' }))) return
    localStorage.setItem(KEY, JSON.stringify(DEFAULT))
    setP(DEFAULT)
    toast('已恢复默认设置', 'ok')
  }

  async function wipe() {
    if (!(await confirm({ title: '清除本地缓存', description: '会删除试卷索引、识别记录与偏好设置，不影响服务端数据。确定？', tone: 'danger' }))) return
    ;['ac.examIndex', 'ac.checkHistory', KEY].forEach((k) => localStorage.removeItem(k))
    const n = purgeAllCaches()
    toast(`本地缓存已清除（${n + 3} 项），即将刷新`, 'ok')
    window.setTimeout(() => window.location.reload(), 500)
  }

  return (
    <div>
      <PageHeader
        title="高级选项"
        desc="只影响本机浏览器的偏好设置，换设备不会同步。"
        crumb={[{ label: '系统设置', to: '/settings' }, { label: '高级选项' }]}
      />

      <Card className="anim-lift mb-4">
        <Toggle
          on={p.reduceMotion}
          onChange={(v) => patch('reduceMotion', v)}
          label="减弱动效"
          desc="关闭页面过渡与卡片浮起，适合低性能设备或晕动敏感者。"
        />
        <Toggle
          on={p.autoSave}
          onChange={(v) => patch('autoSave', v)}
          label="编辑器自动保存"
          desc="在答题卡编辑器里停止操作后自动保存，避免忘记点保存。"
        />
        <Toggle
          on={p.showGrid}
          onChange={(v) => patch('showGrid', v)}
          label="编辑器显示网格"
          desc="在画布上叠加参考网格，方便对齐定位块与题号。"
        />
      </Card>

      <Card className="mb-4">
        <Field label="列表每页数量" hint="影响试卷与学生列表">
          <select
            className={inputCls}
            value={p.pageSize}
            onChange={(e) => patch('pageSize', Number(e.target.value))}
          >
            {[10, 20, 50, 100].map((n) => (
              <option key={n} value={n}>
                {n} 条
              </option>
            ))}
          </select>
        </Field>
      </Card>

      <Card className="border-red-200/70 bg-red-50/40">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-bold text-ink">危险操作</h3>
          <Badge tone="err">谨慎</Badge>
        </div>
        <p className="mt-1.5 text-[11px] leading-relaxed text-ink-soft">
          以下操作只作用于浏览器本地存储，服务端数据不会被删除。当前会话缓存 {cacheSize()} 条。
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button variant="ghost" size="sm" onClick={reset}>
            恢复默认设置
          </Button>
          <Button variant="danger" size="sm" onClick={wipe}>
            清除本地缓存
          </Button>
        </div>
      </Card>
    </div>
  )
}

import { useState } from 'react'
import { useToast } from '../components/Toast'
import { Badge, Button, Card, Field, SectionTitle, inputCls } from '../components/ui'
import {
  DEFAULT_COLOR,
  PRESETS,
  activeThemeId,
  addTheme,
  applyTheme,
  currentColor,
  loadThemes,
  removeTheme,
  shade,
  updateTheme,
  type ThemeItem,
} from '../lib/theme'

export default function ThemePage() {
  const toast = useToast()
  const [color, setColor] = useState(currentColor())
  const [activeId, setActiveId] = useState(activeThemeId())
  const [list, setList] = useState<ThemeItem[]>(() => loadThemes())

  const hexOk = /^#[0-9a-fA-F]{6}$/.test(color)

  function use(color2: string, id = '') {
    const c = /^#[0-9a-fA-F]{6}$/.test(color2) ? color2 : DEFAULT_COLOR
    setColor(c)
    setActiveId(id)
    applyTheme(c, id)
  }

  function saveAs() {
    const name = window.prompt('给这套配色起个名字', '我的配色')
    if (!name) return
    const { list: next, item } = addTheme(name, color)
    setList(next)
    setActiveId(item.id)
    applyTheme(item.color, item.id)
    toast(`已保存配色「${item.name}」`, 'ok')
  }

  function rename(t: ThemeItem) {
    const name = window.prompt('配色名称', t.name)
    if (name === null) return
    setList(updateTheme(t.id, { name: name.trim() || t.name }))
    toast('已重命名', 'ok')
  }

  function recolor(t: ThemeItem) {
    const v = window.prompt('改成哪个 6 位色号（如 #7c5cff）', t.color)
    if (!v) return
    if (!/^#[0-9a-fA-F]{6}$/.test(v.trim())) {
      toast('色号格式不对，要 #RRGGBB', 'err')
      return
    }
    setList(updateTheme(t.id, { color: v.trim() }))
    if (activeId === t.id) use(v.trim(), t.id)
    toast('已更新配色', 'ok')
  }

  function drop(t: ThemeItem) {
    if (!window.confirm(`删除配色「${t.name}」？`)) return
    setList(removeTheme(t.id))
    if (activeId === t.id) setActiveId('')
    toast('已删除', 'ok')
  }

  const stops = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900]

  return (
    <div className="anim-page-in space-y-5">
      <header>
        <h1 className="text-xl font-black tracking-tight">主题配色</h1>
        <p className="mt-1 text-xs text-ink-soft">
          主色会带动按钮、卡片与渐变；可以存多套配色随时切换，只存在本机浏览器。
        </p>
      </header>

      <Card>
        <SectionTitle>实时预览</SectionTitle>
        <div className="flex flex-wrap items-center gap-2">
          <Button>主按钮</Button>
          <Button variant="ghost">次要按钮</Button>
          <span className="rounded-full bg-brand-50 px-3 py-1 text-[11px] font-bold text-brand-800">标签</span>
          <span className="text-[11px] font-semibold text-ink-soft">正文色 {color}</span>
        </div>

        <div className="mt-3 flex overflow-hidden rounded-lg">
          {stops.map((s) => (
            <div key={s} className="h-7 flex-1" style={{ background: s === 700 ? color : shade(color, s) }} />
          ))}
        </div>
        <div className="mt-2 flex items-center gap-2">
          <div
            className="h-10 w-10 rounded-xl shadow"
            style={{ background: `linear-gradient(135deg, ${shade(color, 55)}, ${color})` }}
          />
          <div className="text-[10.5px] leading-tight text-ink-soft/60">
            50 · 100 · 200 … 900
            <br />
            深色按色阶自动压暗
          </div>
        </div>
      </Card>

      <Card>
        <SectionTitle>预设主题</SectionTitle>
        <div className="flex flex-wrap gap-2.5">
          {PRESETS.map((p) => {
            const on = p.color.toLowerCase() === color.toLowerCase()
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => use(p.color, p.id)}
                className={`flex items-center gap-2 rounded-full border px-2.5 py-1.5 text-[11.5px] font-bold transition ${
                  on ? 'border-brand-500 bg-brand-50 text-brand-800' : 'border-neutral-200 bg-white text-ink-soft'
                }`}
              >
                <span
                  className="h-4 w-4 rounded-full ring-1 ring-black/10"
                  style={{ background: p.color }}
                />
                {p.name}
              </button>
            )
          })}
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
          <Field label="自定义主色" hint="支持取色器和手输 6 位色号">
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={hexOk ? color : DEFAULT_COLOR}
                onChange={(e) => use(e.target.value)}
                className="h-9 w-12 cursor-pointer rounded-lg border border-brand-200 bg-white p-1"
              />
              <input
                className={inputCls}
                value={color}
                placeholder="#7c5cff"
                onChange={(e) => setColor(e.target.value)}
                onBlur={() => {
                  if (hexOk) use(color)
                  else toast('色号要写成 #RRGGBB', 'err')
                }}
              />
            </div>
          </Field>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => use(DEFAULT_COLOR)}>
              恢复默认
            </Button>
            <Button onClick={saveAs}>存为配色</Button>
          </div>
        </div>
      </Card>

      <Card>
        <SectionTitle>我的配色</SectionTitle>
        {list.length === 0 ? (
          <p className="text-[11.5px] leading-relaxed text-ink-soft/70">
            还没有保存过。选好主色后点「存为配色」，以后一键切换。
          </p>
        ) : (
          <div className="space-y-2">
            {list.map((t) => {
              const on = t.id === activeId
              return (
                <div
                  key={t.id}
                  className={`flex flex-wrap items-center gap-2 rounded-xl border px-3 py-2.5 ${
                    on ? 'border-brand-400 bg-brand-50/60' : 'border-neutral-200 bg-white'
                  }`}
                >
                  <span
                    className="h-6 w-6 shrink-0 rounded-full ring-1 ring-black/10"
                    style={{ background: t.color }}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-1.5 truncate text-[12px] font-bold text-ink">
                      {t.name}
                      {on && <Badge tone="ok">使用中</Badge>}
                    </p>
                    <p className="text-[10.5px] text-ink-soft/55">{t.color}</p>
                  </div>
                  <Button size="sm" variant={on ? 'ghost' : 'primary'} onClick={() => use(t.color, t.id)}>
                    {on ? '重新应用' : '应用'}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => rename(t)}>
                    改名
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => recolor(t)}>
                    改色
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => drop(t)}>
                    删除
                  </Button>
                </div>
              )
            })}
          </div>
        )}
        <p className="mt-3 text-[10.5px] text-ink-soft/50">
          当前生效：{activeId ? list.find((t) => t.id === activeId)?.name ?? '自定义' : '临时自定义'} {color}
        </p>
      </Card>
    </div>
  )
}

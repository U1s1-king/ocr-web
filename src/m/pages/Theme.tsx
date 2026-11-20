import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useToast } from '../../components/Toast'
import { DEFAULT_THEME, THEME_PRESETS, applyTheme, getThemeColor, presetOf } from '../theme'
import { activeThemeId, addTheme, loadThemes, removeTheme, applyTheme as applyBothTheme, type ThemeItem } from '../../lib/theme'
import { IcCheck, IcSpark } from '../icons'
import { confirmAction } from '../confirm'
import { Btn, Card, Page } from '../ui'

/** 视觉参照：docs/design-reference/vivo 应用配色页 */
export default function Theme() {
  const nav = useNavigate()
  const toast = useToast()
  const [theme, setTheme] = useState(getThemeColor())
  const [hex, setHex] = useState(getThemeColor().replace('#', '').toUpperCase())
  const [saved, setSaved] = useState<ThemeItem[]>(() => loadThemes())
  const [activeId, setActiveId] = useState(activeThemeId())

  function pick(color: string) {
    setTheme(color)
    setHex(color.replace('#', '').toUpperCase())
    applyTheme(color)
  }

  function saveScheme() {
    const nm = window.prompt('给这套配色起个名字', name)
    if (!nm) return
    const { list, item } = addTheme(nm, theme)
    setSaved(list)
    setActiveId(item.id)
    applyBothTheme(item.color, item.id)
    toast(`已保存配色「${item.name}」`, 'ok')
  }

  function useScheme(t: ThemeItem) {
    pick(t.color)
    applyBothTheme(t.color, t.id)
    setActiveId(t.id)
    toast(`已切换「${t.name}」`, 'ok')
  }

  async function dropScheme(t: ThemeItem) {
    if (!(await confirmAction('删除配色', `删除配色「${t.name}」？`))) return
    setSaved(removeTheme(t.id))
    if (activeId === t.id) setActiveId('')
    toast('已删除', 'ok')
  }

  function onHex(v: string) {
    const clean = v.replace(/[^0-9a-fA-F]/g, '').slice(0, 6).toUpperCase()
    setHex(clean)
    if (clean.length === 6) {
      const c = `#${clean.toLowerCase()}`
      setTheme(c)
      applyTheme(c)
    }
  }

  const name = presetOf(theme)?.name ?? '自定义色'

  return (
    <Page title="外观" sub="APPEARANCE" back>
      <Card className="!p-4">
        <div className="flex items-baseline gap-2">
          <p className="text-[14px] font-extrabold">主题色</p>
          <p className="mo-muted">只影响这台设备</p>
        </div>

        <div className="mt-3.5 grid grid-cols-2 gap-2">
          {THEME_PRESETS.map((p) => {
            const on = p.color.toLowerCase() === theme.toLowerCase()
            return (
              <button
                key={p.id}
                type="button"
                className="flex items-center gap-2.5 rounded-2xl border px-2.5 py-2.5 text-left transition active:scale-[.97]"
                style={{
                  borderColor: on ? p.color : 'transparent',
                  background: on ? `color-mix(in srgb, ${p.color} 8%, #fff)` : '#f5f6f8',
                }}
                onClick={() => pick(p.color)}
              >
                <span
                  className="grid h-8 w-8 flex-none place-items-center rounded-full text-white"
                  style={{ background: p.color }}
                >
                  {on && <IcCheck style={{ fontSize: 14 }} />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[12px] font-extrabold">{p.name}</span>
                  <span className="block text-[9px] font-bold tracking-wide text-ink-soft/70">
                    {p.color.toUpperCase()}
                  </span>
                </span>
              </button>
            )
          })}
        </div>
      </Card>

      <Card className="mt-3 !p-4">
        <div className="flex items-baseline gap-2">
          <p className="text-[14px] font-extrabold">自定义颜色</p>
          <p className="mo-muted">自己调一个</p>
        </div>

        <div className="mt-3 flex items-center gap-3">
          <label
            className="relative grid h-12 w-12 flex-none place-items-center overflow-hidden rounded-2xl border border-black/5"
            style={{ background: theme }}
            aria-label="打开取色器"
          >
            <input
              type="color"
              value={theme}
              onChange={(e) => pick(e.target.value)}
              className="absolute -left-2 -top-2 h-16 w-16 cursor-pointer border-0 bg-transparent p-0"
            />
            <IcSpark style={{ fontSize: 16, color: '#fff', mixBlendMode: 'difference' }} />
          </label>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 rounded-xl bg-[#f4f5f7] px-2.5 py-2">
              <span className="text-[12px] font-black text-ink-soft/70">#</span>
              <input
                value={hex}
                onChange={(e) => onHex(e.target.value)}
                inputMode="text"
                maxLength={6}
                placeholder="2B62F0"
                className="w-full bg-transparent text-[13px] font-black tracking-[.08em] uppercase outline-none placeholder:text-ink-soft/35"
                aria-label="输入十六进制颜色"
              />
            </div>
            <p className="mo-muted mt-1">点色块取色，或直接输入 6 位色号</p>
          </div>
        </div>
      </Card>


      <Card className="mt-3 !p-4">
        <div className="flex items-baseline gap-2">
          <p className="text-[14px] font-extrabold">我的配色</p>
          <p className="mo-muted">存多套随时换</p>
        </div>

        <div className="mt-2.5 space-y-2">
          {saved.length === 0 && <p className="mo-muted">还没有保存，选好颜色点下面「存为配色」。</p>}
          {saved.map((t) => {
            const on = t.id === activeId
            return (
              <div
                key={t.id}
                className="flex items-center gap-2 rounded-2xl border px-2.5 py-2"
                style={{ borderColor: on ? t.color : 'transparent', background: on ? `color-mix(in srgb, ${t.color} 8%, #fff)` : '#f5f6f8' }}
              >
                <span className="h-7 w-7 flex-none rounded-full ring-1 ring-black/10" style={{ background: t.color }} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[12px] font-extrabold">{t.name}</span>
                  <span className="block text-[9px] font-bold tracking-wide text-ink-soft/70">{t.color.toUpperCase()}</span>
                </span>
                <button
                  type="button"
                  className="rounded-lg px-2.5 py-1.5 text-[11px] font-extrabold text-white active:scale-[.97]"
                  style={{ background: t.color }}
                  onClick={() => useScheme(t)}
                >
                  {on ? '重新应用' : '应用'}
                </button>
                <button type="button" className="px-1.5 text-[11px] font-extrabold text-ink-soft/70" onClick={() => dropScheme(t)}>
                  删除
                </button>
              </div>
            )
          })}
        </div>

        <button
          type="button"
          className="mt-2.5 w-full rounded-2xl border border-brand-200 bg-white py-2.5 text-[12px] font-extrabold text-brand-700 active:scale-[.99]"
          onClick={saveScheme}
        >
          存为配色（{theme.toUpperCase()}）
        </button>
      </Card>

      <Card className="mt-3 !p-4">
        <p className="text-[13px] font-extrabold">预览</p>

        {/* 迷你版首页深色主卡，换色效果一眼看到 */}
        <div
          className="mt-2.5 overflow-hidden rounded-2xl px-3 py-3 text-white"
          style={{
            background: `radial-gradient(120% 120% at 88% 0%, color-mix(in srgb, ${theme} 72%, #fff) 0%, transparent 55%), linear-gradient(160deg, color-mix(in srgb, ${theme} 38%, #17191f) 0%, color-mix(in srgb, ${theme} 24%, #101216) 62%, color-mix(in srgb, ${theme} 15%, #0a0b0e) 100%)`,
          }}
        >
          <p className="text-[9px] font-extrabold tracking-[.18em] text-white/70">今日概览</p>
          <div className="mt-1.5 flex items-end gap-2">
            <p className="mo-num text-[26px] font-black leading-none">81</p>
            <div className="ml-auto flex gap-1.5">
              <span className="rounded-lg bg-white/20 px-2 py-1 text-[9px] font-extrabold">拍照识别</span>
              <span className="rounded-lg bg-white/20 px-2 py-1 text-[9px] font-extrabold">新建考试</span>
            </div>
          </div>
        </div>

        <div className="mt-3 flex items-center gap-2">
          <span className="rounded-full bg-brand-100 px-3 py-1.5 text-[11px] font-extrabold text-brand-700">
            选中态
          </span>
          <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-black/[.07]">
            <span className="block h-full w-2/3 rounded-full" style={{ background: theme }} />
          </span>
        </div>

        <div className="mt-3 flex gap-2">
          <Btn block onClick={() => toast(`当前主题：${name}`, 'ok')}>
            <IcSpark style={{ fontSize: 15 }} /> 主按钮
          </Btn>
          <Btn block variant="ghost" onClick={() => pick(DEFAULT_THEME)}>
            恢复默认
          </Btn>
        </div>
      </Card>

      <Card className="mt-3">
        <p className="text-[12px] font-extrabold">会跟着变的地方</p>
        <ul className="mo-muted mt-1.5 space-y-1">
          <li>· 首页深色大卡、圆环、进度条</li>
          <li>· 主按钮、选中态、底部导航高亮</li>
          <li>· 「我的」页头像渐变</li>
        </ul>
      </Card>

      <button
        type="button"
        className="mt-3 flex w-full items-center justify-center rounded-2xl bg-white py-3 text-[12px] font-extrabold text-ink-soft active:scale-[.99]"
        onClick={() => nav('/m/mine')}
      >
        回到我的
      </button>
    </Page>
  )
}

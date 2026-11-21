import { PageHeader } from '../components/PageHeader'
import { Badge, Card } from '../components/ui'
import { LogoMark } from '../components/Logo'
import { BRAND } from '../lib/brand'

const VERSION = BRAND.version.replace(/^v/, '')
const BUILD = '2026-11-19'

const STACK = [
  { k: '前端框架', v: 'React 19 + TypeScript' },
  { k: '构建工具', v: 'Vite 7' },
  { k: '样式方案', v: 'Tailwind CSS 4' },
  { k: '路由', v: 'React Router 7（Hash 模式）' },
  { k: '部署', v: 'Cloudflare Pages' },
  { k: '接口', v: 'REST /api/v1' },
]

const CHANGES = [
  { v: '1.1.0', at: '2026-11-11', list: ['侧栏改为可折叠 + 移动抽屉', '新增模板库、识别记录、检查说明等二级页', '统一页头与面包屑', '补全动效与按压反馈'] },
  { v: '1.0.0', at: '2026-11-10', list: ['试卷管理、编辑器、答题卡检查、学生管理、接口设置', 'SVG 可视化答题卡编辑器'] },
]

export default function AboutPage() {
  return (
    <div>
      <PageHeader
        title="关于系统"
        desc="版本信息、技术栈与更新日志。"
        crumb={[{ label: '系统设置', to: '/settings' }, { label: '关于系统' }]}
      />

      <Card className="anim-lift mb-4 overflow-hidden p-0">
        <div className="relative bg-gradient-to-br from-brand-500 to-brand-800 px-6 py-8 text-white">
          <div className="dot-grid absolute inset-0 opacity-20" />
          <div className="relative">
            <Badge tone="mute">{BRAND.pinyin}</Badge>
            <LogoMark mono className="mt-3 h-16 w-16" />
            <p className="mt-1 text-[11px] tracking-[0.2em] text-white/60">{BRAND.tagline}</p>
            <p className="mt-3 text-xs text-white/70">
              版本 {VERSION} · 构建于 {BUILD}
            </p>
          </div>
        </div>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card hover>
          <h3 className="mb-3 text-sm font-bold text-ink">技术栈</h3>
          <div className="stagger space-y-2">
            {STACK.map((s) => (
              <div key={s.k} className="flex items-center justify-between border-b border-brand-100/70 pb-1.5 text-xs last:border-0">
                <span className="text-ink-soft/70">{s.k}</span>
                <span className="font-semibold text-ink">{s.v}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card hover>
          <h3 className="mb-3 text-sm font-bold text-ink">更新日志</h3>
          <div className="space-y-3">
            {CHANGES.map((c) => (
              <div key={c.v}>
                <div className="flex items-baseline gap-2">
                  <span className="rounded-md bg-brand-100 px-1.5 py-0.5 text-[10px] font-bold text-brand-800">
                    v{c.v}
                  </span>
                  <span className="text-[10px] text-ink-soft/50">{c.at}</span>
                </div>
                <ul className="mt-1.5 space-y-1">
                  {c.list.map((l) => (
                    <li key={l} className="flex gap-1.5 text-[11.5px] leading-relaxed text-ink-soft">
                      <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-brand-400" />
                      {l}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  )
}

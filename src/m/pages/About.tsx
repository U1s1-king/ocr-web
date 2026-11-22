import { useNavigate } from 'react-router-dom'
import { BRAND } from '../../lib/brand'
import { LogoMark } from '../../components/Logo'
import { Btn, Card, Page } from '../ui'

/** 移动端关于：版本、技术栈、更新 */
export default function About() {
  const nav = useNavigate()
  return (
    <Page title="关于" sub={`${BRAND.name} · ${BRAND.version}`} back>
      <Card className="!p-5 text-center">
        <LogoMark className="mx-auto h-16 w-16" />
        <p className="mt-3 text-[18px] font-black text-ink">{BRAND.name}</p>
        <p className="mt-1 text-[10px] tracking-[0.25em] text-ink-soft/50">{BRAND.pinyin}</p>
        <p className="mt-2 text-[11px] text-ink-soft">{BRAND.tagline}</p>
        <p className="mt-3 text-[10px] text-ink-soft/50">版本 {BRAND.version}</p>
      </Card>

      <Card className="mt-3 !p-3">
        <p className="text-[12px] font-extrabold">技术栈</p>
        <div className="mt-2 space-y-1.5 text-[11px]">
          {[
            ['前端', 'React 19 + TypeScript'],
            ['构建', 'Vite 7'],
            ['样式', 'Tailwind CSS 4'],
            ['部署', 'Cloudflare Pages'],
            ['接口', 'REST /api/v1'],
          ].map(([k, v]) => (
            <div key={k} className="flex justify-between border-b border-line/60 pb-1.5 last:border-0">
              <span className="text-ink-soft">{k}</span><span className="font-bold text-ink">{v}</span>
            </div>
          ))}
        </div>
      </Card>

      <Card className="mt-3 !p-3">
        <p className="text-[12px] font-extrabold">当前功能</p>
        <ul className="mo-muted mt-1.5 space-y-1">
          <li>· 单面 / 双面答题卡设计与打印</li>
          <li>· 科目感知自动分页</li>
          <li>· 条形码标签设计、外部数据源</li>
          <li>· 拍照识别、批改、复核、成绩</li>
        </ul>
      </Card>

      <Btn block variant="ghost" onClick={() => nav('/m/mine')}>返回我的</Btn>
    </Page>
  )
}

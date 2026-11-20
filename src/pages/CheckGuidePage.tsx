import { PageHeader } from '../components/PageHeader'
import { Badge, Card } from '../components/ui'
import { CheckIcon, ExamIcon, ImageIcon, ScanIcon } from '../components/icons'

const STEPS = [
  {
    icon: ExamIcon,
    title: '先选对试卷',
    body: '识别前必须选定一份已保存内容的试卷。系统会用你配置的定位块、题号和写作区来对位，选错试卷结果一定不准。',
    tips: ['试卷内容为空时无法识别', '改过内容记得保存'],
  },
  {
    icon: ImageIcon,
    title: '上传图片',
    body: '一次可以选多张，单张不能达到或超过 10 MiB。拍摄时尽量正对答题卡、四角完整入镜、避免强反光。',
    tips: ['支持批量选择', '同一文件自动去重'],
  },
  {
    icon: ScanIcon,
    title: '等待识别',
    body: '服务端会做透视校正、涂卡判断与主观题区域切分。耗时和图片数量、分辨率相关，一般十几秒内完成。',
    tips: ['不要中途刷新页面', '失败条目会单独列出原因'],
  },
  {
    icon: CheckIcon,
    title: '核对结果',
    body: '结果按成功与失败分组展示，每张图可以展开看详细字段。有失败的先看是定位没找到还是涂卡读不出来。',
    tips: ['定位失败多为边界被裁切', '连续失败先检查试卷配置'],
  },
]

const ERRORS = [
  { code: 'CHECK_FAILED', text: '定位或识别失败，通常是四角不在画面内、透视变形过大。' },
  { code: 'FILE_TOO_LARGE', text: '文件体积达到或超过 10 MiB，先压缩再传。' },
  { code: 'EXAM_EMPTY', text: '试卷没有配置内容，先到编辑器里保存一次。' },
  { code: 'FILE_NOT_FOUND', text: '文件已被清理或不属于当前账号，重新上传即可。' },
]

export default function CheckGuidePage() {
  return (
    <div>
      <PageHeader
        title="检查说明"
        desc="四步流程、常见问题与错误码对照，第一次用建议先读一遍。"
        crumb={[{ label: '答题卡检查', to: '/check' }, { label: '检查说明' }]}
      />

      <div className="relative space-y-3">
        <div className="absolute top-6 bottom-6 left-[27px] w-px bg-gradient-to-b from-brand-200 via-brand-300 to-brand-100 sm:left-[31px]" />
        {STEPS.map((s, i) => (
          <Card key={s.title} hover className="anim-slide-right relative flex gap-4" >
            <div className="relative z-10 shrink-0">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-400 to-brand-700 text-white brand-shadow">
                <s.icon className="h-5 w-5" />
              </div>
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <Badge tone="mute">第 {i + 1} 步</Badge>
                <h3 className="text-sm font-bold text-ink">{s.title}</h3>
              </div>
              <p className="mt-1.5 text-xs leading-relaxed text-ink-soft">{s.body}</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {s.tips.map((t) => (
                  <span
                    key={t}
                    className="rounded-full bg-brand-50 px-2 py-0.5 text-[10.5px] font-medium text-brand-800"
                  >
                    {t}
                  </span>
                ))}
              </div>
            </div>
          </Card>
        ))}
      </div>

      <h3 className="mt-8 mb-3 text-sm font-bold text-ink">错误码对照</h3>
      <Card className="p-0">
        <div className="divide-y divide-brand-100">
          {ERRORS.map((e) => (
            <div key={e.code} className="group flex flex-col gap-1 px-4 py-3 transition hover:bg-brand-50/60 sm:flex-row sm:items-center sm:gap-4">
              <code className="w-fit rounded-md bg-ink/5 px-2 py-0.5 font-mono text-[11px] font-semibold text-ink-soft">
                {e.code}
              </code>
              <span className="text-xs leading-relaxed text-ink-soft">{e.text}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}

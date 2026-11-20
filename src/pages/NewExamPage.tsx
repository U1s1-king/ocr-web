import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageHeader } from '../components/PageHeader'
import { Button, Card, Field, SectionTitle, inputCls } from '../components/ui'
import { useToast } from '../components/Toast'
import { errorText } from '../api/client'
import { validateExamName } from '../lib/exam'
import { examsApi, papersApi, type PaperSummary } from '../m/api'
import { ArrowLeftIcon, SaveIcon } from '../components/icons'

const PRESETS = [
  { label: '2026 秋季期中 · 数学', name: '2026 秋季期中 · 数学' },
  { label: '2026 秋季期中 · 语文', name: '2026 秋季期中 · 语文' },
  { label: '月度月考 · 第 1 次', name: '月度月考 · 第 1 次' },
  { label: '随堂小测', name: '随堂小测' },
]

export default function NewExamPage() {
  const nav = useNavigate()
  const toast = useToast()
  const [name, setName] = useState('')
  const [papers, setPapers] = useState<PaperSummary[]>([])
  const [paperId, setPaperId] = useState<number | ''>('')
  const [busy, setBusy] = useState(false)

  const err = name ? validateExamName(name) : null
  const ok = !!name && !err

  useEffect(() => {
    papersApi
      .list()
      .then((list) => {
        setPapers(list)
        if (list.length === 1) setPaperId(list[0].id)
      })
      .catch(() => setPapers([]))
  }, [])

  async function submit() {
    const e = validateExamName(name)
    if (e) {
      toast(e, 'err')
      return
    }
    setBusy(true)
    try {
      const created = await examsApi.create(name.trim(), paperId ? Number(paperId) : 0)
      toast(`已创建考试「${created.name}」`, 'ok')
      nav(`/exams/${created.id}`)
    } catch (e) {
      toast(errorText(e), 'err')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="anim-fade-up mx-auto max-w-xl">
      <PageHeader
        title="新建考试"
        desc="考试只负责「什么时候、考哪张卷」，试卷的版式与答案键在试卷模块里独立维护。"
        crumb={[{ label: '考试管理', to: '/exams' }, { label: '新建考试' }]}
        extra={
          <Button variant="ghost" size="sm" onClick={() => nav('/exams')}>
            <ArrowLeftIcon className="h-3.5 w-3.5" />
            返回列表
          </Button>
        }
      />

      <Card hover>
        <Field label="考试名称" hint="1–100 个字符，不能与已有考试重名">
          <input
            className={inputCls}
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && ok) void submit()
            }}
            placeholder="例如：2026 秋季期中 · 数学"
            maxLength={100}
            autoFocus
          />
        </Field>

        <div className="mt-1.5 flex items-center justify-between text-[11px]">
          <span className={err ? 'text-red-600' : 'text-ink-soft/50'}>{err ?? ' '}</span>
          <span className="tabnum text-ink-soft/40">{name.length}/100</span>
        </div>

        <SectionTitle>绑定试卷（可选）</SectionTitle>
        {papers.length === 0 ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-[11.5px] font-semibold text-amber-800">
            还没有可用试卷，先去{' '}
            <button
              type="button"
              onClick={() => nav('/papers')}
              className="font-bold text-brand-700 underline underline-offset-2"
            >
              试卷库
            </button>{' '}
            建一张。
          </div>
        ) : (
          <select
            value={paperId}
            onChange={(e) => setPaperId(e.target.value ? Number(e.target.value) : '')}
            className={inputCls}
          >
            <option value="">暂不绑定，稍后再选</option>
            {papers.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}（#{p.id}）
              </option>
            ))}
          </select>
        )}

        <SectionTitle>常用命名</SectionTitle>
        <div className="stagger flex flex-wrap gap-1.5">
          {PRESETS.map((p) => (
            <button
              key={p.name}
              type="button"
              onClick={() => setName(p.name)}
              className="btn-press rounded-full border border-brand-200 bg-brand-50/60 px-3 py-1.5 text-[11px] font-semibold text-brand-800 hover:border-brand-300 hover:bg-brand-100"
            >
              {p.label}
            </button>
          ))}
        </div>

        <div className="mt-6 flex items-center justify-end gap-2">
          <Button variant="ghost" onClick={() => nav('/exams')}>
            取消
          </Button>
          <Button disabled={!ok || busy} onClick={submit}>
            <SaveIcon className="h-3.5 w-3.5" />
            {busy ? '创建中…' : '创建考试'}
          </Button>
        </div>
      </Card>

      <p className="mt-4 text-center text-[11px] text-ink-soft/50">
        还没有试卷？先去{' '}
        <button
          type="button"
          onClick={() => nav('/papers')}
          className="font-semibold text-brand-700 underline-offset-2 hover:underline"
        >
          试卷库
        </button>{' '}
        创建一张，再来这里绑定
      </p>
    </div>
  )
}

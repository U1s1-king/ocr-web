import { useEffect, useState } from 'react'
import { PageHeader } from '../components/PageHeader'
import { Badge, Button, Card } from '../components/ui'
import { questionsApi, errorText, type BankQuestion } from '../m/api'

const SUBJECTS = ['全部', '语文', '数学', '英语', '物理', '化学', '生物', '历史', '地理', '政治']
const TYPES = ['全部', '客观', '主观']

/** 只读题库浏览：GET /api/v1/questions */
export default function QuestionBankPage() {
  const [subject, setSubject] = useState('全部')
  const [type, setType] = useState('全部')
  const [offset, setOffset] = useState(0)
  const [limit] = useState(20)
  const [items, setItems] = useState<BankQuestion[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')

  useEffect(() => {
    let alive = true
    setLoading(true)
    setErr('')
    questionsApi
      .list({
        subject: subject === '全部' ? undefined : subject,
        type: type === '全部' ? undefined : type,
        offset,
        limit,
      })
      .then((r) => {
        if (!alive) return
        setItems(r.items ?? [])
        setTotal(r.total ?? 0)
      })
      .catch((e) => {
        if (alive) setErr(errorText(e))
      })
      .finally(() => {
        if (alive) setLoading(false)
      })
    return () => {
      alive = false
    }
  }, [subject, type, offset, limit])

  return (
    <div>
      <PageHeader
        title="题库"
        desc="只读题库，支持按学科、题型分页浏览；数据来自 GET /api/v1/questions。"
        crumb={[{ label: '试卷库', to: '/papers' }, { label: '题库' }]}
        extra={<Badge tone="brand">{total} 道</Badge>}
      />

      <Card className="!p-3">
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={subject}
            onChange={(e) => { setSubject(e.target.value); setOffset(0) }}
            className="rounded-lg border border-brand-200 bg-white px-2.5 py-1.5 text-[12px] font-semibold"
          >
            {SUBJECTS.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <select
            value={type}
            onChange={(e) => { setType(e.target.value); setOffset(0) }}
            className="rounded-lg border border-brand-200 bg-white px-2.5 py-1.5 text-[12px] font-semibold"
          >
            {TYPES.map((t) => <option key={t} value={t}>{t === '全部' ? '全部题型' : t}</option>)}
          </select>
          <span className="text-[10.5px] text-ink-soft/55">第 {Math.floor(offset / limit) + 1} 页</span>
          <div className="ml-auto flex gap-1.5">
            <Button variant="ghost" size="sm" disabled={offset === 0} onClick={() => setOffset((v) => Math.max(0, v - limit))}>上一页</Button>
            <Button variant="ghost" size="sm" disabled={offset + limit >= total} onClick={() => setOffset((v) => v + limit)}>下一页</Button>
          </div>
        </div>
      </Card>

      {err && <Card className="!p-4 text-[12px] text-red-600">{err}</Card>}
      {loading ? (
        <Card className="!p-4 text-[12px] text-ink-soft/60">正在加载题库…</Card>
      ) : (
        <div className="space-y-2">
          {items.map((q) => (
            <Card key={q.id} className="!p-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[10px] font-black text-brand-700">#{q.id}</span>
                <span className="rounded bg-brand-50 px-1.5 py-0.5 text-[9.5px] font-bold text-brand-700">{q.subject}</span>
                <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-[9.5px] font-bold text-ink-soft/60">{q.type}</span>
              </div>
              <p className="mt-2 whitespace-pre-wrap text-[12.5px] font-semibold leading-relaxed text-ink">{q.question}</p>
              {q.answer && <p className="mt-1.5 text-[11px] text-brand-700">答案：{q.answer}</p>}
              {q.analysis && <p className="mt-1 text-[10.5px] text-ink-soft/55">解析：{q.analysis}</p>}
            </Card>
          ))}
          {!items.length && !err && <Card className="!p-4 text-[12px] text-ink-soft/60">没有匹配的题目。</Card>}
        </div>
      )}
    </div>
  )
}

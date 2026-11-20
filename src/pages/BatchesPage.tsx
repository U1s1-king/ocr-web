import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageHeader, StatTile } from '../components/PageHeader'
import { Button, Card, Empty, Field, inputCls } from '../components/ui'
import { AlertIcon, CloseIcon, EditIcon, PlusIcon, TrashIcon } from '../components/icons'
import { useConfirm } from '../components/Confirm'
import { useToast } from '../components/Toast'
import { batchesApi, examsApi, type ExamBatch, type ExamSummary } from '../m/api'

export default function BatchesPage() {
  const nav = useNavigate()
  const toast = useToast()
  const confirm = useConfirm()

  const [batches, setBatches] = useState<ExamBatch[]>([])
  const [exams, setExams] = useState<ExamSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [tick, setTick] = useState(0)

  const [editing, setEditing] = useState<ExamBatch | 'new' | null>(null)
  const [name, setName] = useState('')
  const [ids, setIds] = useState<number[]>([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let alive = true
    setLoading(true)
    Promise.all([batchesApi.list(), examsApi.list()])
      .then(([b, e]) => {
        if (!alive) return
        setBatches(b)
        setExams(e)
        setError('')
      })
      .catch((err) => alive && setError(err instanceof Error ? err.message : '加载失败'))
      .finally(() => alive && setLoading(false))
    return () => {
      alive = false
    }
  }, [tick])

  function openEditor(b: ExamBatch | 'new') {
    setEditing(b)
    setName(b === 'new' ? '' : b.name)
    setIds(b === 'new' ? [] : b.examIds)
  }

  async function save() {
    if (!name.trim()) {
      toast('批次名不能为空', 'err')
      return
    }
    setSaving(true)
    try {
      if (editing && editing !== 'new') await batchesApi.update(editing.id, name.trim(), ids)
      else await batchesApi.create(name.trim(), ids)
      toast('批次已保存', 'ok')
      setEditing(null)
      setTick((t) => t + 1)
    } catch (e) {
      toast(e instanceof Error ? e.message : '保存失败', 'err')
    } finally {
      setSaving(false)
    }
  }

  async function remove(b: ExamBatch) {
    const ok = await confirm({
      title: `删除批次「${b.name}」？`,
      description: '只删除批次关系，考试与成绩都会保留。',
      confirmText: '删除批次',
      tone: 'danger',
    })
    if (!ok) return
    try {
      await batchesApi.remove(b.id)
      toast('批次已删除', 'ok')
      setTick((t) => t + 1)
    } catch (e) {
      toast(e instanceof Error ? e.message : '删除失败', 'err')
    }
  }

  const totalExams = batches.reduce((s, b) => s + b.examCount, 0)

  return (
    <div>
      <PageHeader
        title="考试批次"
        desc="把期中、期末这类多场考试打包成一个批次，成绩页就能按批次汇总查看。"
        crumb={[{ label: '首页', to: '/exams' }, { label: '试卷管理', to: '/exams' }, { label: '考试批次' }]}
        extra={<Button onClick={() => openEditor('new')}><PlusIcon className="h-4 w-4" /> 新建批次</Button>}
      />

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="批次数" value={batches.length} />
        <StatTile label="涉及考试" value={totalExams} delay={60} />
        <StatTile label="考试总数" value={exams.length} delay={120} />
        <StatTile label="未归类" value={Math.max(0, exams.length - totalExams)} tone="warn" delay={180} />
      </div>

      {error && false && (
        <div className="mb-4 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-[12px] text-red-600">
          <AlertIcon className="h-4 w-4" />
          {error}
        </div>
      )}

      {editing && (
        <Card className="mb-5">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-[14px] font-bold text-ink">{editing === 'new' ? '新建批次' : '编辑批次'}</h3>
            <button
              type="button"
              aria-label="关闭"
              className="rounded-lg p-1.5 text-ink-soft/60 hover:bg-brand-50"
              onClick={() => setEditing(null)}
            >
              <CloseIcon className="h-4 w-4" />
            </button>
          </div>

          <Field label="批次名">
            <input
              className={inputCls}
              value={name}
              placeholder="例如：2026 高一期中"
              onChange={(e) => setName(e.target.value)}
            />
          </Field>

          <p className="mt-4 mb-2 text-[11.5px] font-semibold text-ink-soft">包含的考试 · 已选 {ids.length}</p>
          <div className="max-h-[280px] space-y-1 overflow-y-auto rounded-xl border border-brand-100 p-1.5">
            {exams.length === 0 && <p className="p-3 text-center text-[12px] text-ink-soft">先创建考试，才能组批次</p>}
            {exams.map((e) => {
              const on = ids.includes(e.id)
              return (
                <button
                  key={e.id}
                  type="button"
                  onClick={() =>
                    setIds((prev) => (prev.includes(e.id) ? prev.filter((x) => x !== e.id) : [...prev, e.id]))
                  }
                  className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-[12.5px] transition ${
                    on ? 'bg-brand-100 text-brand-800' : 'text-ink-soft hover:bg-brand-50'
                  }`}
                >
                  <span
                    className={`grid h-4 w-4 shrink-0 place-items-center rounded border ${
                      on ? 'border-brand-600 bg-brand-600 text-white' : 'border-brand-300'
                    }`}
                  >
                    {on && <span className="text-[9px] leading-none">✓</span>}
                  </span>
                  <span className="min-w-0 flex-1 truncate font-medium">{e.name}</span>
                  <span className="shrink-0 text-[11px] text-ink-soft/70">{e.resultCount} 份</span>
                </button>
              )
            })}
          </div>

          <div className="mt-4 flex gap-2">
            <Button disabled={saving} onClick={save}>
              {saving ? '保存中…' : '保存批次'}
            </Button>
            <Button variant="ghost" onClick={() => setEditing(null)}>
              取消
            </Button>
          </div>
        </Card>
      )}

      {loading && batches.length === 0 ? (
        <div className="grid gap-3 md:grid-cols-2">
          {[0, 1].map((i) => (
            <div key={i} className="h-32 animate-pulse rounded-2xl border border-brand-200/70 bg-white" />
          ))}
        </div>
      ) : batches.length === 0 ? (
        <Empty title="还没有批次" hint="把多场考试打包，成绩分析就能按批次看" action={<Button onClick={() => openEditor('new')}>新建批次</Button>} />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {batches.map((b) => {
            const inside = exams.filter((e) => b.examIds.includes(e.id))
            return (
              <Card key={b.id} className="flex flex-col">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-[14px] font-bold text-ink">{b.name}</p>
                    <p className="mt-0.5 text-[11.5px] text-ink-soft">
                      #{b.id} · {b.examCount} 场考试
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <button
                      type="button"
                      aria-label="编辑"
                      className="rounded-lg p-1.5 text-ink-soft/70 hover:bg-brand-50 hover:text-brand-700"
                      onClick={() => openEditor(b)}
                    >
                      <EditIcon className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      aria-label="删除"
                      className="rounded-lg p-1.5 text-ink-soft/70 hover:bg-red-50 hover:text-red-600"
                      onClick={() => void remove(b)}
                    >
                      <TrashIcon className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <div className="mt-3 flex-1 space-y-1">
                  {inside.length === 0 && <p className="text-[11.5px] text-ink-soft">批次里的考试都被删了</p>}
                  {inside.slice(0, 4).map((e) => (
                    <button
                      key={e.id}
                      type="button"
                      onClick={() => nav(`/m/exams/${e.id}`)}
                      className="flex w-full items-center gap-2 rounded-lg bg-brand-50/70 px-2.5 py-1.5 text-left text-[12px] text-ink hover:bg-brand-100"
                    >
                      <span className="min-w-0 flex-1 truncate">{e.name}</span>
                      <span className="shrink-0 text-[10.5px] text-ink-soft/70">{e.resultCount} 份</span>
                    </button>
                  ))}
                  {inside.length > 4 && (
                    <p className="pl-2.5 text-[11px] text-ink-soft/70">还有 {inside.length - 4} 场…</p>
                  )}
                </div>

                <button
                  type="button"
                  className="mt-3 self-start text-[11.5px] font-semibold text-brand-700 hover:underline"
                  onClick={() => nav('/results')}
                >
                  按批次看成绩 →
                </button>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}

import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { errorText } from '../api/client'
import { deleteExam, getExam } from '../api/exams'
import type { ExamSummary } from '../api/types'
import { useConfirm } from '../components/Confirm'
import { useToast } from '../components/Toast'
import { ChevronRightIcon, EditIcon, PlusIcon, TrashIcon } from '../components/icons'
import { Badge, Button, Card, Empty } from '../components/ui'
import { PageHeader } from '../components/PageHeader'

const LS_INDEX = 'ac.examIndex'

/** 本地维护的试卷 id 索引（后端未提供列表接口） */
export function readIndex(): { id: number; name: string }[] {
  try {
    const raw = localStorage.getItem(LS_INDEX)
    return raw ? (JSON.parse(raw) as { id: number; name: string }[]) : []
  } catch {
    return []
  }
}

export function writeIndex(list: { id: number; name: string }[]) {
  localStorage.setItem(LS_INDEX, JSON.stringify(list))
}

export function upsertIndex(id: number, name: string) {
  const list = readIndex().filter((x) => x.id !== id)
  list.unshift({ id, name })
  writeIndex(list)
}

export function removeIndex(id: number) {
  writeIndex(readIndex().filter((x) => x.id !== id))
}

type Row = { id: number; name: string; exam: ExamSummary['exam'] | null }

export default function ExamsPage() {
  const nav = useNavigate()
  const toast = useToast()
  const confirm = useConfirm()

  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')

  async function load() {
    setLoading(true)
    const list = readIndex()
    const out: Row[] = []
    for (const item of list) {
      try {
        const e = await getExam(item.id)
        out.push({ id: e.id, name: e.name, exam: e.exam })
      } catch {
        out.push({ id: item.id, name: item.name, exam: null })
      }
    }
    setRows(out)
    setLoading(false)
  }

  useEffect(() => {
    void load()
  }, [])

  async function handleDelete(id: number, examName: string) {
    const ok = await confirm({
      title: `删除试卷「${examName}」？`,
      description: '删除后试卷配置不可恢复，已上传的图片文件不受影响。',
      confirmText: '删除',
      tone: 'danger',
    })
    if (!ok) return
    try {
      await deleteExam(id)
      removeIndex(id)
      toast('已删除试卷', 'ok')
      await load()
    } catch (e) {
      toast(errorText(e), 'err')
    }
  }

  const filtered = query.trim()
    ? rows.filter((r) => r.name.toLowerCase().includes(query.trim().toLowerCase()) || String(r.id) === query.trim())
    : rows

  const configured = rows.filter((r) => r.exam && Object.keys(r.exam).length > 0).length

  return (
    <div>
      <PageHeader
        title="试卷管理"
        desc="这里的每一份试卷对应一套答题卡版式，检查时会按所选试卷的配置做对位与判读。"
        extra={
          <>
            <Button variant="ghost" size="sm" onClick={() => nav('/exams/templates')}>
              模板库
            </Button>
            <Button size="sm" onClick={() => nav('/exams/new')}>
              <PlusIcon className="h-3.5 w-3.5" />
              新建试卷
            </Button>
          </>
        }
      />

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 sm:max-w-xs">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜索名称或 id"
            className="w-full rounded-xl border border-brand-200 bg-white px-3 py-2 text-xs outline-none transition placeholder:text-ink-soft/40 focus:border-brand-400 focus:ring-4 focus:ring-brand-200/60"
          />
        </div>
        <div className="flex items-center gap-2 text-[11px] text-ink-soft/60">
          <Badge tone="mute">共 {rows.length} 份</Badge>
          <Badge tone={configured ? 'ok' : 'mute'}>已配置 {configured}</Badge>
        </div>
      </div>

      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {[0, 1, 2, 3].map((i) => (
            <Card key={i} className="anim-lift">
              <div className="skel h-4 w-1/2" />
              <div className="skel mt-3 h-3 w-1/3" />
              <div className="skel mt-5 h-8 w-full" />
            </Card>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Empty
          title={query ? '没有匹配的试卷' : '还没有试卷'}
          hint={query ? '换个关键词试试，或者清空搜索框。' : '新建一份试卷，或者从模板库里挑个现成版式起步。'}
          action={
            !query && (
              <Button size="sm" onClick={() => nav('/exams/new')}>
                <PlusIcon className="h-3.5 w-3.5" />
                新建试卷
              </Button>
            )
          }
        />
      ) : (
        <div className="stagger grid gap-3 sm:grid-cols-2">
          {filtered.map((r) => {
            const blank = !r.exam || Object.keys(r.exam).length === 0
            const qs = blank ? 0 : ((r.exam as { questions?: unknown[] }).questions?.length ?? 0)
            return (
              <Card key={r.id} hover className="group flex flex-col">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[11px] text-ink-soft/50">#{r.id}</span>
                      <h3 className="truncate text-sm font-bold text-ink">{r.name}</h3>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {r.exam === null ? (
                        <Badge tone="err">读取失败</Badge>
                      ) : blank ? (
                        <Badge tone="warn">未配置</Badge>
                      ) : (
                        <Badge tone="ok">已配置 · {qs} 题</Badge>
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDelete(r.id, r.name)}
                    className="btn-press rounded-xl p-2 text-ink-soft/40 transition hover:bg-red-50 hover:text-red-500"
                    title="删除试卷"
                  >
                    <TrashIcon className="h-4 w-4" />
                  </button>
                </div>

                <div className="mt-4 flex gap-2">
                  <Link
                    to={`/exams/${r.id}`}
                    className="btn-press flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-brand-600 px-3 py-2 text-xs font-semibold text-white shadow-soft hover:bg-brand-700"
                  >
                    <EditIcon className="h-3.5 w-3.5" />
                    {blank ? '开始配置' : '编辑内容'}
                  </Link>
                  <Link
                    to={`/check?examId=${r.id}`}
                    className="btn-press flex items-center justify-center gap-1.5 rounded-xl border border-brand-200 bg-white px-3 py-2 text-xs font-semibold text-ink-soft hover:bg-brand-50"
                  >
                    检查
                    <ChevronRightIcon className="h-3 w-3" />
                  </Link>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      <p className="mt-6 text-center text-[11px] leading-relaxed text-ink-soft/45">
        后端未提供试卷列表接口，列表由本浏览器创建的记录维护；换设备后可输入 id 直接访问编辑器。
      </p>
    </div>
  )
}

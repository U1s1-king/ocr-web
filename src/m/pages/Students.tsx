import { useMemo, useState } from 'react'
import { useConfirm } from '../../components/Confirm'
import { useToast } from '../../components/Toast'
import { studentsApi, type Student } from '../api'
import { IcAlert, IcPlus, IcSearch, IcSpark, IcTrash, IcUsers, IcX } from '../icons'
import {
  Btn,
  Card,
  CheckDot,
  DemoTag,
  Empty,
  ErrorBar,
  ListSkeleton,
  Page,
  Row,
  Sheet,
  StatTile,
  useLoad,
} from '../ui'

export default function Students() {
  const toast = useToast()
  const confirm = useConfirm()

  const [q, setQ] = useState('')
  const [picked, setPicked] = useState<number[]>([])
  const [importOpen, setImportOpen] = useState(false)
  const [text, setText] = useState('')
  const [saving, setSaving] = useState(false)

  const list = useLoad<Student[]>(() => studentsApi.list(), [] as Student[], [], 'students.list')

  const filtered = useMemo(
    () =>
      list.data.filter(
        (s) =>
          !q ||
          s.name.includes(q) ||
          (s.candidateNumber ?? '').includes(q) ||
          (s.className ?? '').includes(q),
      ),
    [list.data, q],
  )

  const parsed = useMemo(() => parseStudents(text), [text])

  async function addAll() {
    if (parsed.length === 0) {
      toast('没解析出学生，检查一下格式', 'err')
      return
    }
    setSaving(true)
    try {
      const res = await studentsApi.add(parsed)
      toast(`已导入 ${res.count ?? parsed.length} 名学生`, 'ok')
      setImportOpen(false)
      setText('')
      list.reload()
    } catch (err) {
      toast(err instanceof Error ? err.message : '导入失败', 'err')
    } finally {
      setSaving(false)
    }
  }

  async function removePicked() {
    const ok = await confirm({
      title: `删除 ${picked.length} 名学生？`,
      description: '已经批改出的成绩不会受影响。',
      confirmText: '删除',
      tone: 'danger',
    })
    if (!ok) return
    try {
      await studentsApi.remove(picked)
      toast('已删除', 'ok')
      setPicked([])
      list.reload()
    } catch (err) {
      toast(err instanceof Error ? err.message : '删除失败', 'err')
    }
  }

  function toggle(id?: number, index?: number) {
    const key = id ?? -(index ?? 0) - 1
    setPicked((prev) => (prev.includes(key) ? prev.filter((x) => x !== key) : [...prev, key]))
  }

  return (
    <Page
      title="学生名单"
      sub="STUDENTS"
      back
      actions={
        <div className="flex gap-2">
          {list.demo && <DemoTag />}
          <button type="button" className="mo-icon-btn" aria-label="导入" onClick={() => setImportOpen(true)}>
            <IcPlus style={{ fontSize: 18 }} />
          </button>
        </div>
      }
    >
      <div className="relative">
        <IcSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-brand-400" style={{ fontSize: 16 }} />
        <input
          className="mo-input pl-10"
          placeholder="搜索姓名 / 考号 / 班级"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      {list.error && (
        <div className="mt-3">
          <ErrorBar text={list.error} onRetry={list.reload} />
        </div>
      )}

      <div className="mo-tiles mt-3">
        <StatTile num={list.data.length} label="学生总数" delay={1} />
        <StatTile num={new Set(list.data.map((s) => s.className).filter(Boolean)).size} label="班级数" delay={2} />
      </div>

      <div className="mt-3 flex items-center gap-2">
        <p className="mo-eyebrow">名单</p>
        {picked.length > 0 && (
          <button
            type="button"
            className="ml-auto flex items-center gap-1 text-[10.5px] font-extrabold text-brand-700"
            onClick={() => void removePicked()}
          >
            <IcTrash style={{ fontSize: 12 }} /> 删除所选 {picked.length}
          </button>
        )}
      </div>

      <div className="mt-2">
        {list.loading ? (
          <ListSkeleton rows={6} />
        ) : filtered.length === 0 ? (
          <Empty
            icon={<IcUsers style={{ fontSize: 24 }} />}
            title={q ? '没有这个学生' : '名单还是空的'}
            tip={q ? '试试考号或班级' : '支持一行一个，或粘贴整张名单'}
            action={
              !q && (
                <Btn onClick={() => setImportOpen(true)}>
                  <IcPlus style={{ fontSize: 16 }} /> 批量导入
                </Btn>
              )
            }
          />
        ) : (
          <div className="mo-rows">
            {filtered.map((s, i) => {
              const key = s.id ?? -i - 1
              return (
                <Row
                  key={key}
                  icon={<IcUsers style={{ fontSize: 17 }} />}
                  title={s.name}
                  sub={`${s.candidateNumber ?? '无考号'} · ${s.className ?? '未分班'}${s.grade ? ` · ${s.grade}` : ''}`}
                  right={
                    <button
                      type="button"
                      aria-label="选择"
                      onClick={(e) => {
                        e.stopPropagation()
                        toggle(s.id, i)
                      }}
                    >
                      <CheckDot on={picked.includes(key)} />
                    </button>
                  }
                  onClick={() => toggle(s.id, i)}
                />
              )
            })}
          </div>
        )}
      </div>

      <Sheet
        open={importOpen}
        onClose={() => setImportOpen(false)}
        title="批量导入学生"
        footer={
          <Btn block disabled={saving || parsed.length === 0} onClick={addAll}>
            {saving ? '导入中…' : `导入 ${parsed.length} 名学生`}
          </Btn>
        }
      >
        <div className="space-y-3">
          <label className="mo-field">
            <span className="mo-field-label">每行一个学生</span>
            <textarea
              className="mo-input min-h-[150px] resize-none py-2.5 leading-relaxed"
              placeholder={'张三,20260001,1班\n李四 20260002 1班\n王五,20260003,2班'}
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
          </label>
          <div className="flex items-center gap-2">
            <span className="mo-badge" data-tone={parsed.length ? 'ok' : 'warn'}>
              已解析 {parsed.length} 人
            </span>
            {parsed.length > 0 && (
              <span className="mo-muted truncate">{parsed.slice(0, 3).map((s) => s.name).join('、')}…</span>
            )}
          </div>
          {parsed.length > 0 && (
            <div className="mo-rows max-h-[150px] overflow-y-auto">
              {parsed.slice(0, 12).map((s, i) => (
                <Row
                  key={`${s.name}-${i}`}
                  title={s.name}
                  sub={`${s.candidateNumber ?? '无考号'} · ${s.className ?? '未分班'}`}
                />
              ))}
            </div>
          )}
          <div className="rounded-2xl bg-brand-50 p-3">
            <p className="flex items-center gap-1.5 text-[11px] font-extrabold text-brand-800">
              <IcSpark style={{ fontSize: 14 }} /> 支持逗号、空格、制表符
            </p>
            <p className="mo-muted mt-1">顺序是「姓名 考号 班级」，考号和班级可以省略。</p>
          </div>
          <button
            type="button"
            className="flex items-center gap-1.5 text-[11px] font-extrabold text-brand-700/70"
            onClick={() => setText('')}
          >
            <IcX style={{ fontSize: 12 }} /> 清空
          </button>
        </div>
      </Sheet>

      {list.demo && (
        <p className="mt-4 flex items-center gap-1.5 text-[10px] text-ink-soft/50">
          <IcAlert style={{ fontSize: 12 }} /> 演示模式：后端没有名单接口时写操作会失败
        </p>
      )}

      <Card className="mt-3">
        <p className="text-[11.5px] font-extrabold">名单只是对照表</p>
        <p className="mo-muted mt-1">
          批改时用考号匹配学生，不会改写答题卡上的识别结果。
        </p>
      </Card>
    </Page>
  )
}

function parseStudents(raw: string): Student[] {
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const parts = line.split(/[,，\t]+|\s{1,}/).filter(Boolean)
      const [name, candidateNumber, className, grade, major] = parts
      return {
        name,
        candidateNumber: candidateNumber || undefined,
        className: className || undefined,
        grade: grade || undefined,
        major: major || undefined,
      }
    })
    .filter((s) => s.name)
}

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useConfirm } from '../../components/Confirm'
import { useToast } from '../../components/Toast'
import { batchesApi, examsApi, type ExamBatch, type ExamSummary } from '../api'
import { MODULE_TONE } from '../../lib/modules'
import { IcAlert, IcCalendar, IcLayers, IcPlus, IcTrash } from '../icons'
import { Btn, CheckDot, Empty, ErrorBar, Page, Sheet, fmtTime, useLoad } from '../ui'
import { StatsStrip } from '../StatsStrip'

/** 「批次」三级页：把多场考试组合成一个可复用的筛选集合 */
export default function Batches() {
  const nav = useNavigate()
  const toast = useToast()
  const confirm = useConfirm()
  const [sheet, setSheet] = useState<{ open: boolean; editing?: ExamBatch }>({ open: false })

  const exams = useLoad<ExamSummary[]>(() => examsApi.list(), [] as ExamSummary[], [], 'exams.list')
  const batches = useLoad<ExamBatch[]>(() => batchesApi.list(), [] as ExamBatch[], [], 'batches.list')
  const tone = MODULE_TONE.green

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
      batches.reload()
    } catch (err) {
      toast(err instanceof Error ? err.message : '删除失败', 'err')
    }
  }

  return (
    <Page
      title="考试批次"
      sub={`${batches.data.length} 个批次`}
      back
      actions={
        <button type="button" className="mo-icon-btn" aria-label="新建批次" onClick={() => setSheet({ open: true })}>
          <IcPlus style={{ fontSize: 17 }} />
        </button>
      }
    >
      <StatsStrip
        className="mb-3"
        items={[
          { label: '批次', value: batches.data.length },
          { label: '考试', value: exams.data.length },
          { label: '已归档', value: batches.data.filter((b) => b.examIds?.length).length },
        ]}
      />

      {batches.error && (
        <div className="mb-3">
          <ErrorBar text={batches.error} onRetry={batches.reload} />
        </div>
      )}

      {batches.data.length === 0 ? (
        <Empty
          icon={<IcLayers style={{ fontSize: 22 }} />}
          title="还没有批次"
          tip="把期中、期末这类多场考试打包，成绩页就能按批次看"
        />
      ) : (
        <div className="space-y-2.5">
          {batches.data.map((b, i) => {
            const inside = exams.data.filter((e) => b.examIds.includes(e.id))
            return (
              <div key={b.id} className="mo-stagger rounded-[18px] bg-white p-3.5" style={{ '--i': i } as React.CSSProperties}>
                <div className="flex items-start gap-2.5">
                  <span
                    className="grid h-9 w-9 flex-none place-items-center rounded-[11px]"
                    style={{ background: tone.bg, color: tone.fg }}
                  >
                    <IcLayers style={{ fontSize: 16 }} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] font-semibold text-ink">{b.name}</p>
                    <p className="mt-0.5 text-[11px] text-ink-soft">
                      #{b.id} · {b.examCount} 场考试 · {fmtTime(b.uTime)}
                    </p>
                  </div>
                  <button
                    type="button"
                    aria-label="删除批次"
                    className="grid h-8 w-8 flex-none place-items-center rounded-lg text-ink-soft/60 active:bg-[#f7f8fa]"
                    onClick={() => void remove(b)}
                  >
                    <IcTrash style={{ fontSize: 15 }} />
                  </button>
                </div>

                <div className="mt-2.5 space-y-1">
                  {inside.length === 0 && <p className="text-[11.5px] text-ink-soft">批次里的考试都被删了</p>}
                  {inside.map((e) => (
                    <button
                      key={e.id}
                      type="button"
                      className="flex w-full items-center gap-2 rounded-xl bg-[#f6f8f6] px-3 py-2 text-left active:bg-[#eef3ef]"
                      onClick={() => nav(`/m/exams/${e.id}`)}
                    >
                      <IcCalendar style={{ fontSize: 13 }} className="flex-none text-ink-soft" />
                      <span className="min-w-0 flex-1 truncate text-[12px] text-ink">{e.name}</span>
                      <span className="flex-none text-[10.5px] text-ink-soft">{e.resultCount} 份</span>
                    </button>
                  ))}
                </div>

                <div className="mt-2.5 flex gap-2">
                  <Btn sm variant="ghost" onClick={() => setSheet({ open: true, editing: b })}>
                    编辑批次
                  </Btn>
                  <Btn sm variant="ghost" onClick={() => nav('/m/results')}>
                    按批次看成绩
                  </Btn>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <p className="mt-4 flex items-start gap-1.5 text-[11.5px] leading-relaxed text-ink-soft">
        <IcAlert style={{ fontSize: 13, marginTop: 2 }} />
        批次只是考试 id 的集合，不会复制成绩，删除批次也不会动到任何成绩。
      </p>

      <BatchEditor
        key={sheet.editing?.id ?? 'new'}
        open={sheet.open}
        editing={sheet.editing}
        exams={exams.data}
        onClose={() => setSheet({ open: false })}
        onSaved={() => {
          setSheet({ open: false })
          batches.reload()
        }}
      />
    </Page>
  )
}

function BatchEditor({
  open,
  editing,
  exams,
  onClose,
  onSaved,
}: {
  open: boolean
  editing?: ExamBatch
  exams: ExamSummary[]
  onClose: () => void
  onSaved: () => void
}) {
  const toast = useToast()
  const [name, setName] = useState(editing?.name ?? '')
  const [ids, setIds] = useState<number[]>(editing?.examIds ?? [])
  const [saving, setSaving] = useState(false)

  async function save() {
    if (!name.trim()) {
      toast('批次名不能为空', 'err')
      return
    }
    setSaving(true)
    try {
      if (editing) await batchesApi.update(editing.id, name.trim(), ids)
      else await batchesApi.create(name.trim(), ids)
      toast('批次已保存', 'ok')
      onSaved()
    } catch (err) {
      toast(err instanceof Error ? err.message : '保存失败', 'err')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={editing ? '编辑批次' : '新建批次'}
      footer={
        <Btn block disabled={saving} onClick={save}>
          {saving ? '保存中…' : '保存批次'}
        </Btn>
      }
    >
      <div className="space-y-3">
        <label className="mo-field">
          <span className="mo-field-label">批次名</span>
          <input
            className="mo-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="例如：2026 高一期中"
          />
        </label>

        <div>
          <p className="mo-field-label">包含的考试 · 已选 {ids.length}</p>
          <div className="mo-list max-h-[46vh] overflow-y-auto">
            {exams.map((e, i) => (
              <button
                key={e.id}
                type="button"
                className={`mo-list-row ${i === exams.length - 1 ? 'is-last' : ''}`}
                onClick={() =>
                  setIds((prev) => (prev.includes(e.id) ? prev.filter((x) => x !== e.id) : [...prev, e.id]))
                }
              >
                <span className="grid h-8 w-8 flex-none place-items-center rounded-lg bg-[#f2f4f7] text-[#5c6570]">
                  <IcCalendar style={{ fontSize: 14 }} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] text-ink">{e.name}</span>
                  <span className="block truncate text-[11px] text-ink-soft">{e.paperName}</span>
                </span>
                <CheckDot on={ids.includes(e.id)} />
              </button>
            ))}
            {exams.length === 0 && (
              <p className="px-3 py-5 text-center text-[12.5px] text-ink-soft">先建考试，才能组批次</p>
            )}
          </div>
        </div>
      </div>
    </Sheet>
  )
}

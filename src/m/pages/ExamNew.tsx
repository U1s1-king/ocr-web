import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useToast } from '../../components/Toast'
import { examsApi, papersApi, type PaperJson } from '../api'
import { IcCheck, IcLayers, IcSpark } from '../icons'
import { PaperPicker, PaperPreview } from '../pickers'
import { Btn, Card, Page, useLoad } from '../ui'

export default function ExamNew() {
  const nav = useNavigate()
  const toast = useToast()
  const [name, setName] = useState('')
  const [paperId, setPaperId] = useState<number | null>(null)
  const [paperName, setPaperName] = useState('')
  const [pickOpen, setPickOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  const paper = useLoad(
    () =>
      paperId
        ? papersApi.get(paperId)
        : Promise.resolve(null as unknown as Awaited<ReturnType<typeof papersApi.get>>),
    null as unknown as Awaited<ReturnType<typeof papersApi.get>>,
    [paperId],
  )

  const invalid = !name.trim() || !paperId

  async function submit() {
    if (invalid) {
      toast(!name.trim() ? '给考试起个名字吧' : '还没选试卷', 'err')
      return
    }
    setSaving(true)
    try {
      const exam = await examsApi.create(name.trim(), paperId as number)
      toast('考试已创建', 'ok')
      nav(`/m/exams/${exam.id}`, { replace: true })
    } catch (err) {
      toast(err instanceof Error ? err.message : '创建失败', 'err')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Page title="新建考试" sub="STEP 1 / 2" back>
      <Card delay={0}>
        <div className="flex items-center gap-2">
          <span className="mo-badge">基础信息</span>
          <span className="mo-muted ml-auto">{name.length}/100</span>
        </div>
        <label className="mo-field mt-3">
          <span className="mo-field-label">考试名</span>
          <input
            className="mo-input"
            value={name}
            maxLength={100}
            onChange={(e) => setName(e.target.value)}
            placeholder="例如：高一数学第一次月考"
            autoFocus
          />
        </label>
        <p className="mo-muted mt-2">考试是成绩的归属主体，多场考试可以复用同一张试卷。</p>
      </Card>

      <Card delay={1} className="mt-3">
        <div className="flex items-center gap-2">
          <span className="mo-badge">绑定试卷</span>
          {paperId && <span className="mo-badge" data-tone="ok">#{paperId}</span>}
        </div>
        <button
          type="button"
          onClick={() => setPickOpen(true)}
          className="mt-3 flex w-full items-center gap-3 rounded-2xl border border-brand-200 bg-brand-50/60 p-3 text-left active:scale-[.99]"
        >
          <span className="mo-row-ico">
            <IcLayers style={{ fontSize: 17 }} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[13px] font-extrabold">{paperId ? paperName || `试卷 #${paperId}` : '选择一张答题卡'}</span>
            <span className="mo-muted block">{paperId ? '点击更换试卷' : '没有试卷？先去「试卷」新建'}</span>
          </span>
          <IcSpark style={{ fontSize: 16 }} className="text-brand-500" />
        </button>
        {paperId && (
          <div className="mt-3">
            <PaperPreview paper={paper.data?.paper as PaperJson} />
          </div>
        )}
      </Card>

      <div className="mt-4">
        <Btn block disabled={invalid || saving} onClick={submit}>
          <IcCheck style={{ fontSize: 17 }} /> {saving ? '创建中…' : '创建考试'}
        </Btn>
        <button
          type="button"
          className="mt-3 w-full text-center text-[11px] font-bold text-brand-700/60"
          onClick={() => nav('/m/papers/new')}
        >
          想先建试卷？点这里
        </button>
      </div>

      <PaperPicker
        open={pickOpen}
        onClose={() => setPickOpen(false)}
        selected={paperId}
        onPick={(id, n) => {
          setPaperId(id)
          setPaperName(n)
        }}
      />
    </Page>
  )
}

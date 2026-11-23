import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { PageHeader } from '../components/PageHeader'
import { AlertIcon, DownloadIcon, EditIcon, PlusIcon, SaveIcon, ScanIcon, TrashIcon } from '../components/icons'
import { Badge, Button, Card } from '../components/ui'
import { useToast } from '../components/Toast'
import { errorText } from '../api/client'
import { templatesApi, type TemplateSummary } from '../m/api'
import {
  CARD_TEMPLATES,
  CATALOG_SIZES,
  CATALOG_SUBJECTS,
  CATALOG_SYSTEMS,
  templateById,
  type CardTemplate,
} from '../lib/card/catalog'
import { generateCard } from '../lib/card/generator'
import { readActiveBundle } from '../lib/paper/active'
import { bundleToCardSpec } from '../lib/paper/cardSpec'
import { CardSheet } from '../lib/card/render'
import { backAsDoc } from '../lib/card/back'
import {
  createPaperFromDoc,
  docFromRemoteTemplate,
  listCustomTemplates,
  removeCustomTemplate,
  saveCustomTemplate,
  saveLastSpec,
  specFromTemplate,
  stashDoc,
  type CustomTemplate,
} from '../lib/card/store'
import { paperMm, type CardSpec, type PaperSize, type SubjectiveGroupSpec } from '../lib/card/types'
import { downloadText } from '../lib/image'

const PX_PER_MM = 96 / 25.4

export default function CardStudioPage() {
  const nav = useNavigate()
  const toast = useToast()
  const [system, setSystem] = useState('全部')
  const [size, setSize] = useState('全部')
  const [subject, setSubject] = useState('全部')
  const [q, setQ] = useState('')

  const [templateId, setTemplateId] = useState(CARD_TEMPLATES[0]?.id ?? '')
  const [spec, setSpec] = useState<CardSpec>(() => specFromTemplate(CARD_TEMPLATES[0]))
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)
  const [paramOpen, setParamOpen] = useState(false)
  const [custom, setCustom] = useState<CustomTemplate[]>(() => listCustomTemplates())
  const [remote, setRemote] = useState<TemplateSummary[]>([])
  const [remoteErr, setRemoteErr] = useState('')
  const [loadingRemote, setLoadingRemote] = useState(true)
  const [fromBundle, setFromBundle] = useState(false)

  const generated = useMemo(() => generateCard(spec), [spec])
  const doc = generated.doc
  const page = doc.meta
  const dims = paperMm(page.paperSize, page.orientation)
  const mmW = dims.w
  const mmH = dims.h

  const previewRef = useRef<HTMLDivElement>(null)
  const [zoom, setZoom] = useState(0.6)
  const [previewSide, setPreviewSide] = useState<'front' | 'back'>('front')
  const previewDoc = previewSide === 'back' && doc.back ? backAsDoc(doc) : doc

  useEffect(() => {
    const el = previewRef.current
    if (!el) return
    const calc = () => {
      const w = el.clientWidth - 24
      const h = 520
      const byW = w / (mmW * PX_PER_MM)
      const byH = h / (mmH * PX_PER_MM)
      setZoom(Math.max(0.15, Math.min(1, Math.min(byW, byH))))
    }
    calc()
    const ro = new ResizeObserver(calc)
    ro.observe(el)
    return () => ro.disconnect()
  }, [mmW, mmH])

  // 支持从移动端模板卡片带 ?tpl=模板id 直接打开对应模板
  useEffect(() => {
    const hashQ = window.location.hash.split('?')[1] ?? ''
    const id = new URLSearchParams(hashQ).get('tpl')
    const t = id ? templateById(id) : null
    if (t) {
      setTemplateId(t.id)
      setSpec(specFromTemplate(t))
      setName(t.name)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 从统一试卷页跳转过来：按试卷 questions[] 自动生成答题卡
  useEffect(() => {
    const hashQ = window.location.hash.split('?')[1] ?? ''
    if (new URLSearchParams(hashQ).get('fromBundle') !== '1') return
    const bundle = readActiveBundle()
    if (!bundle) return
    const next = bundleToCardSpec(bundle)
    setSpec(next)
    setName(next.name)
    setTemplateId('from-bundle')
    setFromBundle(true)
    toast(`已按试卷「${bundle.meta.title}」生成答题卡（${bundle.questions.length} 题）`, 'ok')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    templatesApi
      .list()
      .then((list) => {
        setRemote(list)
        setRemoteErr('')
      })
      .catch((e) => setRemoteErr(errorText(e)))
      .finally(() => setLoadingRemote(false))
  }, [])

  const templates = useMemo(() => {
    return CARD_TEMPLATES.filter((t) => (system === '全部' ? true : t.systemLabel === system))
      .filter((t) => (size === '全部' ? true : t.size === size))
      .filter((t) => (subject === '全部' ? true : t.subject === subject))
      .filter((t) => (!q ? true : t.name.includes(q) || t.hint.includes(q)))
  }, [system, size, subject, q])

  function pickTemplate(t: CardTemplate) {
    setTemplateId(t.id)
    setSpec(specFromTemplate(t))
    setName(t.name)
    toast(`已载入模板：${t.name}`, 'ok')
  }

  function patchSpec(patch: Partial<CardSpec>) {
    setSpec((s) => ({ ...s, ...patch }))
  }

  function changeSize(next: PaperSize) {
    setSpec((s) => ({
      ...s,
      paperSize: next,
      orientation: next === 'A3' ? 'landscape' : 'portrait',
    }))
  }

  function updateObjective(idx: number, patch: Partial<CardSpec['objectiveGroups'][number]>) {
    setSpec((s) => ({
      ...s,
      objectiveGroups: s.objectiveGroups.map((g, i) => (i === idx ? { ...g, ...patch } : g)),
    }))
  }

  function updateSubjective(idx: number, patch: Partial<SubjectiveGroupSpec>) {
    setSpec((s) => ({
      ...s,
      subjectiveGroups: s.subjectiveGroups.map((g, i) => (i === idx ? { ...g, ...patch } : g)),
    }))
  }

  async function createPaper() {
    const paperName = (name || spec.name || '答题卡').trim()
    if (!paperName) {
      toast('请填写试卷名称', 'err')
      return
    }
    setSaving(true)
    try {
      saveLastSpec(spec)
      const res = await createPaperFromDoc(doc, paperName)
      toast(`已创建试卷 #${res.id}，可以直接精调或打印`, 'ok')
      nav(`/papers/${res.id}/edit`)
    } catch (e) {
      toast(errorText(e), 'err')
    } finally {
      setSaving(false)
    }
  }

  function localEdit() {
    stashDoc(doc, spec)
    nav('/papers/local/edit')
  }

  function printPreview() {
    stashDoc(doc, spec)
    nav('/papers/print')
  }

  function exportJson() {
    downloadText(
      JSON.stringify({ spec, doc }, null, 2),
      `${(spec.name || '答题卡模板').replace(/[/\\:*?"<>|]/g, '_')}.json`,
      'application/json;charset=utf-8',
    )
  }

  function saveAsTemplate() {
    const t = saveCustomTemplate(name || spec.name, spec)
    setCustom(listCustomTemplates())
    toast(`已存为自制模板「${t.name}」`, 'ok')
  }

  function dropCustom(t: CustomTemplate) {
    if (!window.confirm(`删除自制模板「${t.name}」？`)) return
    removeCustomTemplate(t.id)
    setCustom(listCustomTemplates())
  }

  async function useRemote(t: TemplateSummary) {
    try {
      const detail = await templatesApi.get(t.id)
      const d = docFromRemoteTemplate(detail.name, detail.paper, t.name.includes('A3') ? 'A3' : 'A4')
      stashDoc(d)
      toast(`已载入后端模板「${detail.name}」`, 'ok')
      nav('/papers/local/edit')
    } catch (e) {
      toast(errorText(e), 'err')
    }
  }

  const activeTemplate = CARD_TEMPLATES.find((t) => t.id === templateId) ?? null

  return (
    <div>
      <PageHeader
        title="答题卡制作"
        desc="选模板 → 调题量 → 实时预览 → 保存/打印。模板按「体系-科目-纸型-版本」展开，排版引擎保证不越界不重叠。"
        crumb={[{ label: '试卷库', to: '/papers' }, { label: '答题卡制作' }]}
        extra={
          <>
            {fromBundle && <Badge tone="ok">来自统一试卷</Badge>}
            <Badge tone="brand">{CARD_TEMPLATES.length} 份内置模板</Badge>
            {generated.warnings.length > 0 && <Badge tone="warn">{generated.warnings.length} 条提示</Badge>}
          </>
        }
      />

      {fromBundle && (
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-[11px] font-semibold text-emerald-800">
          <span>✓ 已从统一试卷带入</span>
          <span className="text-emerald-700/70">{spec.name} · {spec.objectiveGroups.reduce((n, g) => n + g.count, 0)} 道选择题 · {spec.subjectiveGroups.reduce((n, g) => n + g.items.length, 0)} 道主观题</span>
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-[310px_minmax(0,1fr)]">
        {/* ===== 左：模板目录 ===== */}
        <Card className="!p-3">
          <div className="flex flex-wrap gap-1.5">
            <Select options={CATALOG_SYSTEMS} value={system} onChange={setSystem} />
            <Select options={CATALOG_SIZES} value={size} onChange={setSize} />
          </div>
          <div className="mt-2 flex gap-1.5">
            <select
              className="w-full rounded-lg border border-brand-200 bg-white px-2 py-1.5 text-[11.5px] font-semibold text-ink outline-none"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            >
              {CATALOG_SUBJECTS.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
            <input
              className="w-full rounded-lg border border-brand-200 bg-white px-2 py-1.5 text-[11.5px] outline-none"
              placeholder="搜模板"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>

          <div className="mt-3 max-h-[520px] space-y-1.5 overflow-y-auto pr-1">
            {templates.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => pickTemplate(t)}
                className={`flex w-full items-center gap-2 rounded-xl border px-2 py-2 text-left transition ${
                  templateId === t.id
                    ? 'border-brand-400 bg-brand-50'
                    : 'border-brand-100 bg-white hover:border-brand-300 hover:bg-brand-50/60'
                }`}
              >
                <span className="grid h-9 w-9 flex-none place-items-center rounded-lg bg-brand-100/70 text-brand-700">
                  <ScanIcon className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[12px] font-bold text-ink">{t.name}</span>
                  <span className="block truncate text-[10px] text-ink-soft/60">
                    {t.systemLabel} · {t.subject} · {t.size} · {t.variant}
                  </span>
                </span>
                <span className="flex-none text-[10px] font-bold text-ink-soft/50">{t.fullScore}分</span>
              </button>
            ))}
            {templates.length === 0 && <p className="py-6 text-center text-[11.5px] text-ink-soft/60">没有匹配的模板</p>}
          </div>

          {custom.length > 0 && (
            <>
              <p className="mt-3 mb-1.5 text-[10.5px] font-bold tracking-wider text-ink-soft/50">自制模板</p>
              <div className="space-y-1">
                {custom.map((t) => (
                  <div key={t.id} className="flex items-center gap-1 rounded-lg border border-brand-100 bg-white px-2 py-1.5">
                    <button
                      type="button"
                      className="min-w-0 flex-1 truncate text-left text-[11.5px] font-semibold"
                      onClick={() => {
                        setSpec(t.spec)
                        setTemplateId('')
                        setName(t.name)
                      }}
                    >
                      {t.name}
                    </button>
                    <button type="button" className="text-ink-soft/40 hover:text-red-500" onClick={() => dropCustom(t)}>
                      <TrashIcon className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}

          <p className="mt-3 mb-1.5 text-[10.5px] font-bold tracking-wider text-ink-soft/50">后端模板（只读接口）</p>
          {loadingRemote ? (
            <p className="py-2 text-[11px] text-ink-soft/50">正在读取 GET /api/v1/templates…</p>
          ) : remoteErr && false ? (
            <p className="rounded-lg bg-amber-50 px-2 py-1.5 text-[10.5px] leading-relaxed text-amber-700">
              后端模板暂不可用：{remoteErr}
            </p>
          ) : remote.length === 0 ? (
            <p className="py-2 text-[11px] text-ink-soft/50">后端还没有收录模板</p>
          ) : (
            <div className="space-y-1">
              {remote.slice(0, 30).map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className="flex w-full items-center gap-1.5 rounded-lg border border-brand-100 px-2 py-1.5 text-left text-[11px] hover:bg-brand-50"
                  onClick={() => void useRemote(t)}
                >
                  <span className="truncate">{t.name}</span>
                  <span className="ml-auto flex-none text-[9.5px] text-ink-soft/45">#{t.id}</span>
                </button>
              ))}
            </div>
          )}
        </Card>

        {/* ===== 右：预览 + 参数 + 操作 ===== */}
        <div className="space-y-3">
          <Card className="!p-4">
            <div className="flex flex-wrap items-start gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-black text-ink">{spec.name || '未命名答题卡'}</p>
                <p className="mt-0.5 text-[11.5px] text-ink-soft/70">
                  {spec.system} · {spec.subject} · {doc.meta.paperSize} {doc.meta.orientation === 'landscape' ? '横版' : '竖版'} ·{' '}
                  {doc.content.questions.length} 题 · 满分 {totalScore(spec)} 分
                  {activeTemplate ? ` · 模板 ${activeTemplate.variant}` : ' · 自定义'}
                </p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {(['A4', 'A3'] as PaperSize[]).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => changeSize(s)}
                    className={`rounded-lg px-2.5 py-1.5 text-[11px] font-bold ${
                      doc.meta.paperSize === s ? 'bg-brand-600 text-white' : 'border border-brand-200 bg-white text-ink-soft'
                    }`}
                  >
                    {s}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setSpec(specFromTemplate(activeTemplate ?? CARD_TEMPLATES[0]))}
                  className="rounded-lg border border-brand-200 bg-white px-2.5 py-1.5 text-[11px] font-bold text-ink-soft"
                >
                  恢复模板
                </button>
              </div>
            </div>

            {generated.warnings.length > 0 && (
              <div className="mt-3 space-y-1">
                {generated.warnings.map((w, i) => (
                  <p key={i} className="flex items-start gap-1.5 rounded-lg bg-amber-50 px-2.5 py-1.5 text-[10.5px] leading-relaxed text-amber-800">
                    <AlertIcon className="mt-0.5 h-3 w-3 flex-none" />
                    {w}
                  </p>
                ))}
              </div>
            )}
          </Card>

          <Card className="!p-3">
            <div ref={previewRef} className="flex max-h-[560px] min-h-[320px] items-start justify-center overflow-hidden bg-neutral-100/70 p-3">
              <div style={{ width: mmW * PX_PER_MM * zoom, height: mmH * PX_PER_MM * zoom, flex: 'none' }}>
                <CardSheet doc={previewDoc} zoom={zoom} />
              </div>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2 px-1">
              <div className="flex items-center gap-1 rounded-lg border border-brand-200 bg-white p-0.5">
                <button type="button" className={`rounded-md px-2 py-0.5 text-[10px] font-bold ${previewSide === 'front' ? 'bg-brand-600 text-white' : 'text-ink-soft'}`} onClick={() => setPreviewSide('front')}>正面</button>
                <button type="button" className={`rounded-md px-2 py-0.5 text-[10px] font-bold ${previewSide === 'back' ? 'bg-brand-600 text-white' : 'text-ink-soft'}`} onClick={() => setPreviewSide('back')}>背面</button>
              </div>
              <span className="text-[10.5px] text-ink-soft/60">
                {mmW}×{mmH}mm · 缩放 {Math.round(zoom * 100)}% · 定位块已内置四角
              </span>
              <div className="ml-auto flex items-center gap-1.5">
                <Button variant="ghost" size="sm" onClick={localEdit}>
                  <EditIcon className="h-3.5 w-3.5" /> 精调
                </Button>
                <Button variant="ghost" size="sm" onClick={printPreview}>
                  打印预览
                </Button>
                <Button variant="ghost" size="sm" onClick={exportJson}>
                  <DownloadIcon className="h-3.5 w-3.5" /> 导出 JSON
                </Button>
              </div>
            </div>
          </Card>

          <Card className="!p-4">
            <div className="flex flex-wrap items-center gap-2">
              <input
                className="min-w-[220px] flex-1 rounded-xl border border-brand-200 bg-white px-3 py-2 text-[12.5px] font-semibold outline-none focus:border-brand-400"
                placeholder="试卷名称（保存到后端时使用）"
                value={name}
                maxLength={100}
                onChange={(e) => setName(e.target.value)}
              />
              <Button onClick={() => void createPaper()} disabled={saving}>
                <SaveIcon className="h-4 w-4" />
                {saving ? '保存中…' : '保存为新试卷'}
              </Button>
              <Button variant="ghost" onClick={saveAsTemplate}>
                <PlusIcon className="h-4 w-4" /> 存为自制模板
              </Button>
              <Link
                to="/papers/dsl"
                className="inline-flex h-9 items-center rounded-xl border border-brand-200 bg-white px-3 text-[12px] font-bold text-brand-700 hover:bg-brand-50"
              >
                文本出卡 DSL
              </Link>
            </div>
            <p className="mt-2 text-[10.5px] leading-relaxed text-ink-soft/60">
              「保存为新试卷」会调用 <code className="rounded bg-brand-50 px-1">POST /api/v1/papers</code> 与{' '}
              <code className="rounded bg-brand-50 px-1">PUT /api/v1/papers/&#123;id&#125;</code> 写入标准 v1 JSON；
              后端不可用时仍可本地精调、打印、导出。
            </p>
          </Card>

          <Card className="!p-4">
            <button
              type="button"
              className="flex w-full items-center justify-between text-[12.5px] font-black text-ink"
              onClick={() => setParamOpen((v) => !v)}
            >
              题量与表头参数
              <span className="text-[11px] font-semibold text-brand-700">{paramOpen ? '收起' : '展开编辑'}</span>
            </button>
            {paramOpen && (
              <div className="anim-fade-up mt-4 space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block">
                    <span className="mb-1 block text-[10.5px] font-bold text-ink-soft/70">考试名称（红色抬头）</span>
                    <input className={inputCls} value={spec.title} onChange={(e) => patchSpec({ title: e.target.value })} />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-[10.5px] font-bold text-ink-soft/70">科目 / 副标题</span>
                    <input className={inputCls} value={spec.subtitle} onChange={(e) => patchSpec({ subtitle: e.target.value })} />
                  </label>
                </div>

                <div className="flex flex-wrap gap-3 text-[11.5px] font-semibold text-ink-soft">
                  {(
                    [
                      ['showBarcode', '条形码区'],
                      ['showLegend', '填涂样例'],
                      ['showNotice', '注意事项'],
                      ['showStudent', '考生信息'],
                    ] as const
                  ).map(([key, label]) => (
                    <label key={key} className="flex items-center gap-1.5">
                      <input
                        type="checkbox"
                        checked={Boolean(spec[key])}
                        onChange={(e) => patchSpec({ [key]: e.target.checked } as Partial<CardSpec>)}
                      />
                      {label}
                    </label>
                  ))}
                </div>

                <div>
                  <p className="mb-2 text-[11px] font-black text-ink">客观题（选择题）</p>
                  <div className="space-y-2">
                    {spec.objectiveGroups.map((g, i) => (
                      <div key={i} className="grid grid-cols-[minmax(0,1fr)_64px_64px_28px] items-center gap-1.5">
                        <input
                          className="rounded-lg border border-brand-200 px-2 py-1 text-[11.5px] outline-none"
                          value={g.title}
                          onChange={(e) => updateObjective(i, { title: e.target.value })}
                        />
                        <input
                          type="number"
                          min={0}
                          max={100}
                          title="题数"
                          className="rounded-lg border border-brand-200 px-1.5 py-1 text-[11.5px] outline-none"
                          value={g.count}
                          onChange={(e) => updateObjective(i, { count: Math.max(0, Number(e.target.value)) })}
                        />
                        <input
                          type="number"
                          min={0.5}
                          step={0.5}
                          title="每题分值"
                          className="rounded-lg border border-brand-200 px-1.5 py-1 text-[11.5px] outline-none"
                          value={g.score}
                          onChange={(e) => updateObjective(i, { score: Math.max(0.5, Number(e.target.value)) })}
                        />
                        <button
                          type="button"
                          className="grid h-7 w-7 place-items-center rounded-lg text-ink-soft/40 hover:bg-red-50 hover:text-red-500"
                          onClick={() =>
                            setSpec((s) => ({ ...s, objectiveGroups: s.objectiveGroups.filter((_, k) => k !== i) }))
                          }
                        >
                          <TrashIcon className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                  <button
                    type="button"
                    className="mt-2 text-[11px] font-bold text-brand-700"
                    onClick={() =>
                      setSpec((s) => ({
                        ...s,
                        objectiveGroups: [
                          ...s.objectiveGroups,
                          { title: `第 ${s.objectiveGroups.length + 1} 组选择题`, count: 10, score: 2 },
                        ],
                      }))
                    }
                  >
                    + 添加一组选择题
                  </button>
                </div>

                <div>
                  <p className="mb-2 text-[11px] font-black text-ink">主观题（作答区）</p>
                  <div className="space-y-2">
                    {spec.subjectiveGroups.map((g, i) => (
                      <div key={i} className="rounded-xl border border-brand-100 p-2">
                        <div className="grid grid-cols-[minmax(0,1fr)_80px_64px_28px] items-center gap-1.5">
                          <input
                            className="rounded-lg border border-brand-200 px-2 py-1 text-[11.5px] outline-none"
                            value={g.title}
                            onChange={(e) => updateSubjective(i, { title: e.target.value })}
                          />
                          <select
                            className="rounded-lg border border-brand-200 px-1 py-1 text-[11px] outline-none"
                            value={g.style}
                            onChange={(e) => updateSubjective(i, { style: e.target.value as SubjectiveGroupSpec['style'] })}
                          >
                            <option value="lines">横线区</option>
                            <option value="grid">作文格</option>
                            <option value="blank">空白区</option>
                          </select>
                          <span className="text-[10.5px] text-ink-soft/60">{g.items.length} 小题</span>
                          <button
                            type="button"
                            className="grid h-7 w-7 place-items-center rounded-lg text-ink-soft/40 hover:bg-red-50 hover:text-red-500"
                            onClick={() =>
                              setSpec((s) => ({ ...s, subjectiveGroups: s.subjectiveGroups.filter((_, k) => k !== i) }))
                            }
                          >
                            <TrashIcon className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        <div className="mt-1.5 flex flex-wrap gap-1.5">
                          {g.items.map((it, k) => (
                            <span key={k} className="flex items-center gap-1 rounded-lg bg-brand-50 px-1.5 py-0.5 text-[10.5px] text-ink-soft">
                              {k + 1}.
                              <input
                                type="number"
                                min={1}
                                max={60}
                                title="行数"
                                className="w-9 rounded border border-brand-200 px-1 text-[10.5px]"
                                value={it.rows}
                                onChange={(e) =>
                                  updateSubjective(i, {
                                    items: g.items.map((x, j) =>
                                      j === k ? { ...x, rows: Math.max(1, Number(e.target.value)) } : x,
                                    ),
                                  })
                                }
                              />
                              行
                              <input
                                type="number"
                                min={0.5}
                                step={0.5}
                                title="分值"
                                className="w-10 rounded border border-brand-200 px-1 text-[10.5px]"
                                value={it.score}
                                onChange={(e) =>
                                  updateSubjective(i, {
                                    items: g.items.map((x, j) =>
                                      j === k ? { ...x, score: Math.max(0.5, Number(e.target.value)) } : x,
                                    ),
                                  })
                                }
                              />
                              分
                            </span>
                          ))}
                          <button
                            type="button"
                            className="text-[10.5px] font-bold text-brand-700"
                            onClick={() =>
                              updateSubjective(i, { items: [...g.items, { rows: 6, score: 10 }] })
                            }
                          >
                            + 小题
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                  <button
                    type="button"
                    className="mt-2 text-[11px] font-bold text-brand-700"
                    onClick={() =>
                      setSpec((s) => ({
                        ...s,
                        subjectiveGroups: [
                          ...s.subjectiveGroups,
                          { title: `第 ${s.subjectiveGroups.length + 1} 大题`, style: 'lines', items: [{ rows: 8, score: 10 }] },
                        ],
                      }))
                    }
                  >
                    + 添加一组主观题
                  </button>
                </div>
              </div>
            )}
          </Card>

        </div>
      </div>
    </div>
  )
}

const inputCls =
  'w-full rounded-xl border border-brand-200 bg-white px-3 py-2 text-[12px] font-semibold text-ink outline-none focus:border-brand-400'

function Select({ options, value, onChange }: { options: string[]; value: string; onChange: (v: string) => void }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-lg border border-brand-200 bg-white px-2 py-1.5 text-[11.5px] font-semibold text-ink outline-none"
    >
      {options.map((o) => (
        <option key={o}>{o}</option>
      ))}
    </select>
  )
}

function totalScore(spec: CardSpec): number {
  const o = spec.objectiveGroups.reduce((s, g) => s + g.count * g.score, 0)
  const s = spec.subjectiveGroups.reduce((sum, g) => sum + g.items.reduce((x, it) => x + it.score, 0), 0)
  return Math.round((o + s) * 10) / 10
}



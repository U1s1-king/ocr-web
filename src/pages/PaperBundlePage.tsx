import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { makeMockPaperBundle, PAPER_SUBJECTS, type PaperSubject } from '../lib/paper/mock'
import { saveActiveBundle } from '../lib/paper/active'
import { requestPrint } from '../lib/print'
import { bundleToPaperV2 } from '../lib/paper/backendV2'
import { paperV2ToBundle } from '../lib/paper/fromV2'
import { papersApi, errorText } from '../m/api'
import {
  bundleTotalScore,
  questionsOfSection,
  validatePaperBundle,
  type PaperBundle,
  type PaperQuestion,
} from '../lib/paper/types'

const STORAGE_KEY = 'ac.paper.bundle.demo.v2'
type View = 'paper' | 'answerCard' | 'answerKey'

const VIEW_LABEL: Record<View, string> = {
  paper: '试卷',
  answerCard: '答题卡',
  answerKey: '答案页',
}

/** 高考常见试卷纸型：A3 / 8K 为横版，A4 为纵版 */
const PAPER_PRESETS: Record<PaperBundle['meta']['paperSize'], { w: number; h: number; label: string; orientation: 'portrait' | 'landscape'; columns: number; gap: number; padX: number; padY: number; font: number }> = {
  A3: { w: 420, h: 297, label: 'A3 横版', orientation: 'landscape', columns: 3, gap: 12, padX: 16, padY: 12, font: 10.5 },
  '8K': { w: 370, h: 260, label: '8K 横版', orientation: 'landscape', columns: 3, gap: 8, padX: 12, padY: 9, font: 9.4 },
  A4: { w: 210, h: 297, label: 'A4 纵版', orientation: 'portrait', columns: 1, gap: 0, padX: 14, padY: 12, font: 10.8 },
}

function loadBundle(): PaperBundle {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return makeMockPaperBundle()
    const parsed = JSON.parse(raw) as PaperBundle
    if (parsed?.schema !== 'paper-bundle') return makeMockPaperBundle()
    return { ...parsed, meta: { ...parsed.meta, sides: 2 } }
  } catch {
    return makeMockPaperBundle()
  }
}

export default function PaperBundlePage() {
  const nav = useNavigate()
  const [bundle, setBundle] = useState<PaperBundle>(loadBundle)
  const [view, setView] = useState<View>('paper')
  const [previewSide, setPreviewSide] = useState<'front' | 'back'>('front')
  const [message, setMessage] = useState('')

  const paperPreset = PAPER_PRESETS[bundle.meta.paperSize]
  const answerCardPage = bundle.answerCard.pages[0]?.canvas ?? { width: 300, height: 424.29 }
  const printPage = view === 'paper' ? `${paperPreset.w}mm ${paperPreset.h}mm` : `${answerCardPage.width * 0.7}mm ${answerCardPage.height * 0.7}mm`
  const total = bundleTotalScore(bundle)
  const issues = useMemo(() => validatePaperBundle(bundle), [bundle])
  const errors = issues.filter((i) => i.level === 'error')
  const warnings = issues.filter((i) => i.level === 'warn')

  function persist(next: PaperBundle) {
    setBundle(next)
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    } catch {
      /* ignore */
    }
  }

  async function loadBackendPaper() {
    const input = window.prompt('输入后端试卷 id（GET /api/v1/papers/{id} 的 id）')
    if (!input) return
    const id = Number(input)
    if (!Number.isFinite(id) || id <= 0) {
      setMessage('试卷 id 不合法')
      return
    }
    try {
      const detail = await papersApi.get(id)
      if (!detail.rawPaper) {
        setMessage('该试卷还没有 v2 内容（paper 为空）')
        return
      }
      persist(paperV2ToBundle({ id, name: detail.name, paper: detail.rawPaper }))
      setPreviewSide('front')
      setMessage(`已从后端载入试卷 #${id}：${detail.name}`)
    } catch (e) {
      setMessage(`载入后端试卷失败：${errorText(e)}`)
    }
  }

  function switchSubject(subject: PaperSubject) {
    persist(makeMockPaperBundle(subject))
    setPreviewSide('front')
    setMessage(`已切换为${subject}示例试卷`)
  }

  function reset() {
    persist(makeMockPaperBundle())
    setMessage('已恢复示例试卷')
  }

  function exportBackendV2() {
    const blob = new Blob([JSON.stringify(bundleToPaperV2(bundle), null, 2)], { type: 'application/json;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${bundle.meta.title || 'paper-bundle'}.backend-v2.json`
    a.click()
    URL.revokeObjectURL(url)
    setMessage('已导出后端 v2 包装 JSON（answerCard.pages + paper.pages）')
  }

  function exportJson() {
    const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${bundle.meta.title || 'paper-bundle'}.paper-bundle.json`
    a.click()
    URL.revokeObjectURL(url)
    setMessage('已导出 paper.bundle.json')
  }

  async function importJson(file: File) {
    try {
      const parsed = JSON.parse(await file.text()) as PaperBundle
      const found = validatePaperBundle(parsed)
      const errs = found.filter((i) => i.level === 'error')
      if (errs.length) {
        setMessage(`导入失败：${errs[0].message}`)
        return
      }
      persist(parsed)
      setMessage(`已导入：${parsed.meta.title}`)
    } catch {
      setMessage('导入失败：不是合法 JSON')
    }
  }

  return (
    <div className="pbp-page space-y-4">
      <style>{`
        .pbp-answer-card-sheet {
          --pbp-card-scale: .82;
        }
        .pbp-answer-card-sheet .pbp-block-text {
          font-size: calc(var(--pbp-card-scale) * 14px);
        }
        .pbp-answer-card-sheet .pbp-question-no {
          font-size: calc(var(--pbp-card-scale) * 12px);
        }
        .pbp-answer-card-sheet .pbp-question-type {
          font-size: calc(var(--pbp-card-scale) * 8px);
        }
        .pbp-paper-sheet {
          width: min(100%, var(--paper-w, 420mm));
          min-height: var(--paper-h, 297mm);
        }
        .pbp-paper-columns {
          column-gap: 12mm;
        }
        .pbp-paper-columns section {
          break-inside: auto;
        }
        .pbp-paper-question {
          break-inside: avoid;
        }
        @media print {
          @page { size: ${printPage}; margin: 0; }
          body { background: #fff !important; }
          .pbp-no-print, .site-sidebar, .sidebar-toggle-btn, .mo-dock-wrap { display: none !important; }
          main { padding: 0 !important; }
          main > div { max-width: none !important; padding: 0 !important; }
          main > div > div { animation: none !important; transform: none !important; }
          .pbp-page { display: block !important; }
          .pbp-print-area { display: block !important; }
          .pbp-paper-sheet {
            width: var(--paper-w) !important;
            min-height: var(--paper-h) !important;
            box-shadow: none !important;
            margin: 0 !important;
            border: 0 !important;
            page-break-after: always;
            break-after: page;
          }
          .pbp-paper-sheet:last-child { page-break-after: auto; break-after: auto; }
          .pbp-answer-card-sheet {
            --pbp-card-scale: 1;
            width: var(--pbp-card-w, 210mm) !important;
            height: var(--pbp-card-h, 297mm) !important;
            box-shadow: none !important;
            border: 0 !important;
            page-break-after: always;
            break-after: page;
          }
          .pbp-answer-card-sheet:last-child { page-break-after: auto; break-after: auto; }
          .pbp-side-inactive { display: block !important; }
        }
      `}</style>

      <div className="pbp-no-print flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-black text-ink">{bundle.meta.title}</h1>
            <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-bold text-amber-700">
              原型 · 后端未接
            </span>
            <span className="rounded-full bg-brand-50 px-2.5 py-1 text-[10px] font-bold text-brand-700">
              {bundle.meta.subject} · {bundle.meta.grade} · {bundle.meta.variant ?? 'A'} 卷
            </span>
            <label className="flex items-center gap-1 text-[10px] font-bold text-ink-soft/55">
              示例学科
              <select
                value={bundle.meta.subject}
                onChange={(e) => switchSubject(e.target.value as PaperSubject)}
                className="rounded-lg border border-brand-200 bg-white px-2 py-1 text-[10.5px] font-bold text-ink outline-none"
              >
                {PAPER_SUBJECTS.map((subject) => (
                  <option key={subject} value={subject}>{subject}</option>
                ))}
              </select>
            </label>
          </div>
          <p className="mt-1 text-[12px] text-ink-soft/65">
            {bundle.meta.examName} · {bundle.meta.durationMinutes} 分钟 · {bundle.meta.paperSize}{' '}
            {bundle.meta.orientation === 'portrait' ? '竖版' : '横版'} ·{' '}
            双面
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => void loadBackendPaper()} className="rounded-xl border border-brand-300 bg-brand-50 px-3 py-2 text-[11.5px] font-bold text-brand-700">
            载入后端试卷
          </button>
          <label className="cursor-pointer rounded-xl border border-brand-200 bg-white px-3 py-2 text-[11.5px] font-bold text-brand-700">
            导入 JSON
            <input
              type="file"
              accept=".json,application/json"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) void importJson(f)
                e.target.value = ''
              }}
            />
          </label>
          <button type="button" onClick={exportJson} className="rounded-xl border border-brand-200 bg-white px-3 py-2 text-[11.5px] font-bold text-brand-700">
            导出 JSON
          </button>
          <button type="button" onClick={exportBackendV2} className="rounded-xl border border-brand-200 bg-white px-3 py-2 text-[11.5px] font-bold text-brand-700">
            导出后端 v2
          </button>
          <button type="button" onClick={reset} className="rounded-xl border border-brand-200 bg-white px-3 py-2 text-[11.5px] font-bold text-ink-soft">
            恢复示例
          </button>
          <button
            type="button"
            onClick={() => requestPrint({
              kind: 'paper-bundle',
              title: bundle.meta.title,
              paperSize: bundle.meta.paperSize,
              orientation: bundle.meta.orientation,
              widthMm: paperPreset.w,
              heightMm: paperPreset.h,
              pages: 2,
              doubleSided: true,
              source: '/papers/bundle',
            })}
            className="rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 px-4 py-2 text-[11.5px] font-bold text-white shadow-soft"
          >
            打印正反双面
          </button>
        </div>
      </div>

      <div className="pbp-no-print grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="题目" value={`${bundle.questions.length} 道`} />
        <Stat label="总分" value={`${total} 分`} />
        <Stat label="大题" value={`${bundle.sections.length} 个`} />
        <Stat label="答题卡" value="双面" />
      </div>

      <div className="pbp-no-print flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-xl bg-brand-100/70 p-1">
          {(Object.keys(VIEW_LABEL) as View[]).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => {
                if (v === 'answerCard') {
                  saveActiveBundle(bundle)
                  nav('/papers/studio?fromBundle=1')
                  return
                }
                setView(v)
              }}
              className={`rounded-lg px-4 py-1.5 text-[11.5px] font-bold transition ${
                view === v ? 'bg-white text-brand-800 shadow-sm' : 'text-ink-soft/65'
              }`}
            >
              {VIEW_LABEL[v]}
            </button>
          ))}
        </div>
        {view !== 'answerKey' && (
          <div className="inline-flex items-center gap-1 rounded-xl border border-brand-200 bg-white px-1 py-1">
            <span className="px-1.5 text-[10px] font-bold text-ink-soft/55">正反面</span>
            <button
              type="button"
              onClick={() => setPreviewSide('front')}
              className={`rounded-lg px-3 py-1 text-[10.5px] font-bold ${previewSide === 'front' ? 'bg-brand-600 text-white' : 'text-ink-soft/65'}`}
            >
              正面
            </button>
            <button
              type="button"
              onClick={() => setPreviewSide('back')}
              disabled={!bundle.answerCard.pages.some((p) => p.side === 'back')}
              className={`rounded-lg px-3 py-1 text-[10.5px] font-bold disabled:opacity-40 ${previewSide === 'back' ? 'bg-brand-600 text-white' : 'text-ink-soft/65'}`}
            >
              背面
            </button>
          </div>
        )}
        {view === 'paper' && (
          <div className="flex items-center gap-1 rounded-xl border border-brand-200 bg-white px-1 py-1">
            <span className="px-1.5 text-[10px] font-bold text-ink-soft/55">试卷纸型</span>
            {(Object.keys(PAPER_PRESETS) as PaperBundle['meta']['paperSize'][]).map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => {
                  const preset = PAPER_PRESETS[key]
                  persist({ ...bundle, meta: { ...bundle.meta, paperSize: key, orientation: preset.orientation, updatedAt: new Date().toISOString() } })
                }}
                className={`rounded-lg px-2.5 py-1 text-[10.5px] font-bold ${
                  bundle.meta.paperSize === key ? 'bg-brand-600 text-white' : 'text-ink-soft/65 hover:bg-brand-50'
                }`}
              >
                {PAPER_PRESETS[key].label}
              </button>
            ))}
          </div>
        )}
        <span className="text-[11px] text-ink-soft/55">
          同一份 questions[]，三种视图；答案/分值只存一次
        </span>
        {errors.length > 0 && <span className="rounded-lg bg-red-50 px-2 py-1 text-[10.5px] font-bold text-red-600">{errors.length} 个错误</span>}
        {warnings.length > 0 && <span className="rounded-lg bg-amber-50 px-2 py-1 text-[10.5px] font-bold text-amber-700">{warnings.length} 个提示</span>}
      </div>

      {message && (
        <div className="pbp-no-print rounded-xl border border-brand-200 bg-white px-3 py-2 text-[11px] font-semibold text-ink-soft">
          {message}
        </div>
      )}

      <div className="pbp-print-area">
        {view === 'paper' && (
          <>
            <div className={previewSide === 'front' ? '' : 'pbp-side-inactive hidden'}>
              <PaperView bundle={bundle} preset={paperPreset} side="front" />
            </div>
            <div className={previewSide === 'back' ? '' : 'pbp-side-inactive hidden'}>
              <PaperView bundle={bundle} preset={paperPreset} side="back" />
            </div>
          </>
        )}
        {view === 'answerKey' && <AnswerKeyView bundle={bundle} />}
      </div>

      <p className="pbp-no-print text-[10.5px] text-ink-soft/45">
        原型页：数据保存在本机 localStorage；可导入/导出 paper.bundle.json。后端接入后只需替换存储层。
        <Link to="/papers" className="ml-1 font-bold text-brand-700">返回试卷库</Link>
      </p>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-brand-200/70 bg-white px-3 py-2.5 shadow-soft">
      <p className="text-[10px] font-bold text-ink-soft/50">{label}</p>
      <p className="mt-0.5 text-[15px] font-black text-ink">{value}</p>
    </div>
  )
}

/* ============================== 试卷视图 ============================== */

type PaperPreset = (typeof PAPER_PRESETS)[PaperBundle['meta']['paperSize']]

function PaperView({ bundle, preset, side }: { bundle: PaperBundle; preset: PaperPreset; side: 'front' | 'back' }) {
  const pages = useMemo(() => paginatePaper(bundle), [bundle])
  const shown = pages.filter((p) => (side === 'front' ? p.pageNo <= 2 : p.pageNo > 2))
  const list = shown.length ? shown : pages
  const isA3 = preset.w > 300

  if (isA3) {
    return (
      <div className="flex flex-col items-center gap-6">
        <div
          className="pbp-paper-sheet relative z-[2] mx-auto flex gap-[10mm] bg-white text-ink shadow-[0_8px_40px_rgba(20,20,20,.12)]"
          style={{
            ['--paper-w' as string]: '420mm',
            ['--paper-h' as string]: '297mm',
            width: '420mm',
            height: '297mm',
            padding: '8mm',
          }}
        >
          {[0, 1].map((i) => (
            <PaperA4Page
              key={i}
              bundle={bundle}
              page={list[i] ?? pages[i] ?? null}
              pageNo={i + (side === 'front' ? 1 : 3)}
              totalPages={pages.length}
            />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center gap-6">
      {list.map((page) => (
        <PaperA4Page key={page.pageNo} bundle={bundle} page={page} pageNo={page.pageNo} totalPages={pages.length} />
      ))}
    </div>
  )
}

interface PaperPageData {
  pageNo: number
  sections: Array<{ title: string; instructions?: string; questions: PaperQuestion[] }>
}

/** 按真实 A4 试卷单栏版心做粗略分页：4 页，题多时自动增加 */
function paginatePaper(bundle: PaperBundle): PaperPageData[] {
  const pages: PaperPageData[] = []
  let current: PaperPageData = { pageNo: 1, sections: [] }
  let used = 68 // 第一页表头
  const capacity = 252
  const qHeight = (q: PaperQuestion) =>
    q.options.length ? 20 + Math.max(0, Math.ceil(q.options.length / 2) - 2) * 4 : q.type === 'blank' ? 11 : 45

  for (const section of bundle.sections) {
    const qs = questionsOfSection(bundle, section.id)
    let bucket: PaperPageData['sections'][number] | null = null
    for (const q of qs) {
      const h = qHeight(q)
      if (used + h > capacity && (current.sections.length || bucket)) {
        pages.push(current)
        current = { pageNo: pages.length + 1, sections: [] }
        used = 20
        bucket = null
      }
      if (!bucket) {
        bucket = { title: section.title, instructions: section.instructions, questions: [] }
        current.sections.push(bucket)
        used += 10
      }
      bucket.questions.push(q)
      used += h
    }
  }
  if (current.sections.length) pages.push(current)
  return pages.length ? pages : [{ pageNo: 1, sections: [] }]
}

function PaperA4Page({
  bundle,
  page,
  pageNo,
  totalPages,
}: {
  bundle: PaperBundle
  page: PaperPageData | null
  pageNo: number
  totalPages: number
}) {
  const first = pageNo === 1 || !page
  return (
    <div
      className="pbp-paper-sheet relative z-[2] bg-white text-ink"
      style={{ width: '210mm', height: '297mm', padding: '12mm 14mm', overflow: 'hidden', ['--paper-w' as string]: '210mm', ['--paper-h' as string]: '297mm' }}
    >
      {first && (
        <>
          <p className="text-[10px] font-semibold tracking-[0.2em] text-ink-soft/70">
            绝密★启用前
          </p>
          <header className="mt-4 text-center">
            <h2 className="text-[22px] font-black tracking-[0.1em]">{bundle.meta.title || `${bundle.meta.subject}试卷`}</h2>
            <p className="mt-2 text-[11px] font-bold">{bundle.meta.examName}</p>
            <p className="mt-1 text-[10px] text-ink-soft/70">
              考试时间：{bundle.meta.durationMinutes} 分钟　试卷满分：{bundleTotalScore(bundle)} 分
            </p>
          </header>
          <div className="mt-4 flex justify-between border-y border-ink/20 py-1.5 text-[9px] text-ink-soft/80">
            <span>姓名：__________</span>
            <span>准考证号：______________</span>
            <span>考场号：________</span>
            <span>座位号：______</span>
          </div>
        </>
      )}
      {!first && (
        <p className="mb-3 text-center text-[9px] font-bold text-ink-soft/60">
          {bundle.meta.subject}试卷　第 {pageNo} 页 / 共 {totalPages} 页
        </p>
      )}

      <div className="mt-4 space-y-3" style={{ fontSize: '10px', lineHeight: 1.65 }}>
        {(page?.sections ?? []).map((section, si) => (
          <section key={`${section.title}-${si}`}>
            <div className="flex items-baseline justify-between border-b border-ink/20 pb-1">
              <h3 className="text-[12px] font-black">{section.title}</h3>
              {section.instructions && (
                <span className="text-[8.5px] text-ink-soft/55">{section.instructions}</span>
              )}
            </div>
            <div className="mt-1.5 space-y-2">
              {section.questions.map((q) => (
                <PaperQuestionView key={q.id} q={q} />
              ))}
            </div>
          </section>
        ))}
      </div>

      <footer className="absolute bottom-[8mm] left-[14mm] right-[14mm] flex justify-between border-t border-ink/20 pt-1 text-[8px] text-ink-soft/55">
        <span>请在答题卡指定区域内作答</span>
        <span>{pageNo} / {totalPages}</span>
      </footer>
    </div>
  )
}

function PaperQuestionView({ q }: { q: PaperQuestion }) {
  return (
    <article className="pbp-paper-question leading-[1.5]" style={{ fontSize: 'var(--paper-font)' }}>
      <div className="flex items-start gap-1.5">
        <span className="shrink-0 font-black">{q.number}.</span>
        <div className="min-w-0 flex-1">
          <p className="whitespace-pre-wrap">{q.stem}</p>
          {q.options.length > 0 && (
            <div className="mt-1 grid grid-cols-1 gap-x-3 gap-y-0.5 sm:grid-cols-2">
              {q.options.map((o) => (
                <p key={o.key} className="whitespace-pre-wrap">
                  <span className="font-semibold">{o.key}.</span> {o.text}
                </p>
              ))}
            </div>
          )}
        </div>
        <span className="shrink-0 text-[9px] font-bold text-ink-soft/55">（{q.score} 分）</span>
      </div>
    </article>
  )
}

/* ============================== 答题卡视图 ============================== */

function AnswerKeyView({ bundle }: { bundle: PaperBundle }) {
  return (
    <div className="mx-auto w-full max-w-[210mm] bg-white px-[14mm] py-[12mm] shadow-[0_8px_40px_rgba(20,20,20,.12)]">
      <header className="border-b-2 border-ink/80 pb-3 text-center">
        <h2 className="text-[20px] font-black">{bundle.meta.title} · 参考答案</h2>
        <p className="mt-1 text-[11px] text-ink-soft/65">{bundle.meta.subject} · 满分 {bundleTotalScore(bundle)} 分</p>
      </header>
      {bundle.sections.map((section) => (
        <section key={section.id} className="mt-5">
          <h3 className="border-b border-ink/15 pb-1.5 text-[14px] font-black">{section.title}</h3>
          <div className="mt-3 space-y-3">
            {questionsOfSection(bundle, section.id).map((q) => (
              <div key={q.id} className="flex items-start gap-2 text-[12px] leading-[1.7]">
                <span className="shrink-0 font-black">{q.number}.</span>
                <div className="min-w-0 flex-1">
                  <p>
                    <span className="font-bold text-brand-800">答案：</span>
                    <span className="whitespace-pre-wrap">{q.answer}</span>
                  </p>
                  {q.analysis && (
                    <p className="mt-0.5 text-ink-soft/75">
                      <span className="font-bold">解析：</span>
                      <span className="whitespace-pre-wrap">{q.analysis}</span>
                    </p>
                  )}
                </div>
                <span className="shrink-0 text-[10px] text-ink-soft/50">{q.score} 分</span>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}


import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { makeMockPaperBundle } from '../lib/paper/mock'
import { bundleToPaperV2 } from '../lib/paper/backendV2'
import {
  bundleTotalScore,
  questionsForPage,
  questionsOfSection,
  sectionTotalScore,
  validatePaperBundle,
  type PaperBlock,
  type PaperBundle,
  type PaperCardPage,
  type PaperQuestion,
} from '../lib/paper/types'

const STORAGE_KEY = 'ac.paper.bundle.demo.v1'
type View = 'paper' | 'answerCard' | 'answerKey'

const VIEW_LABEL: Record<View, string> = {
  paper: '试卷',
  answerCard: '答题卡',
  answerKey: '答案页',
}

function loadBundle(): PaperBundle {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return makeMockPaperBundle()
    const parsed = JSON.parse(raw) as PaperBundle
    if (parsed?.schema !== 'paper-bundle') return makeMockPaperBundle()
    return parsed
  } catch {
    return makeMockPaperBundle()
  }
}

export default function PaperBundlePage() {
  const [bundle, setBundle] = useState<PaperBundle>(loadBundle)
  const [view, setView] = useState<View>('paper')
  const [message, setMessage] = useState('')

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
        @media print {
          @page { size: A4; margin: 0; }
          body { background: #fff !important; }
          .pbp-no-print, .site-sidebar, .sidebar-toggle-btn, .mo-dock-wrap { display: none !important; }
          main { padding: 0 !important; }
          main > div { max-width: none !important; padding: 0 !important; }
          main > div > div { animation: none !important; transform: none !important; }
          .pbp-page { display: block !important; }
          .pbp-print-area { display: block !important; }
          .pbp-paper-sheet { box-shadow: none !important; margin: 0 !important; }
          .pbp-answer-card-sheet {
            --pbp-card-scale: 1;
            width: 210mm !important;
            height: 297mm !important;
            box-shadow: none !important;
            border: 0 !important;
            page-break-after: always;
            break-after: page;
          }
          .pbp-answer-card-sheet:last-child { page-break-after: auto; break-after: auto; }
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
          </div>
          <p className="mt-1 text-[12px] text-ink-soft/65">
            {bundle.meta.examName} · {bundle.meta.durationMinutes} 分钟 · {bundle.meta.paperSize}{' '}
            {bundle.meta.orientation === 'portrait' ? '竖版' : '横版'} ·{' '}
            {bundle.meta.sides === 2 ? '双面' : '单面'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
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
          <button type="button" onClick={() => window.print()} className="rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 px-4 py-2 text-[11.5px] font-bold text-white shadow-soft">
            打印当前视图
          </button>
        </div>
      </div>

      <div className="pbp-no-print grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="题目" value={`${bundle.questions.length} 道`} />
        <Stat label="总分" value={`${total} 分`} />
        <Stat label="大题" value={`${bundle.sections.length} 个`} />
        <Stat label="答题卡" value={`${bundle.answerCard.pages.length} 页`} />
      </div>

      <div className="pbp-no-print flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-xl bg-brand-100/70 p-1">
          {(Object.keys(VIEW_LABEL) as View[]).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              className={`rounded-lg px-4 py-1.5 text-[11.5px] font-bold transition ${
                view === v ? 'bg-white text-brand-800 shadow-sm' : 'text-ink-soft/65'
              }`}
            >
              {VIEW_LABEL[v]}
            </button>
          ))}
        </div>
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
        {view === 'paper' && <PaperView bundle={bundle} />}
        {view === 'answerCard' && <AnswerCardView bundle={bundle} />}
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

function PaperView({ bundle }: { bundle: PaperBundle }) {
  return (
    <div className="pbp-paper-sheet mx-auto w-full max-w-[210mm] bg-white px-[14mm] py-[12mm] text-ink shadow-[0_8px_40px_rgba(20,20,20,.12)]">
      <header className="border-b-2 border-ink/80 pb-3 text-center">
        <h2 className="text-[20px] font-black tracking-wide">{bundle.meta.title}</h2>
        <p className="mt-1 text-[11px] text-ink-soft/70">
          {bundle.meta.examName} · {bundle.meta.subject} · {bundle.meta.durationMinutes} 分钟 · 满分 {bundleTotalScore(bundle)} 分
        </p>
      </header>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-ink/15 px-3 py-2 text-[11px] text-ink-soft/70">
        <span>姓名：__________</span>
        <span>准考证号：____________</span>
        <span>座号：______</span>
        <span>得分：______</span>
      </div>

      {bundle.sections.map((section) => {
        const qs = questionsOfSection(bundle, section.id)
        return (
          <section key={section.id} className="mt-5">
            <div className="flex items-baseline justify-between gap-3 border-b border-ink/15 pb-1.5">
              <h3 className="text-[14px] font-black">{section.title}</h3>
              <span className="text-[10px] font-semibold text-ink-soft/55">
                {section.instructions || ''} · 共 {qs.length} 题 · {sectionTotalScore(bundle, section.id)} 分
              </span>
            </div>
            <div className="mt-3 space-y-4">
              {qs.map((q) => (
                <PaperQuestionView key={q.id} q={q} />
              ))}
            </div>
          </section>
        )
      })}
    </div>
  )
}

function PaperQuestionView({ q }: { q: PaperQuestion }) {
  return (
    <article className="text-[12px] leading-[1.75]">
      <div className="flex items-start gap-2">
        <span className="shrink-0 font-black">{q.number}.</span>
        <div className="min-w-0 flex-1">
          <p className="whitespace-pre-wrap">{q.stem}</p>
          {q.options.length > 0 && (
            <div className="mt-1 grid grid-cols-1 gap-x-4 gap-y-0.5 sm:grid-cols-2">
              {q.options.map((o) => (
                <p key={o.key} className="whitespace-pre-wrap">
                  <span className="font-semibold">{o.key}.</span> {o.text}
                </p>
              ))}
            </div>
          )}
        </div>
        <span className="shrink-0 text-[10px] font-bold text-ink-soft/50">（{q.score} 分）</span>
      </div>
    </article>
  )
}

/* ============================== 答题卡视图 ============================== */

function AnswerCardView({ bundle }: { bundle: PaperBundle }) {
  const [front, back] = bundle.answerCard.pages
  const pages = [front, back].filter(Boolean)
  return (
    <div className="flex flex-wrap items-start justify-center gap-5">
      {pages.map((page) => (
        <CardPage key={page.id} bundle={bundle} page={page} />
      ))}
    </div>
  )
}

function CardPage({ bundle, page }: { bundle: PaperBundle; page: PaperCardPage }) {
  const qs = questionsForPage(bundle, page.side)
  return (
    <div className="flex w-full max-w-[520px] flex-col items-center gap-1.5">
      <div
        className="pbp-answer-card-sheet relative w-full overflow-hidden border border-neutral-300 bg-white shadow-[0_8px_40px_rgba(20,20,20,.12)]"
        style={{ aspectRatio: `${page.canvas.width} / ${page.canvas.height}` }}
      >
        {page.markers.map((m) => (
          <span
            key={m.id}
            className="absolute border-2 border-neutral-800 bg-neutral-900"
            style={{
              left: pct(m.x, page.canvas.width),
              top: pct(m.y, page.canvas.height),
              width: pct(m.size, page.canvas.width),
              height: pct(m.size, page.canvas.height),
            }}
          />
        ))}
        {page.blocks.map((b) => (
          <BlockView key={b.id} block={b} page={page} />
        ))}
        {page.side === 'front' && bundle.answerCard.barcode && (
          <BarcodePlaceholder bundle={bundle} page={page} />
        )}
        {qs.map((q) => (
          <CardQuestionView key={q.id} q={q} page={page} />
        ))}
        <span
          className="pbp-question-type absolute text-neutral-400"
          style={{ left: '82%', top: '95%' }}
        >
          {page.side === 'front' ? '正面' : '背面'}
        </span>
      </div>
      <p className="text-[10px] font-bold text-neutral-500">
        {page.side === 'front' ? '正面' : '背面'} · {page.paperSize} · {qs.length} 个题区
      </p>
    </div>
  )
}

function BlockView({ block, page }: { block: PaperBlock; page: PaperCardPage }) {
  return (
    <div
      className="pbp-block-text absolute whitespace-pre-wrap text-neutral-900"
      style={{
        left: pct(block.region.x, page.canvas.width),
        top: pct(block.region.y, page.canvas.height),
        width: pct(block.region.width, page.canvas.width),
        height: pct(block.region.height, page.canvas.height),
        fontWeight: block.style?.fontWeight ?? 'normal',
        textAlign: block.style?.textAlign ?? 'left',
        lineHeight: 1.35,
      }}
    >
      {block.text}
    </div>
  )
}

function BarcodePlaceholder({ bundle, page }: { bundle: PaperBundle; page: PaperCardPage }) {
  const b = bundle.answerCard.barcode
  if (!b || b.page !== page.side) return null
  return (
    <div
      className="absolute flex items-center justify-center border border-dashed border-neutral-400 text-neutral-400"
      style={{
        left: pct(b.region.x, page.canvas.width),
        top: pct(b.region.y, page.canvas.height),
        width: pct(b.region.width, page.canvas.width),
        height: pct(b.region.height, page.canvas.height),
      }}
    >
      <span className="pbp-question-type">条形码区</span>
    </div>
  )
}

function CardQuestionView({ q, page }: { q: PaperQuestion; page: PaperCardPage }) {
  const r = q.answerCard.region
  const subjective = q.answerCard.type === 'subjective'
  return (
    <div
      className="absolute"
      style={{
        left: pct(r.x, page.canvas.width),
        top: pct(r.y, page.canvas.height),
        width: pct(r.width, page.canvas.width),
        height: pct(r.height, page.canvas.height),
      }}
    >
      <div className="absolute inset-0 rounded-[2px] border border-neutral-300">
        {subjective && (
          <div
            className="absolute inset-x-1 bottom-1 top-4"
            style={{
              backgroundImage:
                'repeating-linear-gradient(to bottom, transparent 0, transparent 17px, #d7d7d7 17px, #d7d7d7 18px)',
            }}
          />
        )}
      </div>
      <span className="pbp-question-no absolute -top-0.5 left-1 font-bold text-neutral-800">{q.number}</span>
      <span className="pbp-question-type absolute -top-0.5 right-1 text-neutral-400">
        {subjective ? '主观' : '选择'}
      </span>
      {!subjective &&
        q.answerCard.choices?.map((c) => (
          <span
            key={c.value}
            className="absolute grid place-items-center rounded-full border border-neutral-500 text-[8px] leading-none text-neutral-600"
            style={{
              left: pct(c.region.x, r.width),
              top: pct(c.region.y, r.height),
              width: pct(c.region.width, r.width),
              height: pct(c.region.height, r.height),
            }}
          >
            {c.value}
          </span>
        ))}
    </div>
  )
}

/* ============================== 答案视图 ============================== */

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

function pct(n: number, total: number): string {
  return `${(n / total) * 100}%`
}


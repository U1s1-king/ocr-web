import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useToast } from '../../components/Toast'
import { papersApi, type PaperSummary } from '../api'
import { IcGrid, IcLayers, IcPlus, IcRight, IcSearch, IcSpark } from '../icons'
import { Btn, DemoTag, Empty, ErrorBar, ListSkeleton, Page, Sheet, useLoad } from '../ui'
import { validatePaperName } from '../../lib/paperName'
import { StatsStrip } from '../StatsStrip'
import { CARD_TEMPLATES, CATALOG_SYSTEMS, type CardTemplate } from '../../lib/card/catalog'

type Tab = 'mine' | 'templates'

/**
 * 试卷页版式参照 vivo「应用」页：
 * 顶部大标题 → 分段胶囊 → 推荐精选横滑卡 → 全部模板 / 试卷排行榜行。
 */
export default function Papers() {
  const nav = useNavigate()
  const toast = useToast()
  const [tab, setTab] = useState<Tab>('mine')
  const [system, setSystem] = useState('全部')
  const [q, setQ] = useState('')
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)

  const list = useLoad<PaperSummary[]>(
    () => papersApi.list(),
    [] as { id: number; name: string }[],
    [],
    'papers.list',
  )

  const filtered = useMemo(() => list.data.filter((p) => !q || p.name.includes(q)), [list.data, q])

  const templates = useMemo(() => {
    return CARD_TEMPLATES.filter((t) => (system === '全部' ? true : t.systemLabel === system)).filter(
      (t) => !q || t.name.includes(q) || t.subject.includes(q),
    )
  }, [system, q])

  const recommended = useMemo(() => {
    // 推荐位取各体系标准版，保证首页轮播有代表性
    const picks: CardTemplate[] = []
    for (const s of ['普高', '职教', '中考', '通用']) {
      const hit =
        CARD_TEMPLATES.find((t) => t.systemLabel === s && t.variant === '标准版') ??
        CARD_TEMPLATES.find((t) => t.systemLabel === s)
      if (hit) picks.push(hit)
      if (picks.length >= 4) break
    }
    return picks
  }, [])

  async function create() {
    const bad = validatePaperName(name, list.data.map((p) => p.name))
    if (bad) {
      toast(bad, 'err')
      return
    }
    setSaving(true)
    try {
      const p = await papersApi.create(name.trim())
      toast('试卷已创建', 'ok')
      setCreating(false)
      setName('')
      nav(`/m/papers/${p.id}`)
    } catch (err) {
      toast(err instanceof Error ? err.message : '创建失败', 'err')
    } finally {
      setSaving(false)
    }
  }

  function useTemplate(t: CardTemplate) {
    nav(`/m/papers/studio?tpl=${encodeURIComponent(t.id)}`)
  }

  return (
    <Page
      title="试卷"
      sub="模板与答题卡"
      actions={
        <div className="flex gap-2">
          {list.demo && <DemoTag />}
          <button type="button" className="mo-icon-btn" aria-label="新建试卷" onClick={() => setCreating(true)}>
            <IcPlus style={{ fontSize: 18 }} />
          </button>
        </div>
      }
    >
      <StatsStrip
        className="mb-3"
        items={[
          { label: '我的试卷', value: list.data.length },
          { label: '答题卡模板', value: CARD_TEMPLATES.length },
          { label: '推荐模板', value: recommended.length },
        ]}
      />

      <div className="mo-quick mt-3">
        {[
          { label: '答题卡制作', to: '/m/papers/studio', Icon: IcGrid },
          { label: '条形码制作', to: '/m/papers/barcode', Icon: IcLayers },
          { label: '文本出卡', to: '/m/papers/dsl', Icon: IcSpark },
        ].map(({ label, to, Icon }) => (
          <button key={to} type="button" className="mo-quick-item" onClick={() => nav(to)}>
            <span className="mo-quick-ico"><Icon style={{ fontSize: 19 }} /></span>
            <span>{label}</span>
          </button>
        ))}
      </div>

      {/* 分段胶囊 */}
      <div className="mo-seg mb-3">
        <button
          type="button"
          className="mo-seg-item"
          data-active={tab === 'mine'}
          onClick={() => setTab('mine')}
        >
          我的试卷
        </button>
        <button
          type="button"
          className="mo-seg-item"
          data-active={tab === 'templates'}
          onClick={() => setTab('templates')}
        >
          答题卡模板
        </button>
      </div>

      <div className="relative">
        <IcSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-brand-400" style={{ fontSize: 16 }} />
        <input
          className="mo-input !bg-white pl-10"
          placeholder={tab === 'mine' ? '搜索试卷名' : '搜索模板 / 科目'}
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      {tab === 'mine' ? (
        <>
          {list.error && (
            <div className="mt-3">
              <ErrorBar text={list.error} onRetry={list.reload} />
            </div>
          )}

          <div className="mt-4">
            {list.loading ? (
              <ListSkeleton rows={3} />
            ) : filtered.length === 0 ? (
              <div className="space-y-3">
                {!q && (
                  <>
                    <button type="button" className="mo-feed mo-feed-dark" onClick={() => setCreating(true)}>
                      <span className="mo-feed-ico">
                        <IcPlus style={{ fontSize: 22 }} />
                      </span>
                      <span className="mo-feed-eyebrow">新建</span>
                      <span className="mo-feed-title">空白答题卡</span>
                      <span className="mo-feed-desc">自己建一张卷，再进精调页加题区与答案键</span>
                      <span className="mo-feed-foot">
                        开始创建 <IcRight style={{ fontSize: 13 }} />
                      </span>
                    </button>
                    <button type="button" className="mo-feed mo-feed-light" onClick={() => setTab('templates')}>
                      <span className="mo-feed-ico">
                        <IcGrid style={{ fontSize: 21 }} />
                      </span>
                      <span className="mo-feed-eyebrow" style={{ color: 'var(--mo-ink-2)' }}>答题卡模板</span>
                      <span className="mo-feed-title text-[23px]">{CARD_TEMPLATES.length} 份答题卡模板</span>
                      <span className="mo-feed-desc" style={{ color: 'var(--mo-ink-2)' }}>按体系/科目/纸型自动出卡，不用手画</span>
                      <span className="mo-feed-foot text-brand-700">
                        去选模板 <IcRight style={{ fontSize: 13 }} />
                      </span>
                    </button>
                  </>
                )}
                {q && (
                  <Empty
                    icon={<IcLayers style={{ fontSize: 24 }} />}
                    title="没有找到这张试卷"
                    tip="换个关键词试试"
                  />
                )}
              </div>
            ) : (
              <div className="mo-list">
                {filtered.map((p, i) => (
                  <button
                    key={p.id}
                    type="button"
                    className={`mo-list-row ${i === filtered.length - 1 ? 'is-last' : ''}`}
                    onClick={() => nav(`/m/papers/${p.id}`)}
                  >
                    <span className="mo-rank-num">{i + 1}</span>
                    <span className="mo-rank-thumb">
                      <IcLayers style={{ fontSize: 19 }} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="mo-rank-title block truncate">{p.name}</span>
                      <span className="mo-rank-sub block truncate">试卷 #{p.id}</span>
                    </span>
                    <span className="mo-btn-soft flex-none">编辑</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </>
      ) : (
        <>
          {/* 推荐精选：横滑大卡 */}
          <div className="mo-sec-head mt-5 mb-2.5">
            <h2 className="mo-eyebrow">推荐精选</h2>
            <span className="text-[11.5px] text-ink-soft"></span>
          </div>
          <div className="mo-hscroll mo-carousel -mx-4 px-4">
            {recommended.map((t) => (
              <div key={t.id} className="mo-template-card">
                <div className="mo-template-cover">
                  <div>
                    <p className="text-[10.5px] font-semibold opacity-75">答题卡模板</p>
                    <p className="mt-1.5 text-[18px] font-black leading-tight">
                      {t.systemLabel} · {t.subject}
                    </p>
                    <p className="mt-1 text-[11px] opacity-75">
                      {t.size} · {t.variant} · 满分 {t.fullScore}
                    </p>
                  </div>
                  <span className="grid h-10 w-10 flex-none place-items-center rounded-[12px] bg-white/15">
                    <IcLayers style={{ fontSize: 19 }} />
                  </span>
                </div>
                <div className="mo-template-body">
                  <p className="truncate text-[12.5px] font-bold text-ink">{t.name}</p>
                  <p className="mo-muted mt-1 line-clamp-2 h-[34px] text-[10.5px]">{t.hint}</p>
                  <button type="button" className="mo-btn-soft mt-2.5 w-full" onClick={() => useTemplate(t)}>
                    使用模板
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* 体系分类胶囊 */}
          <div className="mo-chip-row mt-4">
            {CATALOG_SYSTEMS.map((s) => (
              <button
                key={s}
                type="button"
                className="mo-chip"
                data-active={system === s}
                onClick={() => setSystem(s)}
              >
                {s}
              </button>
            ))}
          </div>

          <div className="mo-sec-head mt-1 mb-2.5">
            <h2 className="mo-eyebrow">全部模板</h2>
            <span className="text-[11.5px] text-ink-soft">{templates.length} 份</span>
          </div>
          <div className="mo-list">
            {templates.map((t, i) => (
              <div
                key={t.id}
                className={`mo-list-row ${i === templates.length - 1 ? 'is-last' : ''}`}
                onClick={() => useTemplate(t)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') useTemplate(t)
                }}
              >
                <span className="mo-rank-num">{i + 1}</span>
                <span className="mo-rank-thumb">
                  <IcLayers style={{ fontSize: 19 }} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="mo-rank-title block truncate">{t.name}</span>
                  <span className="mo-rank-sub block truncate">
                    {t.systemLabel} · {t.size} · {t.variant} · {t.fullScore} 分
                  </span>
                </span>
                <button
                  type="button"
                  className="mo-btn-soft flex-none"
                  onClick={(e) => {
                    e.stopPropagation()
                    useTemplate(t)
                  }}
                >
                  使用
                </button>
              </div>
            ))}
          </div>

          <div className="mo-card mt-3 flex items-start gap-3">
            <span className="grid h-10 w-10 flex-none place-items-center rounded-[13px] bg-brand-100 text-brand-700">
              <IcSpark style={{ fontSize: 18 }} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[12px] font-extrabold">答题卡模板</p>
              <p className="mo-muted mt-0.5">选模板后可调题量、换纸型、精调坐标，再保存为试卷或打印。</p>
            </div>
          </div>
          <button type="button" className="mo-card mt-3 flex w-full items-center gap-3 text-left" onClick={() => nav('/m/papers/dsl')}>
            <span className="grid h-10 w-10 flex-none place-items-center rounded-[13px] bg-brand-100 text-brand-700">
              <IcLayers style={{ fontSize: 18 }} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[12px] font-extrabold">文本出卡 DSL</span>
              <span className="mo-muted mt-0.5 block">一行一题，快速批量生成答题卡</span>
            </span>
            <IcRight style={{ fontSize: 14 }} />
          </button>
        </>
      )}

      <Sheet
        open={creating}
        onClose={() => setCreating(false)}
        title="新建空白试卷"
        footer={
          <Btn block disabled={saving} onClick={create}>
            {saving ? '创建中…' : '创建并配置'}
          </Btn>
        }
      >
        <div className="space-y-4">
          <label className="mo-field">
            <span className="mo-field-label">试卷名</span>
            <input
              className="mo-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例如：高一数学第一次月考"
            />
          </label>
          <div className="rounded-2xl bg-brand-50 p-3">
            <p className="flex items-center gap-1.5 text-[11px] font-extrabold text-brand-800">
              <IcSpark style={{ fontSize: 14 }} /> 也可以直接用模板
            </p>
            <p className="mo-muted mt-1">答题卡模板自带 54 份标准版式，选一份再改比从零画快得多。</p>
            <button
              type="button"
              className="mt-2 text-[11.5px] font-bold text-brand-700"
              onClick={() => {
                setCreating(false)
                setTab('templates')
              }}
            >
              去选模板 →
            </button>
          </div>
        </div>
      </Sheet>
    </Page>
  )
}

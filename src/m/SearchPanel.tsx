import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { INPUT_DEBOUNCE, filesApi, type FileItem } from './api'
import { MODULES, MODULE_TONE } from '../lib/modules'
import { IcFile, IcImage, IcRight, IcSearch, IcUpload, IcX } from './icons'

/* ---------------- 功能索引：八大模块 + 三级页 + 常用动作 ---------------- */

type FnHit = { label: string; to: string; group: string; keys: string }

const ACTIONS: FnHit[] = [
  { label: '拍照识别一份答题卡', to: '/m/capture', group: '动作', keys: '拍照 识别 扫描 上传 camera' },
  { label: '新建考试', to: '/m/exams/new', group: '动作', keys: '新建 考试 创建' },
  { label: '上传文件', to: '/m/files', group: '动作', keys: '上传 文件 图片' },
  { label: '接口设置', to: '/m/settings', group: '动作', keys: '设置 接口 地址 token' },
  { label: '主题色', to: '/m/theme', group: '动作', keys: '主题 颜色 外观' },
]

const FUNCTION_INDEX: FnHit[] = [
  ...MODULES.map((m) => ({
    label: m.label,
    to: m.m,
    group: '模块',
    keys: `${m.label} ${m.hint} ${m.desc} ${m.id}`,
  })),
  ...MODULES.flatMap((m) =>
    m.children
      .filter((c) => c.m)
      .map((c) => ({
        label: `${m.label} · ${c.label}`,
        to: c.m as string,
        group: '功能',
        keys: `${m.label} ${c.label} ${(c.keys ?? []).join(' ')}`,
      })),
  ),
  ...ACTIONS,
]

function score(hay: string, q: string): number {
  const h = hay.toLowerCase()
  if (h.includes(q)) return 100 - Math.min(60, h.indexOf(q))
  // 逐字命中，允许「复核」「主观题」这类短语搜法
  const chars = [...new Set(q)]
  const hit = chars.filter((c) => h.includes(c)).length
  return hit === chars.length ? 30 + hit : 0
}

/* ---------------- 面板本体 ---------------- */

export default function SearchPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const nav = useNavigate()
  const [q, setQ] = useState('')
  const [files, setFiles] = useState<FileItem[]>([])
  const [fileState, setFileState] = useState<'idle' | 'loading' | 'error'>('idle')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      const t = window.setTimeout(() => inputRef.current?.focus(), 120)
      return () => window.clearTimeout(t)
    }
    setQ('')
    setFiles([])
    setFileState('idle')
  }, [open])

  // 文件搜索：防抖，空词不请求
  useEffect(() => {
    const kw = q.trim()
    if (!open || kw.length === 0) {
      setFiles([])
      setFileState('idle')
      return
    }
    let alive = true
    setFileState('loading')
    const t = window.setTimeout(() => {
      filesApi
        .search({ q: kw, limit: 8 })
        .then((r) => {
          if (alive) {
            setFiles(r.items ?? [])
            setFileState('idle')
          }
        })
        .catch(() => {
          if (alive) {
            setFiles([])
            setFileState('error')
          }
        })
    }, INPUT_DEBOUNCE)
    return () => {
      alive = false
      window.clearTimeout(t)
    }
  }, [q, open])

  const fnHits = useMemo(() => {
    const kw = q.trim().toLowerCase()
    if (!kw) return FUNCTION_INDEX.slice(0, 8)
    return FUNCTION_INDEX.map((f) => ({ f, s: score(`${f.label} ${f.keys}`, kw) }))
      .filter((x) => x.s > 0)
      .sort((a, b) => b.s - a.s)
      .slice(0, 8)
      .map((x) => x.f)
  }, [q])

  if (!open) return null

  function go(to: string) {
    onClose()
    nav(to)
  }

  return (
    <>
      <div className="mo-backdrop" onClick={onClose} />
      <div className="mo-sheet" role="dialog" aria-modal="true" aria-label="搜索">
        <div className="mo-sheet-grip" />
        <div className="flex items-center gap-2 px-4 pt-3 pb-2">
          <span className="flex h-9 flex-1 items-center gap-2 rounded-full bg-[#f2f3f6] px-3">
            <IcSearch style={{ fontSize: 16 }} className="flex-none text-ink-soft" />
            <input
              ref={inputRef}
              value={q}
              placeholder="搜功能，或搜上传过的文件"
              className="w-full bg-transparent text-[13.5px] outline-none placeholder:text-ink-soft/70"
              onChange={(e) => setQ(e.target.value)}
            />
            {q && (
              <button type="button" aria-label="清空" onClick={() => setQ('')} className="flex-none text-ink-soft">
                <IcX style={{ fontSize: 14 }} />
              </button>
            )}
          </span>
          <button type="button" className="flex-none px-1 text-[13px] text-ink-soft" onClick={onClose}>
            取消
          </button>
        </div>

        <div className="mo-sheet-body !px-4">
          <p className="mo-field-label !mb-1.5">{q.trim() ? '功能' : '常用'}</p>
          <div className="mo-list">
            {fnHits.length === 0 && <p className="px-3 py-4 text-[12.5px] text-ink-soft">没有匹配的功能</p>}
            {fnHits.map((f, i) => {
              const mod = MODULES.find((m) => m.label === f.group || f.label.startsWith(m.label))
              const tone = MODULE_TONE[mod?.tone ?? 'slate']
              return (
                <button
                  key={f.to + f.label}
                  type="button"
                  className={`mo-list-row ${i === fnHits.length - 1 ? 'is-last' : ''}`}
                  onClick={() => go(f.to)}
                >
                  <span
                    className="grid h-8 w-8 flex-none place-items-center rounded-lg"
                    style={{ background: tone.bg, color: tone.fg }}
                  >
                    <IcSearch style={{ fontSize: 14 }} />
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[13.5px] text-ink">{f.label}</span>
                  <span className="flex-none text-[11px] text-ink-soft">{f.group}</span>
                  <IcRight style={{ fontSize: 13 }} className="flex-none text-ink-soft/50" />
                </button>
              )
            })}
          </div>

          {q.trim() && (
            <>
              <div className="mt-4 mb-1.5 flex items-center justify-between">
                <p className="mo-field-label !mb-0">上传的文件</p>
                <button
                  type="button"
                  className="text-[11.5px] text-ink-soft"
                  onClick={() => go(`/m/files?q=${encodeURIComponent(q.trim())}`)}
                >
                  去文件库搜
                </button>
              </div>
              <div className="mo-list">
                {fileState === 'loading' && (
                  <p className="px-3 py-4 text-[12.5px] text-ink-soft">搜索中…</p>
                )}
                {fileState === 'error' && (
                  <p className="px-3 py-4 text-[12.5px] text-ink-soft">文件搜索暂时不可用</p>
                )}
                {fileState === 'idle' && files.length === 0 && (
                  <p className="px-3 py-4 text-[12.5px] text-ink-soft">没有找到相关文件</p>
                )}
                {files.map((f, i) => (
                  <button
                    key={f.fileId}
                    type="button"
                    className={`mo-list-row ${i === files.length - 1 ? 'is-last' : ''}`}
                    onClick={() => go(`/m/files?q=${encodeURIComponent(f.name)}`)}
                  >
                    <span className="grid h-8 w-8 flex-none place-items-center rounded-lg bg-[#eef0f3] text-[#5c6570]">
                      {/^\.?(png|jpe?g|bmp|webp|gif)$/i.test(f.suffix) ? (
                        <IcImage style={{ fontSize: 14 }} />
                      ) : (
                        <IcFile style={{ fontSize: 14 }} />
                      )}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[13.5px] text-ink">{f.name}</span>
                    <span className="flex-none text-[11px] text-ink-soft">#{f.fileId}</span>
                  </button>
                ))}
              </div>
              <button
                type="button"
                className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl bg-[#f2f3f6] py-2.5 text-[13px] text-ink-soft"
                onClick={() => go('/m/files')}
              >
                <IcUpload style={{ fontSize: 14 }} />
                上传新文件
              </button>
            </>
          )}
        </div>
      </div>
    </>
  )
}

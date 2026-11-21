import { useEffect, useMemo, useState } from 'react'
import { PageHeader } from '../components/PageHeader'
import { Badge, Button, Card, Field, inputCls } from '../components/ui'
import { studentsApi, type Student } from '../m/api'
import { BARCODE_FORMATS, BarcodeSvg, validateBarcode } from '../lib/card/barcode'
import type { CardBarcodeFormat } from '../lib/card/types'
import { downloadText } from '../lib/image'

/**
 * 条形码制作：以学生考号为数据源批量生成条形码标签，前端 SVG 渲染 + 打印。
 */
export default function BarcodeStudioPage() {
  const [students, setStudents] = useState<Student[]>([])
  const [format, setFormat] = useState<CardBarcodeFormat>('CODE128')
  const [q, setQ] = useState('')
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [prefix, setPrefix] = useState('')
  const [suffix, setSuffix] = useState('')

  useEffect(() => {
    let alive = true
    studentsApi.list().then((list) => {
      if (!alive) return
      setStudents(list)
      const valid = new Set(
        list
          .filter((s) => s.candidateNumber && !validateBarcode(format, `${prefix}${s.candidateNumber}${suffix}`))
          .map((s) => keyOf(s)),
      )
      setPicked(valid)
    })
    return () => {
      alive = false
    }
    // 只在首次加载时自动勾选
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const rows = useMemo(() => {
    const kw = q.trim().toLowerCase()
    return students
      .map((s) => {
        const value = `${prefix}${s.candidateNumber ?? ''}${suffix}`
        const error = s.candidateNumber ? validateBarcode(format, value) : '缺少考号'
        return { s, value, error }
      })
      .filter((r) => !kw || r.s.name.toLowerCase().includes(kw) || (r.s.candidateNumber ?? '').toLowerCase().includes(kw))
  }, [students, q, prefix, suffix, format])

  const selectedRows = rows.filter((r) => picked.has(keyOf(r.s)) && !r.error)
  const allValid = rows.filter((r) => !r.error)

  function keyOf(s: Student): string {
    return s.candidateNumber || `id-${s.id ?? s.name}`
  }

  function toggle(s: Student) {
    const k = keyOf(s)
    setPicked((cur) => {
      const next = new Set(cur)
      if (next.has(k)) next.delete(k)
      else next.add(k)
      return next
    })
  }

  function selectAll(select: boolean) {
    setPicked(select ? new Set(allValid.map((r) => keyOf(r.s))) : new Set())
  }

  function exportJson() {
    downloadText(
      JSON.stringify(
        selectedRows.map((r) => ({
          name: r.s.name,
          candidateNumber: r.s.candidateNumber,
          className: r.s.className,
          format,
          value: r.value,
        })),
        null,
        2,
      ),
      '学生条形码数据.json',
    )
  }

  return (
    <div className="anim-page-in space-y-4">
      <PageHeader
        title="条形码制作"
        desc="以学生考号为数据源，自动生成 Code128/Code39/EAN-13/ITF-14 条形码，前端 SVG 渲染并打印标签。"
        crumb={[{ label: '试卷', to: '/papers' }, { label: '条形码制作' }]}
        extra={
          <>
            <Badge tone="ok">{selectedRows.length} 张已选</Badge>
            <Button variant="ghost" onClick={exportJson} disabled={selectedRows.length === 0}>
              导出数据 JSON
            </Button>
            <Button onClick={() => window.print()} disabled={selectedRows.length === 0}>
              打印标签
            </Button>
          </>
        }
      />

      <Card>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="条形码格式">
            <select className={inputCls} value={format} onChange={(e) => setFormat(e.target.value as CardBarcodeFormat)}>
              {BARCODE_FORMATS.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label} · {f.hint}
                </option>
              ))}
            </select>
          </Field>
          <Field label="前缀（可选）">
            <input className={inputCls} value={prefix} onChange={(e) => setPrefix(e.target.value.replace(/\s/g, ''))} placeholder="例如 EX" />
          </Field>
          <Field label="后缀（可选）">
            <input className={inputCls} value={suffix} onChange={(e) => setSuffix(e.target.value.replace(/\s/g, ''))} placeholder="例如 01" />
          </Field>
          <Field label="搜索学生">
            <input className={inputCls} value={q} onChange={(e) => setQ(e.target.value)} placeholder="姓名 / 考号" />
          </Field>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button size="sm" variant="ghost" onClick={() => selectAll(true)} disabled={allValid.length === 0}>
            全选有效
          </Button>
          <Button size="sm" variant="ghost" onClick={() => selectAll(false)}>
            清空选择
          </Button>
          <span className="text-[11px] text-ink-soft/65">
            共 {students.length} 名学生 · 有效考号 {allValid.length} · 已选 {selectedRows.length}
          </span>
          {students.length === 0 && (
            <span className="text-[11px] font-semibold text-amber-700">
              本机还没有学生名单，请先到「学生」页导入学生考号。
            </span>
          )}
        </div>
      </Card>

      <Card>
        <div className="flex items-center justify-between">
          <p className="text-[12px] font-bold text-ink">标签预览</p>
          <p className="text-[10.5px] text-ink-soft/55">A4 · 每行 4 张 · 打印时只输出标签区域</p>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {rows.map(({ s, value, error }) => {
            const k = keyOf(s)
            const on = picked.has(k) && !error
            return (
              <button
                key={k}
                type="button"
                onClick={() => toggle(s)}
                disabled={Boolean(error)}
                className={`rounded-xl border p-2 text-left transition ${
                  error
                    ? 'cursor-not-allowed border-red-200 bg-red-50/50 opacity-60'
                    : on
                      ? 'border-brand-400 bg-brand-50/60'
                      : 'border-brand-100 bg-white hover:border-brand-300'
                }`}
              >
                <div className="flex items-center justify-between gap-1">
                  <span className="min-w-0 truncate text-[11px] font-bold text-ink">{s.name}</span>
                  <span className={`h-3.5 w-3.5 flex-none rounded border text-center text-[9px] leading-[13px] ${on ? 'border-brand-600 bg-brand-600 text-white' : 'border-brand-200 text-transparent'}`}>
                    ✓
                  </span>
                </div>
                <div className="mt-1 truncate text-[10px] text-ink-soft/65">{s.candidateNumber ?? '无考号'}{s.className ? ` · ${s.className}` : ''}</div>
                <div className="mt-1.5 h-[42px] overflow-hidden rounded bg-white px-1">
                  {error ? (
                    <p className="pt-3 text-center text-[9px] font-semibold text-red-600">{error}</p>
                  ) : (
                    <BarcodeSvg format={format} value={value} showText={false} />
                  )}
                </div>
              </button>
            )
          })}
        </div>
        {rows.length === 0 && <p className="py-8 text-center text-[12px] text-ink-soft/60">没有匹配的学生</p>}
      </Card>

      <Card className="print-hide">
        <p className="text-[11px] leading-relaxed text-ink-soft/60">
          条形码内容 = 前缀 + 学生考号 + 后缀。默认 Code128；EAN-13 需要 12/13 位数字，ITF-14 需要 13/14 位数字。打印标签时只输出下方预览区。
        </p>
      </Card>

      <div className="barcode-print-area">
        <div className="barcode-print-head">
          <h1>学生条形码</h1>
          <p>{format} · 共 {selectedRows.length} 张 · {new Date().toLocaleDateString('zh-CN')}</p>
        </div>
        <div className="barcode-print-grid">
          {selectedRows.map(({ s, value }) => (
            <div key={keyOf(s)} className="barcode-print-label">
              <div className="barcode-print-name">{s.name}</div>
              <div className="barcode-print-code">
                <BarcodeSvg format={format} value={value} showText />
              </div>
              <div className="barcode-print-meta">{s.className ?? ''}{s.className ? ' · ' : ''}{value}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

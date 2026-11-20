/**
 * 结果导出：TXT / JSON / CSV 三种格式。
 *
 * 导出的是浏览器里保存的整份识别记录（题目、答案、对错、置信度），
 * 不依赖后端是否还能取回当次结果。
 */
import { downloadText } from './image'
import { formatScanTime, type OfflineScan } from './offlineHistory'

export type ExportFormat = 'txt' | 'json' | 'csv'

export const EXPORT_FORMATS: Array<{ key: ExportFormat; label: string; ext: string; mime: string }> = [
  { key: 'txt', label: '文本', ext: 'txt', mime: 'text/plain;charset=utf-8' },
  { key: 'json', label: 'JSON', ext: 'json', mime: 'application/json;charset=utf-8' },
  { key: 'csv', label: 'CSV', ext: 'csv', mime: 'text/csv;charset=utf-8' },
]

export function scanToTxt(scan: OfflineScan): string {
  const header = [
    scan.title,
    `识别时间：${formatScanTime(scan.at)}`,
    scan.paperName ? `试卷：${scan.paperName}` : '',
    scan.candidateNumber ? `考号：${scan.candidateNumber}` : '',
    scan.score !== undefined ? `得分：${scan.score}${scan.maxScore ? ` / ${scan.maxScore}` : ''}` : '',
    `答案数量：${scan.total}（正确 ${scan.ok} / 错误 ${scan.wrong} / 存疑 ${scan.uncertain}）`,
    '',
  ]
    .filter(Boolean)
    .join('\n')
  const body = scan.questions
    .map((q) => {
      const parts = [`${q.id}:${q.answer ?? ''}`]
      if (q.expected !== undefined && q.expected !== null) parts.push(`标准:${q.expected}`)
      if (q.correct !== undefined && q.correct !== null) parts.push(q.correct ? '对' : '错')
      if (typeof q.confidence === 'number') parts.push(`置信度:${Math.round(q.confidence * 100)}%`)
      if (q.uncertain) parts.push('存疑')
      return parts.join(' ')
    })
    .join('\n')
  return `${header}${body}\n`
}

export function scanToJson(scan: OfflineScan): string {
  return JSON.stringify(scan, null, 2)
}

export function scanToCsv(scan: OfflineScan): string {
  const esc = (v: unknown) => {
    const s = v === undefined || v === null ? '' : String(v)
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const rows = [
    ['题号', '答案', '标准答案', '是否正确', '存疑', '置信度', '分值', '得分'],
    ...scan.questions.map((q) => [
      q.id,
      q.answer ?? '',
      q.expected ?? '',
      q.correct === true ? '对' : q.correct === false ? '错' : '',
      q.uncertain ? '是' : '否',
      typeof q.confidence === 'number' ? Math.round(q.confidence * 100) / 100 : '',
      q.points ?? '',
      q.score ?? '',
    ]),
  ]
  // BOM 让 Excel 正确识别 UTF-8 中文
  return `\ufeff${rows.map((r) => r.map(esc).join(',')).join('\r\n')}\r\n`
}

export function scanToFormat(scan: OfflineScan, format: ExportFormat): string {
  if (format === 'json') return scanToJson(scan)
  if (format === 'csv') return scanToCsv(scan)
  return scanToTxt(scan)
}

export function scanFilename(scan: OfflineScan, format: ExportFormat): string {
  const base = sanitizeFilename(scan.title || scan.paperName || '识别结果')
  const ext = EXPORT_FORMATS.find((f) => f.key === format)?.ext ?? 'txt'
  return `${base}_${formatScanTime(scan.at).replace(/[-: ]/g, '')}.${ext}`
}

export function downloadScan(scan: OfflineScan, format: ExportFormat): void {
  const meta = EXPORT_FORMATS.find((f) => f.key === format)
  downloadText(scanToFormat(scan, format), scanFilename(scan, format), meta?.mime)
}

/** 批量导出：每个记录一个文件太碎，TXT 合并成一份、CSV 追加行 */
export function downloadScans(scans: OfflineScan[], format: ExportFormat): void {
  if (scans.length === 0) return
  const meta = EXPORT_FORMATS.find((f) => f.key === format)
  const stamp = formatScanTime(Date.now()).replace(/[-: ]/g, '')
  if (format === 'json') {
    downloadText(JSON.stringify(scans, null, 2), `识别记录_${stamp}.json`, meta?.mime)
    return
  }
  if (format === 'csv') {
    const header = '标题,识别时间,试卷,考号,得分,总题数,正确,错误,存疑,题号,答案,标准答案,是否正确\n'
    const esc = (v: unknown) => {
      const s = v === undefined || v === null ? '' : String(v)
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
    }
    const lines: string[] = []
    for (const scan of scans) {
      if (scan.questions.length === 0) {
        lines.push(
          [scan.title, formatScanTime(scan.at), scan.paperName ?? '', scan.candidateNumber ?? '', scan.score ?? '', 0, 0, 0, 0, '', '', '', '']
            .map(esc)
            .join(','),
        )
        continue
      }
      for (const q of scan.questions) {
        lines.push(
          [
            scan.title,
            formatScanTime(scan.at),
            scan.paperName ?? '',
            scan.candidateNumber ?? '',
            scan.score ?? '',
            scan.total,
            scan.ok,
            scan.wrong,
            scan.uncertain,
            q.id,
            q.answer ?? '',
            q.expected ?? '',
            q.correct === true ? '对' : q.correct === false ? '错' : '',
          ]
            .map(esc)
            .join(','),
        )
      }
    }
    downloadText(`\ufeff${header}${lines.join('\r\n')}\r\n`, `识别记录_${stamp}.csv`, meta?.mime)
    return
  }
  const text = scans.map((s) => scanToTxt(s)).join('\n\n────────\n\n')
  downloadText(`识别记录导出（${scans.length} 份）\n导出时间：${formatScanTime(Date.now())}\n\n${text}`, `识别记录_${stamp}.txt`, meta?.mime)
}

export function sanitizeFilename(name: string): string {
  return name.replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_').slice(0, 60) || '识别结果'
}

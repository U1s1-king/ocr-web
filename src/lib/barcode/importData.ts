import { readFileText, stripBom } from '../textEncoding'

export interface TableData {
  headers: string[]
  rows: Record<string, string>[]
}

function parseCsv(text: string): TableData {
  const lines: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i]
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        cell += '"'
        i += 1
      } else if (ch === '"') quoted = false
      else cell += ch
    } else if (ch === '"') quoted = true
    else if (ch === ',') {
      row.push(cell)
      cell = ''
    } else if (ch === '\n') {
      row.push(cell)
      lines.push(row)
      row = []
      cell = ''
    } else if (ch !== '\r') cell += ch
  }
  if (cell || row.length) {
    row.push(cell)
    lines.push(row)
  }
  const clean = lines.filter((r) => r.some((x) => x.trim() !== ''))
  if (!clean.length) return { headers: [], rows: [] }
  const headers = clean[0].map((h) => stripBom(h).trim())
  return {
    headers,
    rows: clean.slice(1).map((r) =>
      Object.fromEntries(headers.map((h, i) => [h, stripBom(String(r[i] ?? '')).trim()])),
    ),
  }
}

/** 条形码数据源统一入口：CSV / JSON / XLSX / XLS */
export async function parseTableFile(file: File): Promise<TableData> {
  if (/\.(xlsx|xls)$/i.test(file.name)) {
    const XLSX = await import('xlsx')
    const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' })
    const sheetName = wb.SheetNames[0]
    if (!sheetName) throw new Error('Excel 中没有工作表')
    const sheet = wb.Sheets[sheetName]
    const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '' })
    const clean = matrix.filter((r) => Array.isArray(r) && r.some((x) => String(x ?? '').trim() !== ''))
    if (!clean.length) return { headers: [], rows: [] }
    const headers = (clean[0] ?? []).map((h) => stripBom(String(h ?? '')).trim())
    return {
      headers,
      rows: clean.slice(1).map((r) =>
        Object.fromEntries(headers.map((h, i) => [h, stripBom(String((r as unknown[])[i] ?? '')).trim()])),
      ),
    }
  }

  if (/\.json$/i.test(file.name)) {
    const data = JSON.parse(stripBom(await readFileText(file))) as unknown
    const arr = Array.isArray(data) ? data : (data as { rows?: unknown[]; students?: unknown[] }).rows ?? (data as { students?: unknown[] }).students
    if (!Array.isArray(arr) || !arr.length) throw new Error('JSON 需要是非空数组')
    const rows = arr.map((r) =>
      Object.fromEntries(Object.entries(r as Record<string, unknown>).map(([k, v]) => [k, String(v ?? '')])),
    )
    return { headers: Object.keys(rows[0] ?? {}), rows }
  }

  return parseCsv(await readFileText(file))
}

/**
 * 本机离线识别历史（IndexedDB）。
 *
 * 服务端只保存成绩，识别当时每道题的答案/置信度并不总能回看；这里把每次
 * 识别结果整份留在浏览器里，断网也能查、能导出。IndexedDB 不可用时自动
 * 退回 localStorage，保证功能不因隐私模式/旧浏览器直接失效。
 */

export interface OfflineQuestion {
  /** 题号，如 q1 / 1 */
  id: string
  type?: string
  answer: string | null
  expected?: string | null
  correct?: boolean | null
  uncertain?: boolean
  confidence?: number | null
  points?: number
  score?: number
}

export interface OfflineScan {
  id: string
  /** 毫秒时间戳 */
  at: number
  title: string
  source: 'capture' | 'check' | 'grade'
  paperId: number | null
  paperName?: string
  fileName?: string
  fileId?: number
  candidateNumber?: string | null
  score?: number
  maxScore?: number
  total: number
  ok: number
  wrong: number
  uncertain: number
  questions: OfflineQuestion[]
}

const DB_NAME = 'ac-offline'
const STORE = 'scans'
const VERSION = 1
const LS_KEY = 'ac.offlineHistory.v1'
const MAX_RECORDS = 200

/** 运行时探测：IndexedDB 打开失败后不再重试，直接走 localStorage */
let idbAvailable: boolean | null = null

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'id' })
        store.createIndex('at', 'at')
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error ?? new Error('IndexedDB 打开失败'))
  })
}

function idbRequest<T>(db: IDBDatabase, mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode)
    const req = run(tx.objectStore(STORE))
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error ?? new Error('IndexedDB 操作失败'))
    tx.onabort = () => reject(tx.error ?? new Error('IndexedDB 事务中断'))
  })
}

/* ---------------- localStorage 兜底 ---------------- */

function lsRead(): OfflineScan[] {
  try {
    const raw = localStorage.getItem(LS_KEY)
    const data = raw ? (JSON.parse(raw) as OfflineScan[]) : []
    return Array.isArray(data) ? data : []
  } catch {
    return []
  }
}

function lsWrite(list: OfflineScan[]): void {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(list.slice(0, 40)))
  } catch {
    /* 空间不足时静默失败，不阻断识别流程 */
  }
}

/* ---------------- 对外 API ---------------- */

export async function listScans(): Promise<OfflineScan[]> {
  if (idbAvailable === false) return lsRead().sort((a, b) => b.at - a.at)
  try {
    const db = await openDB()
    idbAvailable = true
    const all = await idbRequest<OfflineScan[]>(db, 'readonly', (store) => store.getAll())
    db.close()
    return all.sort((a, b) => b.at - a.at)
  } catch {
    idbAvailable = false
    return lsRead().sort((a, b) => b.at - a.at)
  }
}

export async function getScan(id: string): Promise<OfflineScan | null> {
  const all = await listScans()
  return all.find((s) => s.id === id) ?? null
}

export async function saveScan(scan: OfflineScan): Promise<void> {
  if (idbAvailable === false) {
    const list = lsRead().filter((s) => s.id !== scan.id)
    lsWrite([scan, ...list])
    return
  }
  try {
    const db = await openDB()
    idbAvailable = true
    await idbRequest(db, 'readwrite', (store) => store.put(scan))
    db.close()
    const all = await listScans()
    if (all.length > MAX_RECORDS) {
      const stale = all.slice(MAX_RECORDS)
      const db2 = await openDB()
      for (const s of stale) await idbRequest(db2, 'readwrite', (store) => store.delete(s.id))
      db2.close()
    }
  } catch {
    idbAvailable = false
    const list = lsRead().filter((s) => s.id !== scan.id)
    lsWrite([scan, ...list])
  }
}

export async function deleteScan(id: string): Promise<void> {
  if (idbAvailable === false) {
    lsWrite(lsRead().filter((s) => s.id !== id))
    return
  }
  try {
    const db = await openDB()
    await idbRequest(db, 'readwrite', (store) => store.delete(id))
    db.close()
  } catch {
    idbAvailable = false
    lsWrite(lsRead().filter((s) => s.id !== id))
  }
}

export async function clearScans(): Promise<void> {
  if (idbAvailable === false) {
    lsWrite([])
    return
  }
  try {
    const db = await openDB()
    await idbRequest(db, 'readwrite', (store) => store.clear())
    db.close()
  } catch {
    idbAvailable = false
    lsWrite([])
  }
}

/* ---------------- 构造与统计 ---------------- */

export function makeScanId(): string {
  return `scan_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

export function summarize(questions: OfflineQuestion[]): Pick<OfflineScan, 'total' | 'ok' | 'wrong' | 'uncertain'> {
  return {
    total: questions.length,
    ok: questions.filter((q) => q.correct === true).length,
    wrong: questions.filter((q) => q.correct === false).length,
    uncertain: questions.filter((q) => q.uncertain).length,
  }
}

export interface OfflineStats {
  records: number
  answers: number
  uncertain: number
  /** 最近 7 天每天的记录数，按日期升序 */
  daily: Array<{ date: string; count: number }>
}

export function computeStats(list: OfflineScan[]): OfflineStats {
  const answers = list.reduce((s, r) => s + r.total, 0)
  const uncertain = list.reduce((s, r) => s + r.uncertain, 0)
  const daily: Array<{ date: string; count: number }> = []
  const today = new Date()
  for (let i = 6; i >= 0; i -= 1) {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    const count = list.filter((r) => {
      const rd = new Date(r.at)
      const rk = `${rd.getFullYear()}-${String(rd.getMonth() + 1).padStart(2, '0')}-${String(rd.getDate()).padStart(2, '0')}`
      return rk === key
    }).length
    daily.push({ date: key.slice(5), count })
  }
  return { records: list.length, answers, uncertain, daily }
}

export function formatScanTime(at: number): string {
  const d = new Date(at)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}

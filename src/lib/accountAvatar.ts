const DB_NAME = 'ac-account-avatar'
const STORE = 'blobs'
const KEY = 'avatar'
export const ACCOUNT_AVATAR_IDB = 'idb://account-avatar'
export const AVATAR_MAX_BYTES = 10 * 1024 * 1024

let cachedUrl = ''

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE)
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error || new Error('IndexedDB 打开失败'))
  })
}

function idb(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest): Promise<void> {
  return openDb().then(
    (db) =>
      new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE, mode)
        const req = fn(tx.objectStore(STORE))
        req.onerror = () => reject(req.error || new Error('头像存储失败'))
        tx.oncomplete = () => {
          db.close()
          resolve()
        }
        tx.onerror = () => {
          db.close()
          reject(tx.error || new Error('头像存储失败'))
        }
      }),
  )
}

export function resolveAccountAvatar(value: string): string {
  if (!value) return ''
  if (value === ACCOUNT_AVATAR_IDB) return cachedUrl
  return value
}

/** 从本机 IndexedDB 恢复动态头像 URL */
export async function hydrateAccountAvatar(): Promise<string> {
  try {
    const db = await openDb()
    const value = await new Promise<Blob | undefined>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly')
      const req = tx.objectStore(STORE).get(KEY)
      req.onsuccess = () => resolve(req.result as Blob | undefined)
      req.onerror = () => reject(req.error || new Error('头像读取失败'))
    })
    db.close()
    if (cachedUrl) URL.revokeObjectURL(cachedUrl)
    cachedUrl = value ? URL.createObjectURL(value) : ''
    return cachedUrl
  } catch {
    return ''
  }
}

/** 保存头像文件，返回 account.avatar 要记录的值 */
export async function saveAccountAvatar(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('请选择图片文件')
  if (file.size > AVATAR_MAX_BYTES) throw new Error('头像不能超过 10MB')
  const blob = file.slice(0, file.size, file.type)
  try {
    await idb('readwrite', (s) => s.put(blob, KEY))
    if (cachedUrl) URL.revokeObjectURL(cachedUrl)
    cachedUrl = URL.createObjectURL(blob)
    return ACCOUNT_AVATAR_IDB
  } catch {
    // IndexedDB 不可用时退回 dataURL（上限仍为 10MB）
    const data = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onerror = () => reject(new Error('头像读取失败'))
      reader.onload = () => resolve(String(reader.result || ''))
      reader.readAsDataURL(blob)
    })
    cachedUrl = data
    return data
  }
}

export async function clearAccountAvatar(): Promise<void> {
  try {
    await idb('readwrite', (s) => s.delete(KEY))
  } catch {
    /* ignore */
  }
  if (cachedUrl) URL.revokeObjectURL(cachedUrl)
  cachedUrl = ''
}

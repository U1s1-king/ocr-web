/* 本机用户资料：昵称 + 头像（本机保存，后续接服务器接口再迁移）
 * 小图直接存 localStorage；大图/GIF 存 IndexedDB，不限制大小
 */

const KEY = 'ac.mobileProfile'
const DB_NAME = 'ac.mobileProfileDB'
const STORE = 'blobs'
const AVATAR_KEY = 'avatar'
/** localStorage 里存这个标记，真图在 IndexedDB */
export const IDB_AVATAR = 'idb://avatar'
/** 超过这个长度的 dataURL 就放 IndexedDB，避免撑爆 localStorage */
const LOCAL_MAX = 400_000

export type Profile = {
  name: string
  /** dataURL 或 IDB_AVATAR 标记，空串表示用首字母渐变占位 */
  avatar: string
  /** 裁剪缩放，1 表示原始 cover 尺寸 */
  zoom: number
  /** 水平/垂直偏移比例，-1 ~ 1 */
  x: number
  y: number
}

export const DEFAULT_PROFILE: Profile = { name: 'kane', avatar: '', zoom: 1, x: 0, y: 0 }

export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

/** IndexedDB 里读出来的头像缓存，供同步渲染使用 */
let idbCache = ''

export function getIdbCache() {
  return idbCache
}

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

function idbRun<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(STORE, mode)
        const req = fn(tx.objectStore(STORE))
        req.onsuccess = () => resolve(req.result)
        req.onerror = () => reject(req.error || new Error('IndexedDB 操作失败'))
        tx.oncomplete = () => db.close()
      }),
  )
}

/** 把头像图落到合适的存储，返回要写进 profile.avatar 的值 */
export async function persistAvatar(dataUrl: string): Promise<string> {
  if (!dataUrl) {
    try {
      await idbRun('readwrite', (s) => s.delete(AVATAR_KEY))
    } catch {
      /* 忽略 */
    }
    idbCache = ''
    return ''
  }
  if (dataUrl.length <= LOCAL_MAX) {
    idbCache = ''
    try {
      await idbRun('readwrite', (s) => s.delete(AVATAR_KEY))
    } catch {
      /* 忽略 */
    }
    return dataUrl
  }
  try {
    await idbRun('readwrite', (s) => s.put(dataUrl, AVATAR_KEY))
    idbCache = dataUrl
    return IDB_AVATAR
  } catch {
    // IndexedDB 不可用就退回 localStorage，撑不住时由 saveProfile 报错
    return dataUrl
  }
}

/** 取真实可渲染的 dataURL；传 IDB_AVATAR 时用缓存，没有则返回空 */
export function resolveAvatar(value: string): string {
  if (!value) return ''
  if (value === IDB_AVATAR) return idbCache
  return value
}

/** 异步把 IndexedDB 里的头像读进缓存 */
export async function hydrateAvatar(): Promise<string> {
  try {
    const v = (await idbRun('readonly', (s) => s.get(AVATAR_KEY))) as string | undefined
    idbCache = typeof v === 'string' ? v : ''
  } catch {
    idbCache = ''
  }
  return idbCache
}

export function getProfile(): Profile {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return DEFAULT_PROFILE
    const p = JSON.parse(raw) as Partial<Profile>
    const avatar = typeof p.avatar === 'string' ? p.avatar : ''
    return {
      name: (p.name || DEFAULT_PROFILE.name).slice(0, 16),
      avatar,
      zoom: clamp(p.zoom ?? 1, 1, 3),
      x: clamp(p.x ?? 0, -1, 1),
      y: clamp(p.y ?? 0, -1, 1),
    }
  } catch {
    return DEFAULT_PROFILE
  }
}

export function saveProfile(p: Profile) {
  localStorage.setItem(
    KEY,
    JSON.stringify({
      name: p.name.slice(0, 16),
      avatar: p.avatar === IDB_AVATAR ? IDB_AVATAR : p.avatar,
      zoom: clamp(p.zoom, 1, 3),
      x: clamp(p.x, -1, 1),
      y: clamp(p.y, -1, 1),
    }),
  )
}

export function resetProfile() {
  try {
    localStorage.removeItem(KEY)
  } catch {
    /* 忽略 */
  }
  idbCache = ''
  idbRun('readwrite', (s) => s.delete(AVATAR_KEY)).catch(() => {})
}

export function initialOf(name: string): string {
  const n = (name || '').trim()
  return n ? n[0].toUpperCase() : '?'
}

/** 普通图片压成 240px 方形 JPEG；GIF 原样读取，不限大小，保留动图 */
export function fileToAvatar(file: File): Promise<string> {
  if (file.type === 'image/gif') {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result || ''))
      reader.onerror = () => reject(new Error('GIF 读取失败'))
      reader.readAsDataURL(file)
    })
  }
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      try {
        const size = 240
        const canvas = document.createElement('canvas')
        canvas.width = size
        canvas.height = size
        const ctx = canvas.getContext('2d')
        if (!ctx) throw new Error('canvas 不可用')
        const side = Math.min(img.width, img.height)
        ctx.drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, size, size)
        resolve(canvas.toDataURL('image/jpeg', 0.82))
      } catch (e) {
        reject(e)
      } finally {
        URL.revokeObjectURL(url)
      }
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('图片读取失败'))
    }
    img.src = url
  })
}

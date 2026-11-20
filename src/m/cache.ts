// 会话级缓存：切换页面时先给内容，再后台刷新。
// 1) 带版本号，发版后自动丢弃旧结构，避免读到脏数据
// 2) 内存里再放一层，命中时不走 JSON.parse
// 3) 提供 purge 供「清除缓存」按钮使用

type Box<T> = { t: number; v: T }

const VERSION = 'v3'
const PREFIX = `ac.cache.${VERSION}.`
const ALL_PREFIX = 'ac.cache.'
const TTL = 5 * 60 * 1000
const MEM_MAX = 60

const mem = new Map<string, Box<unknown>>()

/** 启动时清理：旧版本缓存 + 过期项 + 内存层 */
export function initCache(): void {
  try {
    Object.keys(sessionStorage)
      .filter((k) => k.startsWith(ALL_PREFIX) && !k.startsWith(PREFIX))
      .forEach((k) => sessionStorage.removeItem(k))
  } catch {
    /* ignore */
  }
  mem.clear()
}

export function readCache<T>(key: string): T | null {
  const hit = mem.get(key) as Box<T> | undefined
  if (hit) {
    if (Date.now() - hit.t > TTL) {
      mem.delete(key)
    } else {
      return hit.v
    }
  }
  try {
    const raw = sessionStorage.getItem(PREFIX + key)
    if (!raw) return null
    const box = JSON.parse(raw) as Box<T>
    if (!box || typeof box.t !== 'number') return null
    if (Date.now() - box.t > TTL) {
      sessionStorage.removeItem(PREFIX + key)
      return null
    }
    mem.set(key, box)
    return box.v
  } catch {
    return null
  }
}

export function writeCache<T>(key: string, value: T): void {
  const box: Box<T> = { t: Date.now(), v: value }
  if (mem.size >= MEM_MAX) {
    const oldest = mem.keys().next().value
    if (oldest) mem.delete(oldest)
  }
  mem.set(key, box as Box<unknown>)
  try {
    sessionStorage.setItem(PREFIX + key, JSON.stringify(box))
  } catch {
    // 容量超了：清掉旧缓存再写一次，还不成就只留内存层
    clearCache()
    try {
      sessionStorage.setItem(PREFIX + key, JSON.stringify(box))
    } catch {
      /* ignore */
    }
  }
}

export function clearCache(prefix?: string): void {
  if (!prefix) {
    mem.clear()
  } else {
    // 内存层同样按前缀清掉，否则会继续返回旧数据
    Array.from(mem.keys())
      .filter((k) => k.startsWith(prefix))
      .forEach((k) => mem.delete(k))
  }
  try {
    Object.keys(sessionStorage)
      .filter((k) => k.startsWith(PREFIX + (prefix ?? '')))
      .forEach((k) => sessionStorage.removeItem(k))
  } catch {
    /* ignore */
  }
}

/** 彻底清理本应用留下的本地缓存（含旧版本键） */
export function purgeAllCaches(): number {
  let n = 0
  try {
    Object.keys(sessionStorage)
      .filter((k) => k.startsWith(ALL_PREFIX))
      .forEach((k) => {
        sessionStorage.removeItem(k)
        n += 1
      })
    Object.keys(localStorage)
      .filter((k) => k.startsWith(ALL_PREFIX))
      .forEach((k) => {
        localStorage.removeItem(k)
        n += 1
      })
  } catch {
    /* ignore */
  }
  mem.clear()
  return n
}

export function cacheSize(): number {
  try {
    return Object.keys(sessionStorage).filter((k) => k.startsWith(PREFIX)).length
  } catch {
    return 0
  }
}

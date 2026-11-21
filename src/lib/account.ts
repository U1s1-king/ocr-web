import { useEffect, useState } from 'react'

/**
 * 本地账号资料：姓名 + 头像。
 * 后端登录/注册、角色与权限接口尚未接入，这里暂不展示任何权限标识。
 * 头像使用 IndexedDB 动态存储，兼容 GIF，单文件上限 10MB。
 */
export interface Account {
  name: string
  /** dataURL 或 idb://account-avatar 标记；空串显示首字 */
  avatar: string
}

const KEY = 'ac.account.v2'
const LEGACY_KEY = 'ac.account.v1'
const DEFAULT: Account = { name: 'kane', avatar: '' }

export function getAccount(): Account {
  try {
    const raw = localStorage.getItem(KEY) || localStorage.getItem(LEGACY_KEY)
    if (!raw) return DEFAULT
    const p = JSON.parse(raw) as Partial<Account>
    return {
      name: String(p.name || DEFAULT.name).slice(0, 16),
      avatar: typeof p.avatar === 'string' ? p.avatar : '',
    }
  } catch {
    return DEFAULT
  }
}

export function saveAccount(next: Account) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...next, name: next.name.slice(0, 16) }))
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new Event('ac:account'))
}

export function useAccount() {
  const [account, setAccount] = useState<Account>(() => getAccount())
  useEffect(() => {
    const sync = () => setAccount(getAccount())
    window.addEventListener('ac:account', sync)
    window.addEventListener('storage', sync)
    return () => {
      window.removeEventListener('ac:account', sync)
      window.removeEventListener('storage', sync)
    }
  }, [])
  return account
}

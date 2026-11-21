import { useEffect, useState } from 'react'

export type RoleId = 'admin' | 'teacher' | 'reviewer'

export interface Account {
  name: string
  /** dataURL；空串显示首字 */
  avatar: string
  role: RoleId
}

export const ROLES: Array<{ id: RoleId; label: string; desc: string }> = [
  { id: 'admin', label: '管理员', desc: '全部模块与系统设置' },
  { id: 'teacher', label: '教师', desc: '试卷、考试、成绩、复核与资源' },
  { id: 'reviewer', label: '阅卷员', desc: '考试、成绩与人工复核' },
]

const KEY = 'ac.account.v1'
const DEFAULT: Account = { name: 'kane', avatar: '', role: 'admin' }

export function getAccount(): Account {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return DEFAULT
    const p = JSON.parse(raw) as Partial<Account>
    return {
      name: String(p.name || DEFAULT.name).slice(0, 16),
      avatar: typeof p.avatar === 'string' ? p.avatar : '',
      role: p.role === 'teacher' || p.role === 'reviewer' || p.role === 'admin' ? p.role : 'admin',
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

const TEACHER_MODULES = ['papers', 'exams', 'results', 'reviews', 'files', 'students']
const REVIEWER_MODULES = ['exams', 'results', 'reviews']

/** 本地模拟权限：后端登录接入后替换这里即可 */
export function canAccess(role: RoleId, moduleId: string): boolean {
  if (role === 'admin') return true
  if (role === 'teacher') return TEACHER_MODULES.includes(moduleId)
  return REVIEWER_MODULES.includes(moduleId)
}

export function roleLabel(role: RoleId): string {
  return ROLES.find((r) => r.id === role)?.label ?? '未知'
}

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { getAccount, ROLES, saveAccount, useAccount, type Account } from '../lib/account'

function readAvatar(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('读取图片失败'))
    reader.onload = () => {
      const img = new Image()
      img.onerror = () => reject(new Error('图片不可用'))
      img.onload = () => {
        const size = 180
        const canvas = document.createElement('canvas')
        canvas.width = size
        canvas.height = size
        const ctx = canvas.getContext('2d')
        if (!ctx) return reject(new Error('画布不可用'))
        const s = Math.min(img.width, img.height)
        ctx.drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, size, size)
        resolve(canvas.toDataURL('image/jpeg', 0.85))
      }
      img.src = String(reader.result || '')
    }
    reader.readAsDataURL(file)
  })
}

export function AccountDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const account = useAccount()
  const [draft, setDraft] = useState<Account>(() => getAccount())
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (open) setDraft(getAccount())
  }, [open])

  if (!open) return null

  async function pick(file?: File | null) {
    if (!file) return
    setBusy(true)
    try {
      const avatar = await readAvatar(file)
      setDraft((d) => ({ ...d, avatar }))
    } finally {
      setBusy(false)
    }
  }

  function save() {
    saveAccount({ ...draft, name: draft.name.trim() || '未命名用户' })
    onClose()
  }

  return createPortal(
    <div className="account-mask" onClick={onClose} role="presentation">
      <div className="account-dialog" role="dialog" aria-modal="true" aria-label="账号设置" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-[16px] font-black text-ink">账号</h2>
            <p className="mt-1 text-[10.5px] text-ink-soft/65">本地模拟账号；后端登录接入后替换为真实账号</p>
          </div>
          <button type="button" className="text-[12px] font-bold text-ink-soft" onClick={onClose}>关闭</button>
        </div>

        <div className="mt-4 flex items-center gap-3">
          <label className="account-avatar-pick" title="更换头像">
            {draft.avatar ? (
              <img src={draft.avatar} alt="" />
            ) : (
              <span>{(draft.name || '?').slice(0, 1).toUpperCase()}</span>
            )}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => void pick(e.target.files?.[0])}
            />
          </label>
          <div className="min-w-0 flex-1">
            <label className="text-[10.5px] font-bold text-ink-soft">姓名</label>
            <input
              className="mt-1 w-full rounded-xl border border-brand-200 bg-white px-3 py-2 text-[12.5px] outline-none focus:border-brand-400"
              value={draft.name}
              onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
              placeholder="输入姓名"
            />
          </div>
        </div>

        <div className="mt-4">
          <p className="text-[10.5px] font-bold text-ink-soft">权限身份（本地模拟）</p>
          <div className="mt-2 space-y-1.5">
            {ROLES.map((role) => (
              <button
                key={role.id}
                type="button"
                className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2 text-left ${
                  draft.role === role.id ? 'border-brand-400 bg-brand-50' : 'border-brand-100 bg-white'
                }`}
                onClick={() => setDraft((d) => ({ ...d, role: role.id }))}
              >
                <span className={`h-2 w-2 rounded-full ${draft.role === role.id ? 'bg-brand-600' : 'bg-brand-200'}`} />
                <span className="min-w-0 flex-1">
                  <span className="block text-[11.5px] font-bold text-ink">{role.label}</span>
                  <span className="block text-[10px] text-ink-soft/65">{role.desc}</span>
                </span>
                {draft.role === role.id && <span className="text-[10px] font-bold text-brand-700">当前</span>}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4 flex gap-2">
          <button type="button" className="serverdown-btn ghost !h-9" onClick={onClose}>取消</button>
          <button type="button" className="serverdown-btn primary !h-9" disabled={busy} onClick={save}>
            {busy ? '处理中…' : '保存账号'}
          </button>
        </div>
        <p className="mt-2 text-center text-[9px] text-ink-soft/40">
          {account.role === draft.role ? `当前身份：${draft.role === 'admin' ? '管理员' : draft.role === 'teacher' ? '教师' : '阅卷员'}` : '切换后将立即应用本地权限'}
        </p>
      </div>
    </div>,
    document.body,
  )
}

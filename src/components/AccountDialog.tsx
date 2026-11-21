import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { getAccount, saveAccount, type Account } from '../lib/account'
import {
  ACCOUNT_AVATAR_IDB,
  AVATAR_MAX_BYTES,
  clearAccountAvatar,
  hydrateAccountAvatar,
  resolveAccountAvatar,
  saveAccountAvatar,
} from '../lib/accountAvatar'

export function AccountDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [draft, setDraft] = useState<Account>(() => getAccount())
  const [avatarUrl, setAvatarUrl] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    const a = getAccount()
    setDraft(a)
    setError('')
    if (a.avatar === ACCOUNT_AVATAR_IDB) {
      void hydrateAccountAvatar().then((url) => setAvatarUrl(url))
    } else {
      setAvatarUrl(a.avatar)
    }
  }, [open])

  if (!open) return null

  async function pick(file?: File | null) {
    if (!file) return
    setError('')
    if (!file.type.startsWith('image/')) {
      setError('请选择图片文件')
      return
    }
    if (file.size > AVATAR_MAX_BYTES) {
      setError('头像大小不能超过 10MB')
      return
    }
    setBusy(true)
    try {
      const stored = await saveAccountAvatar(file)
      setDraft((d) => ({ ...d, avatar: stored }))
      setAvatarUrl(resolveAccountAvatar(stored))
    } catch (e) {
      setError(e instanceof Error ? e.message : '头像处理失败')
    } finally {
      setBusy(false)
    }
  }

  async function removeAvatar() {
    await clearAccountAvatar()
    setDraft((d) => ({ ...d, avatar: '' }))
    setAvatarUrl('')
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
            <p className="mt-1 text-[10.5px] text-ink-soft/65">本地账号资料；登录、账号同步等后端接口接入后再接通</p>
          </div>
          <button type="button" className="text-[12px] font-bold text-ink-soft" onClick={onClose}>关闭</button>
        </div>

        <div className="mt-4 flex items-center gap-3">
          <label className="account-avatar-pick" title="更换头像">
            {avatarUrl ? (
              <img src={avatarUrl} alt="" />
            ) : (
              <span>{(draft.name || '?').slice(0, 1).toUpperCase()}</span>
            )}
            <input type="file" accept="image/*" className="hidden" onChange={(e) => void pick(e.target.files?.[0])} />
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

        <div className="mt-2 flex items-center gap-2 text-[9.5px] text-ink-soft/55">
          <span>支持 JPG / PNG / GIF，动态头像，单文件不超过 10MB。</span>
          {avatarUrl && (
            <button type="button" className="ml-auto text-[10px] font-bold text-red-500" onClick={() => void removeAvatar()}>
              移除头像
            </button>
          )}
        </div>
        {error && <p className="mt-2 rounded-lg bg-red-50 px-2 py-1.5 text-[10.5px] text-red-600">{error}</p>}

        <div className="mt-4 flex gap-2">
          <button type="button" className="serverdown-btn ghost !h-9" onClick={onClose}>取消</button>
          <button type="button" className="serverdown-btn primary !h-9" disabled={busy} onClick={save}>
            {busy ? '处理中…' : '保存账号'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}

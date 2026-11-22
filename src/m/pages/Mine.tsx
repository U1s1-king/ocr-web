import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useToast } from '../../components/Toast'
import { getApiBase } from '../../api/client'
import { examsApi, type ExamSummary } from '../api'
import { BRAND } from '../../lib/brand'
import { StatsStrip } from '../StatsStrip'
import { Logo, LogoMark } from '../../components/Logo'
import { getThemeColor, presetOf } from '../theme'
import { saveAccount } from '../../lib/account'
import { fileToAvatar, getProfile, persistAvatar, resetProfile, resolveAvatar, saveProfile, type Profile } from '../profile'
import Avatar from '../Avatar'
import AvatarCropper, { type Crop } from '../AvatarCropper'
import {
  IcCalendar,
  IcChart,
  IcCheck,
  IcClock,
  IcFile,
  IcImage,
  IcLayers,
  IcRight,
  IcSliders,
  IcSpark,
  IcUsers,
} from '../icons'
import { Btn, Page, Sheet, useLoad } from '../ui'

// 参照「我的」页：第一张卡 5 个快捷入口，第二张卡 8 个数据工具
const QUICK = [
  { label: '接口', to: '/m/settings', Icon: IcSliders },
  { label: '主题色', to: '/m/theme', Icon: IcSpark },
  { label: '学生', to: '/m/students', Icon: IcUsers },
  { label: '批次', to: '/m/batches', Icon: IcCalendar },
  { label: '复核', to: '/m/reviews', Icon: IcCheck },
]

const TOOLS = [
  { label: '试卷管理', to: '/m/papers', Icon: IcLayers },
  { label: '考试管理', to: '/m/exams', Icon: IcCalendar },
  { label: '成绩明细', to: '/m/results', Icon: IcChart },
  { label: '拍照识别', to: '/m/capture', Icon: IcImage },
  { label: '本机记录', to: '/m/history', Icon: IcClock },
  { label: '文件库', to: '/m/files', Icon: IcFile },
  { label: '学生名单', to: '/m/students', Icon: IcUsers },
  { label: '人工复核', to: '/m/reviews', Icon: IcCheck },
]

/** 视觉参照：docs/design-reference/vivo 应用「我的」页 */
export default function Mine() {
  const nav = useNavigate()
  const toast = useToast()
  const theme = getThemeColor()
  const [profile, setProfile] = useState<Profile>(getProfile())
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<Profile>(profile)
  const [busy, setBusy] = useState(false)
  const [cropSrc, setCropSrc] = useState<string | null>(null)

  const exams = useLoad<ExamSummary[]>(() => examsApi.list(), [], [])
  const total = exams.data.reduce((s, e) => s + (e.resultCount || 0), 0)

  function openEdit() {
    setDraft(profile)
    setEditing(true)
  }

  async function pickAvatar(file?: File | null) {
    if (!file) return
    if (file.size > 10 * 1024 * 1024) {
      toast('头像不能超过 10MB', 'err')
      return
    }
    setBusy(true)
    try {
      const data = await fileToAvatar(file)
      setCropSrc(data)
    } catch (e) {
      toast(e instanceof Error ? e.message : '图片读取失败，换一张试试', 'err')
    } finally {
      setBusy(false)
    }
  }

  function doneCrop(c: Crop) {
    if (!cropSrc) return
    setDraft((d) => ({ ...d, avatar: cropSrc, ...c }))
    setCropSrc(null)
  }

  function save() {
    const next: Profile = {
      name: draft.name.trim() || '未命名',
      avatar: draft.avatar,
      zoom: draft.zoom,
      x: draft.x,
      y: draft.y,
    }
    setBusy(true)
    persistAvatar(next.avatar)
      .then((stored) => {
        const out: Profile = { ...next, avatar: stored }
        try {
          saveProfile(out)
        } catch {
          toast('存储空间不够，这张图太大了', 'err')
          return
        }
        const av = resolveAvatar(stored)
        saveAccount({ name: out.name, avatar: av.length < 200_000 ? av : '' })
        setProfile(out)
        setEditing(false)
        toast('资料已保存到本机', 'ok')
      })
      .catch(() => toast('头像保存失败，换一张试试', 'err'))
      .finally(() => setBusy(false))
  }

  function reset() {
    resetProfile()
    const d = getProfile()
    setDraft(d)
    setProfile(d)
    toast('已恢复默认资料', 'ok')
  }

  return (
    <Page title="我的" sub="MY ACCOUNT">
      {/* 资料卡 */}
      <button
        type="button"
        className="mo-profile mt-1 w-full text-left active:scale-[.995]"
        onClick={openEdit}
      >
        <span className="mo-profile-glow" />
        <Avatar profile={profile} size={58} />
        <span className="relative min-w-0 flex-1">
          <span className="block truncate text-[19px] font-black leading-tight text-ink">{profile.name}</span>
          <span className="mo-muted mt-1 block">已存 {total} 份成绩 · 本机保存</span>
        </span>
        <span className="mo-profile-edit">编辑</span>
      </button>

      {/* 服务状态 */}
      <div className="mo-svc mt-3">
        <Logo className="h-11 w-11 flex-none" rounded="rounded-2xl" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[14px] font-black text-ink">{BRAND.tagline}</p>
          <p className="mt-0.5 text-[11px] font-bold text-ink-soft">试卷 · 考试 · 成绩 · 复核</p>
        </div>
        <button type="button" className="mo-btn-soft flex-none" onClick={() => nav('/m/settings')}>
          设置
        </button>
      </div>

      <StatsStrip
        className="mt-3"
        items={[
          { label: '成绩', value: total },
          { label: '考试', value: exams.data.length },
          { label: '模块', value: 8, hint: '全部可用' },
        ]}
      />

      {/* 快捷入口 */}
      <div className="mo-quick mt-3">
        {QUICK.map(({ label, to, Icon }) => (
          <button key={label} type="button" className="mo-quick-item" onClick={() => nav(to)}>
            <span className="mo-quick-ico">
              <Icon style={{ fontSize: 19 }} />
            </span>
            <span className="text-[10px] font-bold text-ink-soft">{label}</span>
          </button>
        ))}
      </div>

      <div className="mo-sec-head mt-6">
        <h2 className="mo-eyebrow">数据工具</h2>
        <span className="mo-muted">常用操作</span>
      </div>
      <div className="mo-icon-grid mt-2">
        {TOOLS.map(({ label, to, Icon }) => (
          <button key={label} type="button" className="mo-icon-grid-item" onClick={() => nav(to)}>
            <span className="mo-icon-grid-ico">
              <Icon style={{ fontSize: 19 }} />
            </span>
            <span className="text-[10px] font-bold leading-tight text-ink-soft">{label}</span>
          </button>
        ))}
      </div>

      <div className="mo-sec-head mt-6">
        <h2 className="mo-eyebrow">设置</h2>
        <span className="mo-muted">本机偏好</span>
      </div>
      <div className="mo-list mt-2">
        <MenuRow label="个人资料" sub="昵称与头像" Icon={IcUsers} onClick={openEdit} />
        <MenuRow label="接口设置" sub={getApiBase()} Icon={IcSliders} onClick={() => nav('/m/settings')} />
        <MenuRow
          label="外观主题"
          sub={presetOf(theme)?.name ?? '自定义色'}
          Icon={IcSpark}
          onClick={() => nav('/m/theme')}
        />
        <MenuRow label="学生名单" sub="后端优先，本机兜底" Icon={IcUsers} onClick={() => nav('/m/students')} />
        <MenuRow label="识别指南" sub="拍照与定位要求" Icon={IcCheck} onClick={() => nav('/m/check/guide')} />
        <MenuRow label="接口诊断" sub="日志、上传、检查" Icon={IcSliders} onClick={() => nav('/m/settings/diagnostics')} />
        <MenuRow label="高级设置" sub="接口与环境" Icon={IcSliders} onClick={() => nav('/m/settings/advanced')} />
        <MenuRow label="关于" sub={BRAND.version} Icon={IcSpark} onClick={() => nav('/m/settings/about')} last />
      </div>

      <div className="mt-5 text-center">
        <div className="mt-1.5 flex items-center justify-center gap-1.5 opacity-40">
          <LogoMark className="h-3.5 w-3.5" />
          <span className="text-[9px] tracking-[0.16em] text-ink-soft">{BRAND.pinyin} · {BRAND.version}</span>
        </div>
      </div>

      <Sheet open={editing} onClose={() => setEditing(false)} title={cropSrc ? '调整头像' : '编辑资料'}>
        {cropSrc ? (
          <AvatarCropper src={cropSrc} value={draft} onCancel={() => setCropSrc(null)} onDone={doneCrop} />
        ) : (
        <div className="space-y-4">
          <div className="flex w-full flex-col items-center gap-2.5">
            <label
              className="relative inline-flex flex-none cursor-pointer items-center justify-center active:scale-95"
              style={{ width: 80, height: 80 }}
            >
              <Avatar profile={draft} size={80} />
              <span className="pointer-events-none absolute -bottom-0.5 -right-0.5 grid h-6 w-6 place-items-center rounded-full bg-brand-600 text-[13px] font-black leading-none text-white">
                +
              </span>
              {busy && (
                <span className="absolute inset-0 grid place-items-center rounded-full bg-black/45 text-[10.5px] font-bold text-white">
                  处理中
                </span>
              )}
              <input
                type="file"
                accept="image/*,.gif"
                className="hidden"
                onChange={(e) => pickAvatar(e.target.files?.[0])}
              />
            </label>
            <div className="flex items-center gap-3">
              {draft.avatar && (
                <button
                  type="button"
                  className="rounded-full bg-brand-100 px-3 py-1 text-[11px] font-extrabold text-brand-700 active:scale-95"
                  onClick={() => setCropSrc(resolveAvatar(draft.avatar))}
                >
                  调整裁剪
                </button>
              )}
              {draft.avatar && (
                <button
                  type="button"
                  className="text-[10.5px] font-bold text-ink-soft/60"
                  onClick={() => setDraft((d) => ({ ...d, avatar: '', zoom: 1, x: 0, y: 0 }))}
                >
                  去掉头像
                </button>
              )}
            </div>
          </div>

          <label className="mo-field">
            <span className="mo-field-label">昵称</span>
            <input
              className="mo-input"
              value={draft.name}
              maxLength={16}
              placeholder="给自己起个名字"
              onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
            />
          </label>

          <div className="flex gap-2">
            <Btn block variant="ghost" onClick={reset}>
              恢复默认
            </Btn>
            <Btn block onClick={save}>
              保存
            </Btn>
          </div>
        </div>
        )}
      </Sheet>
    </Page>
  )
}

function MenuRow({
  label,
  sub,
  Icon,
  onClick,
  last,
}: {
  label: string
  sub?: string
  Icon: (p: { style?: React.CSSProperties; className?: string }) => React.ReactElement
  onClick: () => void
  last?: boolean
}) {
  return (
    <button
      type="button"
      className={`mo-list-row ${last ? 'is-last' : ''}`}
      onClick={onClick}
    >
      <span className="mo-list-ico">
        <Icon style={{ fontSize: 17 }} />
      </span>
      <span className="min-w-0 flex-1 truncate text-[13.5px] font-extrabold text-ink">{label}</span>
      {sub && <span className="mo-list-val max-w-[46%] truncate">{sub}</span>}
      <IcRight style={{ fontSize: 14 }} className="flex-none text-ink-soft/30" />
    </button>
  )
}

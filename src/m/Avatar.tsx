/* 头像展示：支持 GIF 动图 + 裁剪缩放（object-position 呈现，不重编码，动图不丢）
 * 布局用 flex 友好写法：外层固定 size、flex-none、overflow hidden，内部绝对定位不撑开父级
 */
import { useEffect, useState } from 'react'
import { getThemeColor } from './theme'
import { IDB_AVATAR, hydrateAvatar, initialOf, resolveAvatar, type Profile } from './profile'

export default function Avatar({
  profile,
  size = 52,
  className = '',
}: {
  profile: Pick<Profile, 'name' | 'avatar' | 'zoom' | 'x' | 'y'>
  size?: number
  className?: string
}) {
  const theme = getThemeColor()
  const [src, setSrc] = useState(() => resolveAvatar(profile.avatar))

  useEffect(() => {
    const next = resolveAvatar(profile.avatar)
    setSrc(next)
    if (profile.avatar === IDB_AVATAR) {
      let alive = true
      hydrateAvatar().then((v) => {
        if (alive && v) setSrc(v)
      })
      return () => {
        alive = false
      }
    }
    return undefined
  }, [profile.avatar])

  const box = `relative block flex-none overflow-hidden rounded-full ${className}`

  if (!src) {
    return (
      <span
        className={`grid flex-none place-items-center rounded-full font-black text-white ${className}`}
        style={{
          width: size,
          height: size,
          fontSize: size * 0.34,
          background: `linear-gradient(135deg, ${theme}, color-mix(in srgb, ${theme} 42%, #fff))`,
        }}
      >
        {initialOf(profile.name)}
      </span>
    )
  }

  const zoom = Math.min(3, Math.max(1, profile.zoom || 1))
  const x = Math.min(1, Math.max(-1, profile.x || 0))
  const y = Math.min(1, Math.max(-1, profile.y || 0))

  return (
    <span
      className={box}
      style={{ width: size, height: size, minWidth: size, minHeight: size, background: 'rgba(0,0,0,.05)' }}
    >
      <img
        src={src}
        alt={profile.name}
        draggable={false}
        decoding="async"
        className="block max-w-none select-none"
        style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          width: size * zoom,
          height: size * zoom,
          objectFit: 'cover',
          objectPosition: `${50 + x * 50}% ${50 + y * 50}%`,
          transform: 'translate(-50%, -50%)',
          pointerEvents: 'none',
        }}
      />
    </span>
  )
}

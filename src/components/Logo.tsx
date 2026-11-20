/**
 * 「鉴裁」标志
 *
 * 正式标识来自设计稿 PSD 的「图层 0」：朱红印章体「鉴裁」二字，
 * 已导出为 public/logo-seal.png（透明底）与 logo-seal-white.png（深底反白）。
 *
 * 用法：
 *   <Logo />        带纸底的方形标识（侧栏、头部）
 *   <Logo mono />   单色（深底反白）
 *   <LogoMark />    只有图形本体，无底色（开屏、水印）
 */

const BASE = import.meta.env.BASE_URL || '/'
const SEAL = `${BASE}logo-seal.png`
const SEAL_WHITE = `${BASE}logo-seal-white.png`

export function LogoMark({
  className = '',
  mono = false,
  animated = false,
}: {
  className?: string
  mono?: boolean
  animated?: boolean
}) {
  return (
    <img
      src={mono ? SEAL_WHITE : SEAL}
      alt="鉴裁"
      draggable={false}
      decoding="async"
      className={`select-none object-contain ${animated ? 'logo-mark-in' : ''} ${className}`}
    />
  )
}

/** 带纸底的完整标志 */
export function Logo({
  className = '',
  rounded = 'rounded-2xl',
  glow = false,
}: {
  className?: string
  rounded?: string
  glow?: boolean
}) {
  return (
    <span
      className={`inline-grid place-items-center bg-[#faf4ec] ring-1 ring-black/5 ${rounded} ${className} ${
        glow ? 'shadow-[0_10px_28px_-14px_rgba(160,51,30,0.55)]' : ''
      }`}
    >
      <LogoMark className="h-[84%] w-[84%]" />
    </span>
  )
}

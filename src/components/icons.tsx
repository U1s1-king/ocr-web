import type { SVGProps } from 'react'

export type IconProps = SVGProps<SVGSVGElement>

const base = {
  viewBox: '0 0 48 48',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 3.2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
}

/** 品牌图标：扫描框 */
export function ScanIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M8 17V9h8" />
      <path d="M40 17V9h-8" />
      <path d="M8 31v8h8" />
      <path d="M40 31v8h-8" />
      <path d="M14 24h20" />
    </svg>
  )
}

export function ExamIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M11 11h20a4 4 0 0 1 4 4v24H15a4 4 0 0 1-4-4Z" />
      <path d="M18 19h10M18 26h10M18 33h6" />
    </svg>
  )
}

export function CheckIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M10 12h12l-2 3h-10Z" />
      <path d="M10 24h12l-2 3h-10Z" />
      <path d="M10 36h12l-2 3h-10Z" />
      <path d="m30 14 4 4 8-8" />
      <path d="m30 28 4 4 8-8" />
    </svg>
  )
}

export function UsersIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <circle cx="19" cy="16" r="6" />
      <path d="M8 38c0-6 5-9 11-9s11 3 11 9" />
      <path d="M32 12a6 6 0 0 1 0 12" />
      <path d="M35 30c4 1 6 4 6 8" />
    </svg>
  )
}

export function PlusIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M24 12v24M12 24h24" />
    </svg>
  )
}

export function TrashIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M9 14h30" />
      <path d="M19 14V9h10v5" />
      <path d="M13 14l2 25h18l2-25" />
      <path d="M20 21v12M28 21v12" />
    </svg>
  )
}

export function EditIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M31.5 8.5 39 16l-20 20-8.6 1.6L12 29 31.5 8.5Z" />
      <path d="m28 12 8 8" />
    </svg>
  )
}

export function UploadIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M24 32V10" />
      <path d="m15 19 9-9 9 9" />
      <path d="M10 32v6h28v-6" />
    </svg>
  )
}

export function ArrowLeftIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M20 10 8 24l12 14" />
      <path d="M8 24h32" />
    </svg>
  )
}

export function ChevronRightIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="m19 13 11 11-11 11" />
    </svg>
  )
}

export function CloseIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M12 12l24 24M36 12 12 36" />
    </svg>
  )
}

export function SaveIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M10 10h22l6 6v22H10Z" />
      <path d="M17 10v10h14V10" />
      <rect x="17" y="27" width="14" height="11" />
    </svg>
  )
}

export function ImageIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <rect x="7" y="10" width="34" height="28" rx="3" />
      <circle cx="17" cy="19" r="3.5" />
      <path d="m10 34 10-10 7 7 6-6 5 5" />
    </svg>
  )
}

export function SettingsIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <circle cx="24" cy="24" r="6" />
      <path d="M24 6v5M24 37v5M6 24h5M37 24h5M11.3 11.3l3.6 3.6M33.1 33.1l3.6 3.6M36.7 11.3l-3.6 3.6M14.9 33.1l-3.6 3.6" />
    </svg>
  )
}

export function MenuIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className={className}>
      <path d="M4 7h16M4 12h16M4 17h10" />
    </svg>
  )
}

export function XIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className={className}>
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  )
}

export function ChevronDownIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className={className}>
      <path d="M6 9l6 6 6-6" />
    </svg>
  )
}

/** 首页 */
export function HomeIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M8 22 24 9l16 13" />
      <path d="M12 20v19h24V20" />
      <path d="M20 39v-11h8v11" />
    </svg>
  )
}

/** 时钟 / 历史 */
export function ClockIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <circle cx="24" cy="24" r="16" />
      <path d="M24 14v10l7 5" />
    </svg>
  )
}

/** 文件堆叠 */
export function FileStackIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <rect x="10" y="12" width="22" height="26" rx="3" />
      <path d="M17 8h18a3 3 0 0 1 3 3v19" />
      <path d="M16 21h10M16 28h7" />
    </svg>
  )
}

/** 图表 */
export function ChartIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M9 39V9" />
      <path d="M9 39h30" />
      <path d="M17 32V22M25 32V16M33 32v-7" />
    </svg>
  )
}

/** 相机 */
export function CameraIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M8 15h7l3-4h12l3 4h7v24H8z" />
      <circle cx="24" cy="27" r="7" />
    </svg>
  )
}

/** 相册 */
export function PhotoIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <rect x="7" y="9" width="34" height="30" rx="4" />
      <circle cx="17" cy="19" r="3.5" />
      <path d="m10 33 9-9 7 7 5-4 7 7" />
    </svg>
  )
}

/** 下载 / 导出 */
export function DownloadIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M24 8v22" />
      <path d="m15 22 9 9 9-9" />
      <path d="M8 34v6h32v-6" />
    </svg>
  )
}

/** 闪电 / 性能 */
export function BoltIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M26 5 12 27h10l-2 16 16-23H26z" />
    </svg>
  )
}

/** 对勾圆 */
export function CheckCircleIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <circle cx="24" cy="24" r="16" />
      <path d="m16 24 6 6 10-12" />
    </svg>
  )
}

/** 警示 */
export function AlertIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M24 8 6 38h36z" />
      <path d="M24 19v9" />
      <circle cx="24" cy="33" r="1.6" fill="currentColor" stroke="none" />
    </svg>
  )
}

/** 列表 / 日志 */
export function ListIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M14 12h26M14 24h26M14 36h26" />
      <path d="M8 12h.02M8 24h.02M8 36h.02" />
    </svg>
  )
}

/** 学生名册（带考号卡片） */
export function StudentsIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <rect x="8" y="10" width="32" height="28" rx="4" />
      <circle cx="18" cy="21" r="4" />
      <path d="M12 31c1.6-3.2 3.8-4.6 6-4.6s4.4 1.4 6 4.6" />
      <path d="M29 19h7M29 26h7" />
    </svg>
  )
}


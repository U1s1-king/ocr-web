import type { SVGProps } from 'react'

type P = SVGProps<SVGSVGElement>

function Svg({ children, ...p }: P) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      width="1em"
      height="1em"
      aria-hidden="true"
      {...p}
    >
      {children}
    </svg>
  )
}

export const IcHome = (p: P) => (
  <Svg {...p}>
    <path d="M4 10.5 12 4l8 6.5V19a1 1 0 0 1-1 1h-4.5v-5.5h-5V20H5a1 1 0 0 1-1-1z" />
  </Svg>
)
export const IcCamera = (p: P) => (
  <Svg {...p}>
    <path d="M4 8.5h2.6l1.3-2h8.2l1.3 2H20a1 1 0 0 1 1 1V18a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9.5a1 1 0 0 1 1-1Z" />
    <circle cx="12" cy="13.4" r="3.4" />
  </Svg>
)
export const IcLayers = (p: P) => (
  <Svg {...p}>
    <path d="m12 3 8 4.2-8 4.2-8-4.2z" />
    <path d="m4 12.4 8 4.2 8-4.2" />
    <path d="m4 16.6 8 4.2 8-4.2" />
  </Svg>
)
export const IcChart = (p: P) => (
  <Svg {...p}>
    <path d="M4 20V4" />
    <path d="M4 20h16" />
    <path d="M8.5 20v-6.5M13 20V8M17.5 20v-9.5" />
  </Svg>
)
export const IcSearch = (p: P) => (
  <Svg {...p}>
    <circle cx="11" cy="11" r="6.4" />
    <path d="m16 16 4 4" />
  </Svg>
)
export const IcPlus = (p: P) => (
  <Svg {...p}>
    <path d="M12 5v14M5 12h14" />
  </Svg>
)
export const IcBack = (p: P) => (
  <Svg {...p}>
    <path d="m14.5 5-7 7 7 7" />
  </Svg>
)
export const IcRight = (p: P) => (
  <Svg {...p}>
    <path d="m9.5 5 7 7-7 7" />
  </Svg>
)
export const IcCheck = (p: P) => (
  <Svg {...p}>
    <path d="m5 12.6 4.4 4.4L19 7" />
  </Svg>
)
export const IcX = (p: P) => (
  <Svg {...p}>
    <path d="M6 6l12 12M18 6 6 18" />
  </Svg>
)
export const IcTrash = (p: P) => (
  <Svg {...p}>
    <path d="M4 7h16M9.5 7V5.2h5V7M6.5 7l.9 12.2h9.2L17.5 7" />
    <path d="M10.5 11v5M13.5 11v5" />
  </Svg>
)
export const IcUsers = (p: P) => (
  <Svg {...p}>
    <circle cx="9.4" cy="9" r="3.2" />
    <path d="M3.5 19.5c.6-3 3-4.6 5.9-4.6s5.3 1.6 5.9 4.6" />
    <path d="M16 6.4a3 3 0 0 1 0 5.8M17.4 19.5c-.2-1.6-.7-2.9-1.6-3.8" />
  </Svg>
)
export const IcUpload = (p: P) => (
  <Svg {...p}>
    <path d="M12 16V5.5M8 9l4-3.5L16 9" />
    <path d="M4.5 15.5V18a1 1 0 0 0 1 1h13a1 1 0 0 0 1-1v-2.5" />
  </Svg>
)
export const IcFile = (p: P) => (
  <Svg {...p}>
    <path d="M6 3.5h7l5 5V20a.5.5 0 0 1-.5.5h-11A.5.5 0 0 1 6 20z" />
    <path d="M13 3.6V9h4.9" />
  </Svg>
)
export const IcClock = (p: P) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="8" />
    <path d="M12 7.6V12l3.2 2" />
  </Svg>
)
export const IcSliders = (p: P) => (
  <Svg {...p}>
    <path d="M5 4v6M5 14v6M12 4v10M12 18v2M19 4v3M19 11v9" />
    <circle cx="5" cy="12" r="1.8" />
    <circle cx="12" cy="16" r="1.8" />
    <circle cx="19" cy="9" r="1.8" />
  </Svg>
)
export const IcSpark = (p: P) => (
  <Svg {...p}>
    <path d="M12 3.5l1.7 4.6 4.8 1.7-4.8 1.7L12 16.1l-1.7-4.6L5.5 9.8l4.8-1.7z" />
    <path d="M18 15.5l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z" />
  </Svg>
)
export const IcBook = (p: P) => (
  <Svg {...p}>
    <path d="M4 5.4c2.6-1 5.3-1 8 .4v13.4c-2.7-1.4-5.4-1.4-8-.4z" />
    <path d="M20 5.4c-2.6-1-5.3-1-8 .4v13.4c2.7-1.4 5.4-1.4 8-.4z" />
  </Svg>
)
export const IcGrid = (p: P) => (
  <Svg {...p}>
    <rect x="4" y="4" width="6.6" height="6.6" rx="1.8" />
    <rect x="13.4" y="4" width="6.6" height="6.6" rx="1.8" />
    <rect x="4" y="13.4" width="6.6" height="6.6" rx="1.8" />
    <rect x="13.4" y="13.4" width="6.6" height="6.6" rx="1.8" />
  </Svg>
)
export const IcAlert = (p: P) => (
  <Svg {...p}>
    <path d="M12 4.5 21 20H3z" />
    <path d="M12 9.5v4.2M12 17h.01" />
  </Svg>
)
export const IcRefresh = (p: P) => (
  <Svg {...p}>
    <path d="M20 11.5A8 8 0 0 0 6.2 6.6L4 9" />
    <path d="M4 4.5V9h4.5" />
    <path d="M4 12.5a8 8 0 0 0 13.8 4.9L20 15" />
    <path d="M20 19.5V15h-4.5" />
  </Svg>
)
export const IcSort = (p: P) => (
  <Svg {...p}>
    <path d="M7 4.5v15M4 16.5l3 3 3-3" />
    <path d="M13 7h7M13 12h5M13 17h3" />
  </Svg>
)
export const IcImage = (p: P) => (
  <Svg {...p}>
    <rect x="3.5" y="5" width="17" height="14" rx="2.4" />
    <circle cx="8.6" cy="10" r="1.6" />
    <path d="m4.5 17.5 4.6-4.3 3.2 2.8 3-2.6 4.2 4.1" />
  </Svg>
)
export const IcPen = (p: P) => (
  <Svg {...p}>
    <path d="M4 20l.9-4 10-10.2a2 2 0 0 1 2.9 0l.4.4a2 2 0 0 1 0 2.9L8 19.1z" />
    <path d="M14.2 5.9 18 9.7" />
  </Svg>
)
export const IcEye = (p: P) => (
  <Svg {...p}>
    <path d="M2.8 12S6.6 6.2 12 6.2 21.2 12 21.2 12 17.4 17.8 12 17.8 2.8 12 2.8 12Z" />
    <circle cx="12" cy="12" r="2.8" />
  </Svg>
)
export const IcGear = (p: P) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="3" />
    <path d="M12 3.5v2.2M12 18.3v2.2M4.9 12H2.6M21.4 12h-2.3M6.9 6.9 5.3 5.3M18.7 18.7l-1.6-1.6M17.1 6.9l1.6-1.6M5.3 18.7l1.6-1.6" />
  </Svg>
)
export const IcCalendar = (p: P) => (
  <Svg {...p}>
    <rect x="3.6" y="5.2" width="16.8" height="15" rx="2.4" />
    <path d="M8 3.5v3.4M16 3.5v3.4M3.6 10h16.8" />
  </Svg>
)
export const IcTarget = (p: P) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="8" />
    <circle cx="12" cy="12" r="3.4" />
    <path d="M12 3.6v2.2M12 18.2v2.2M3.6 12h2.2M18.2 12h2.2" />
  </Svg>
)
export const IcCloudOff = (p: P) => (
  <Svg {...p}>
    <path d="M6.5 8.2A4.6 4.6 0 0 0 7 17.3h9.2" />
    <path d="M18.4 14.6A3.8 3.8 0 0 0 17 7.4" />
    <path d="m4 4 16 16" />
  </Svg>
)
export const IcWave = (p: P) => (
  <Svg {...p}>
    <path d="M3 12c1.6 0 1.6-3.4 3.2-3.4S7.8 15.4 9.4 15.4s1.6-8 3.2-8 1.6 6.2 3.2 6.2S17.4 12 19 12h2" />
  </Svg>
)

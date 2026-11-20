/** 桌面端右上角 SVG 装饰：缓慢旋转的轨道与环 */
export function WebOrnament() {
  return (
    <svg className="web-ornament" viewBox="0 0 360 360" aria-hidden="true">
      <circle className="web-orb-ring r1" cx="180" cy="180" r="138" />
      <circle className="web-orb-ring r2" cx="180" cy="180" r="106" />
      <circle className="web-orb-ring r3" cx="180" cy="180" r="72" />
      <path className="web-orb-arc" d="M 52 180 A 128 128 0 0 1 290 116" />
      <circle className="web-orb-dot" r="3">
        <animateMotion dur="9s" repeatCount="indefinite" path="M180 42 A138 138 0 1 1 179 42" />
      </circle>
      <circle className="web-orb-dot small" r="1.6">
        <animateMotion dur="6s" repeatCount="indefinite" path="M180 74 A106 106 0 1 0 179 74" />
      </circle>
    </svg>
  )
}

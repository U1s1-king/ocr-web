import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { useVisualPrefs } from '../lib/visualPrefs'

/**
 * 滚动进出场动画：进入视口时上浮淡入，离开视口时淡出上移；
 * 再进入会重新播放。Web 与移动端共用，移动端用更轻的位移。
 */
export function ScrollFx({ scope }: { scope: 'web' | 'mobile' }) {
  const { pathname } = useLocation()
  const prefs = useVisualPrefs()

  useEffect(() => {
    if (!prefs.motion) return
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    const root = scope === 'web' ? document.querySelector('main') : document.querySelector('.mo-shell')
    if (!root) return

    const selector =
      scope === 'web'
        ? '.card, [data-reveal], .page-head-fx, .anim-fade-up, .rounded-3xl, .rounded-2xl'
        : [
            '.mhome-head',
            '.mhome-hero',
            '.mhome-quick',
            '.mhome-stats',
            '.mhome-modules > *',
            '.mhome-empty',
            '.mhome-todo',
            '.mhome-offline',
            '.mo-page > .mo-card',
            '.mo-page > .mo-sec-head',
            '.mo-page > .mo-list',
            '.mo-page > .mo-feed',
            '.mo-page > .mo-rows',
            '.mo-page > .mo-profile',
            '.mo-page > .mo-svc',
            '.mo-page > .mo-quick',
            '.mo-page > .mo-icon-grid',
            '.mo-page > .mo-list-row',
            '.mo-page > .mo-stat-strip',
          ].join(',')

    const all = Array.from(root.querySelectorAll(selector)).filter((el) => {
      if (el.classList.contains('mo-stagger')) return false
      if ((el as HTMLElement).clientHeight < 24) return false
      if (scope === 'web' && el.parentElement?.closest('.rounded-3xl, .rounded-2xl, [data-reveal]')) return false
      return true
    })
    if (!all.length) return

    const io = 'IntersectionObserver' in window
      ? new IntersectionObserver(
          (entries) => {
            for (const entry of entries) {
              if (entry.isIntersecting) {
                entry.target.classList.remove('an-fx-out')
                entry.target.classList.add('an-fx-in')
              } else if (entry.target.classList.contains('an-fx-in')) {
                entry.target.classList.add('an-fx-out')
                entry.target.classList.remove('an-fx-in')
              }
            }
          },
          { root: null, rootMargin: '-4% 0px -6% 0px', threshold: 0.04 },
        )
      : null

    all.forEach((el, i) => {
      el.classList.add('an-fx-init')
      ;(el as HTMLElement).style.setProperty('--fx-delay', `${Math.min(i, 6) * (scope === 'web' ? 45 : 55)}ms`)
      io?.observe(el)
      const r = el.getBoundingClientRect()
      if (r.top < window.innerHeight && r.bottom > 0) {
        window.setTimeout(() => {
          el.classList.remove('an-fx-out')
          el.classList.add('an-fx-in')
        }, 70 + Math.min(i, 6) * 55)
      }
    })

    const fallback = window.setTimeout(() => {
      all.forEach((el) => {
        if (!el.classList.contains('an-fx-in')) el.classList.add('an-fx-in')
      })
    }, 2500)

    return () => {
      window.clearTimeout(fallback)
      io?.disconnect()
      all.forEach((el) => el.classList.remove('an-fx-init', 'an-fx-in', 'an-fx-out'))
    }
  }, [pathname, scope, prefs.motion])

  return null
}

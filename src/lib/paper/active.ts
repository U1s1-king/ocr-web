import type { PaperBundle } from './types'

export const ACTIVE_BUNDLE_KEY = 'ac.paper.bundle.active.v1'

export function saveActiveBundle(bundle: PaperBundle) {
  try {
    localStorage.setItem(ACTIVE_BUNDLE_KEY, JSON.stringify(bundle))
  } catch {
    /* ignore */
  }
}

export function readActiveBundle(): PaperBundle | null {
  try {
    const raw = localStorage.getItem(ACTIVE_BUNDLE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as PaperBundle
    return parsed?.schema === 'paper-bundle' ? parsed : null
  } catch {
    return null
  }
}

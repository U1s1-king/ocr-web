import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'

type ToastTone = 'ok' | 'err' | 'info'

interface ToastItem {
  id: number
  text: string
  tone: ToastTone
}

const ToastCtx = createContext<{
  toast: (text: string, tone?: ToastTone) => void
}>({ toast: () => {} })

export function useToast() {
  return useContext(ToastCtx).toast
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])

  const toast = useCallback((text: string, tone: ToastTone = 'info') => {
    const id = Date.now() + Math.random()
    setItems((xs) => [...xs, { id, text, tone }])
    setTimeout(() => setItems((xs) => xs.filter((x) => x.id !== id)), 3200)
  }, [])

  const value = useMemo(() => ({ toast }), [toast])

  return (
    <ToastCtx.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed left-1/2 top-5 z-[200] flex w-[min(92vw,420px)] -translate-x-1/2 flex-col gap-2">
        {items.map((t) => (
          <div
            key={t.id}
            className={`anim-toast-in rounded-2xl border px-4 py-3 text-sm font-medium shadow-lift backdrop-blur-xl ${
              t.tone === 'ok'
                ? 'border-emerald-200 bg-emerald-50/95 text-emerald-700'
                : t.tone === 'err'
                  ? 'border-red-200 bg-red-50/95 text-red-600'
                  : 'border-brand-200 bg-white/95 text-ink'
            }`}
          >
            {t.text}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  )
}

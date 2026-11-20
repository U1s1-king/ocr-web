import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { CloseIcon } from './icons'

interface ConfirmOptions {
  title: string
  description?: string
  confirmText?: string
  tone?: 'danger' | 'brand'
}

type Resolver = (ok: boolean) => void

const Ctx = createContext<{ confirm: (o: ConfirmOptions) => Promise<boolean> }>({
  confirm: async () => false,
})

export function useConfirm() {
  return useContext(Ctx).confirm
}

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ConfirmOptions | null>(null)
  const [resolver, setResolver] = useState<{ fn: Resolver } | null>(null)

  const confirm = useCallback((o: ConfirmOptions) => {
    setState(o)
    return new Promise<boolean>((resolve) => {
      setResolver({ fn: resolve })
    })
  }, [])

  const close = (ok: boolean) => {
    resolver?.fn(ok)
    setResolver(null)
    setState(null)
  }

  const value = useMemo(() => ({ confirm }), [confirm])

  return (
    <Ctx.Provider value={value}>
      {children}
      {state && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-5">
          <div className="anim-backdrop-in absolute inset-0 bg-ink/25 backdrop-blur-sm" onClick={() => close(false)} />
          <div className="anim-pop relative w-full max-w-sm rounded-3xl border border-brand-200 bg-white p-6 shadow-lift">
            <button
              type="button"
              onClick={() => close(false)}
              className="absolute right-4 top-4 rounded-full p-1.5 text-ink-soft/50 transition hover:bg-brand-100 hover:text-ink"
              aria-label="关闭"
            >
              <CloseIcon className="h-4 w-4" />
            </button>
            <h3 className="pr-8 text-base font-bold text-ink">{state.title}</h3>
            {state.description && (
              <p className="mt-2 text-sm leading-relaxed text-ink-soft">{state.description}</p>
            )}
            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() => close(true)}
                className={`flex-1 rounded-xl px-4 py-2.5 text-sm font-semibold text-white shadow-soft transition hover:-translate-y-0.5 ${
                  state.tone === 'danger' ? 'bg-red-500 hover:bg-red-600' : 'bg-brand-600 hover:bg-brand-700'
                }`}
              >
                {state.confirmText ?? '确定'}
              </button>
              <button
                type="button"
                onClick={() => close(false)}
                className="flex-1 rounded-xl border border-brand-200 bg-white px-4 py-2.5 text-sm font-semibold text-ink-soft transition hover:bg-brand-50"
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}
    </Ctx.Provider>
  )
}

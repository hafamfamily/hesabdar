import { X } from 'lucide-react'
import { useEffect, useRef, type ReactNode } from 'react'

/** برگهٔ پایینی (Bottom Sheet) مناسب استفاده با یک دست */
export function Sheet({
  open,
  onClose,
  title,
  children,
  footer,
}: {
  open: boolean
  onClose: () => void
  title: ReactNode
  children: ReactNode
  footer?: ReactNode
}) {
  const panel = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
  }, [open, onClose])

  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" role="dialog" aria-modal="true">
      <div className="absolute inset-0 animate-fade-in bg-slate-900/40 backdrop-blur-[2px]" onClick={onClose} />
      <div
        ref={panel}
        className="relative flex max-h-[92dvh] w-full max-w-lg animate-sheet-up flex-col rounded-t-[28px] bg-canvas dark:bg-night"
      >
        <div className="mx-auto mt-2 h-1.5 w-10 rounded-full bg-slate-300 dark:bg-slate-700" />
        <header className="flex items-center justify-between px-5 pb-2 pt-3">
          <h2 className="text-[17px] font-bold">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="بستن"
            className="grid size-9 place-items-center rounded-full bg-slate-200/70 text-slate-500 dark:bg-white/10 dark:text-slate-300"
          >
            <X size={18} />
          </button>
        </header>
        <div className="flex-1 overflow-y-auto overscroll-contain px-5 pb-4">{children}</div>
        {footer && <div className="border-t border-slate-200/70 px-5 pt-3 pb-[max(env(safe-area-inset-bottom),12px)] dark:border-night-line">{footer}</div>}
      </div>
    </div>
  )
}

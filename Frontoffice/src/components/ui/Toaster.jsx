import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react'
import useToastStore from '../../store/toastStore'

const STYLES = {
  success: { icon: CheckCircle2, cls: 'border-green-200 bg-green-50 text-green-800' },
  error:   { icon: AlertCircle,  cls: 'border-red-200 bg-red-50 text-red-800' },
  info:    { icon: Info,         cls: 'border-blue-200 bg-blue-50 text-blue-800' },
}

export default function Toaster() {
  const { toasts, remove } = useToastStore()
  if (toasts.length === 0) return null

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[200] w-full max-w-sm px-4 space-y-2 pointer-events-none">
      {toasts.map((t) => {
        const { icon: Icon, cls } = STYLES[t.type] ?? STYLES.info
        return (
          <div key={t.id}
            className={`pointer-events-auto flex items-start gap-2.5 rounded-xl border shadow-md px-4 py-3 text-sm ${cls}`}>
            <Icon className="w-5 h-5 shrink-0 mt-0.5" />
            <span className="flex-1">{t.message}</span>
            <button onClick={() => remove(t.id)} className="shrink-0 opacity-60 hover:opacity-100">
              <X className="w-4 h-4" />
            </button>
          </div>
        )
      })}
    </div>
  )
}

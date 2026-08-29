import { useToast } from '@/state/toast'

/** Mounted once in App.tsx. Renders the toast queue as classic Windows
 *  "balloon tip" bubbles stacked bottom-right, each with a little pointer
 *  tail — the same notification style XP used for tray messages. */
export function ToastHost() {
  const toasts = useToast((s) => s.toasts)
  const dismiss = useToast((s) => s.dismiss)
  if (toasts.length === 0) return null
  return (
    <div className="toast-host">
      {toasts.map((t) => (
        <div key={t.id} className="toast-balloon" onClick={() => dismiss(t.id)}>
          {t.message}
        </div>
      ))}
    </div>
  )
}

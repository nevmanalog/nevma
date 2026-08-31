import { useT } from '@/i18n'

/**
 * Minimal Suspense fallback for code-split routes (Editor) and windows
 * (Community/Profile). Deliberately plain — it's usually on screen for a
 * frame or two on a warm cache, so it isn't worth animating like
 * BootScreen (which is a one-time brand moment, not a loading state).
 */
export function PageLoading() {
  const t = useT()
  return (
    <div className="page-loading" role="status" aria-live="polite">
      {t('loading')}
    </div>
  )
}

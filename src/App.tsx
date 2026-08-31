import { Suspense, lazy, useEffect } from 'react'
import { useRoute } from '@/state/route'
import { useAuth } from '@/state/auth'
import { AuthModal } from '@/pages/community/AuthModal'
import { ToastHost } from '@/app/panels/ToastHost'
import { BootScreen } from '@/app/panels/BootScreen'
import { PageLoading } from '@/app/panels/PageLoading'
import { Desktop } from '@/app/panels/Desktop'

// Code-split: the Editor pulls in Konva plus the whole WebGL/engine layer,
// which is otherwise ~1MB stuck in the main bundle even for people who
// only ever browse Community/Profile and never open it. Desktop.tsx is not
// split the same way — it's the landing surface, needed on first paint.
const Editor = lazy(() => import('@/pages/Editor').then((m) => ({ default: m.Editor })))

export default function App() {
  const route = useRoute((s) => s.route)
  const initAuth = useAuth((s) => s.init)

  useEffect(() => initAuth(), [initAuth])

  // The Editor is the one full-bleed page, not wrapped in the Desktop.
  // Everything else (including "no page open yet") is the Desktop, which
  // now owns rendering Community/Profile as its own floating windows —
  // possibly more than one at once — instead of being handed a single page.
  return (
    <>
      <BootScreen />
      {route === 'editor' ? (
        <Suspense fallback={<PageLoading />}>
          <Editor />
        </Suspense>
      ) : (
        <Desktop />
      )}
      <AuthModal />
      <ToastHost />
    </>
  )
}

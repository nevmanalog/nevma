import { useEffect } from 'react'
import { useRoute } from '@/state/route'
import { useAuth } from '@/state/auth'
import { Editor } from '@/pages/Editor'
import { AuthModal } from '@/pages/community/AuthModal'
import { ToastHost } from '@/app/panels/ToastHost'
import { BootScreen } from '@/app/panels/BootScreen'
import { Desktop } from '@/app/panels/Desktop'

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
      {route === 'editor' ? <Editor /> : <Desktop />}
      <AuthModal />
      <ToastHost />
    </>
  )
}

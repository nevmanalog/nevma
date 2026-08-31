import { useEffect } from 'react'
import { useRoute } from '@/state/route'
import { useAuth } from '@/state/auth'
import { Landing } from '@/pages/Landing'
import { Community } from '@/pages/Community'
import { Editor } from '@/pages/Editor'
import { Profile } from '@/pages/Profile'
import { AuthModal } from '@/pages/community/AuthModal'
import { ToastHost } from '@/app/panels/ToastHost'
import { BootScreen } from '@/app/panels/BootScreen'
import { Desktop } from '@/app/panels/Desktop'

export default function App() {
  const route = useRoute((s) => s.route)
  const initAuth = useAuth((s) => s.init)

  useEffect(() => initAuth(), [initAuth])

  let page = <Landing />
  if (route === 'community') page = <Community />
  else if (route === 'editor') page = <Editor />
  else if (route === 'profile') page = <Profile />

  return (
    <>
      <BootScreen />
      {route === 'editor' ? page : <Desktop>{page}</Desktop>}
      <AuthModal />
      <ToastHost />
    </>
  )
}

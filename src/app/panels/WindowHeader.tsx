import type { ReactNode } from 'react'
import { useT } from '@/i18n'
import { useRoute } from '@/state/route'

interface Props {
  title: string
  onBack: () => void
  /** Right-side actions after the "open editor" button — e.g. Community's
   *  NotificationsBell + AuthWidget. Profile has none. */
  children?: ReactNode
}

/** Shared top bar for the Community and Profile windows: back button,
 *  title, "open editor" shortcut, and any window-specific actions. Was
 *  near-identical markup duplicated in both `Community.tsx` and
 *  `Profile.tsx`; pulled out here now that a third window is a real
 *  possibility. */
export function WindowHeader({ title, onBack, children }: Props) {
  const t = useT()
  const navigate = useRoute((s) => s.navigate)

  return (
    <div className="community-topbar">
      <button className="community-back" onClick={onBack}>← {t('back')}</button>
      <h1 className="community-title">{title}</h1>
      <div className="community-topbar-actions">
        <button className="community-open-editor" onClick={() => navigate('editor')}>✂ {t('openEditor')}</button>
        {children}
      </div>
    </div>
  )
}

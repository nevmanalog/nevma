import type { ReactNode } from 'react'
import { useRoute } from '@/state/route'
import { useAuth } from '@/state/auth'

/**
 * The Win98 "desktop" that Landing/Community/Profile now float on top of as
 * a single centered window, instead of filling the whole screen edge to
 * edge. The Editor is deliberately NOT wrapped in this — it stays a
 * full-bleed page of its own, same as before.
 */
export function Desktop({ children }: { children: ReactNode }) {
  const route = useRoute((s) => s.route)
  const navigate = useRoute((s) => s.navigate)
  const openProfile = useRoute((s) => s.openProfile)
  const userId = useAuth((s) => s.user?.id)

  return (
    <div className="desktop">
      <div className="desktop-icons">
        {route !== 'editor' && (
          <button className="desktop-icon" onClick={() => navigate('editor')}>
            <span className="desktop-icon-glyph">✂</span>
            <span className="desktop-icon-label">Nevma</span>
          </button>
        )}
        {route !== 'community' && (
          <button className="desktop-icon" onClick={() => navigate('community')}>
            <span className="desktop-icon-glyph">🌐</span>
            <span className="desktop-icon-label">Сообщество</span>
          </button>
        )}
        {route !== 'profile' && userId && (
          <button className="desktop-icon" onClick={() => openProfile(userId)}>
            <span className="desktop-icon-glyph">👤</span>
            <span className="desktop-icon-label">Профиль</span>
          </button>
        )}
      </div>
      <div className="desktop-window">{children}</div>
    </div>
  )
}

import type { ReactNode } from 'react'
import { useRoute } from '@/state/route'
import { useAuth } from '@/state/auth'
import logoUrl from '@/assets/nevma-logo.png'

/**
 * The Win98 "desktop" that Community/Profile float on top of as a single
 * centered window, instead of filling the whole screen edge to edge. The
 * Editor is deliberately NOT wrapped in this — it stays a full-bleed page
 * of its own, same as before.
 *
 * The icons are always shown, regardless of which page is currently open —
 * they're the permanent way back to any section, so they never hide
 * themselves just because you're already on that section. When nothing is
 * open (children is null, i.e. the 'landing' route), the wallpaper shows
 * the logo on its own instead of a floating window.
 */
export function Desktop({ children }: { children: ReactNode }) {
  const navigate = useRoute((s) => s.navigate)
  const openProfile = useRoute((s) => s.openProfile)
  const userId = useAuth((s) => s.user?.id)

  return (
    <div className="desktop">
      <div className="desktop-icons">
        <button className="desktop-icon" onClick={() => navigate('editor')}>
          <span className="desktop-icon-glyph">✂</span>
          <span className="desktop-icon-label">Nevma</span>
        </button>
        <button className="desktop-icon" onClick={() => navigate('community')}>
          <span className="desktop-icon-glyph">🌐</span>
          <span className="desktop-icon-label">Сообщество</span>
        </button>
        {userId && (
          <button className="desktop-icon" onClick={() => openProfile(userId)}>
            <span className="desktop-icon-glyph">👤</span>
            <span className="desktop-icon-label">Профиль</span>
          </button>
        )}
      </div>
      {children ? (
        <div className="desktop-window">{children}</div>
      ) : (
        <img className="desktop-wallpaper-logo" src={logoUrl} alt="Nevma" />
      )}
    </div>
  )
}

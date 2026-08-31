import { useEffect, useRef, type MouseEvent as ReactMouseEvent, type ReactNode } from 'react'
import { useRoute } from '@/state/route'
import { useAuth } from '@/state/auth'
import { useFloatingWindow } from './useFloatingWindow'
import logoUrl from '@/assets/nevma-logo.png'

const RESIZE_DIRS = ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'] as const

/**
 * The Win98 "desktop" that Community/Profile float on top of as a single
 * window, instead of filling the whole screen edge to edge. The Editor is
 * deliberately NOT wrapped in this — it stays a full-bleed page of its own,
 * and (unlike this window) is not draggable, resizable, or closable.
 *
 * The icons are always shown, regardless of which page is currently open —
 * they're the permanent way back to any section, so they never hide
 * themselves just because you're already on that section. When nothing is
 * open (children is null, i.e. the 'landing' route), the wallpaper shows
 * the logo on its own instead of a floating window.
 *
 * The window itself can be dragged by its title bar, resized from any edge
 * or corner, and closed with its × button (which just goes back to the
 * wallpaper) — reusing whatever WinTitleBar the page already renders as its
 * first child, via event delegation, rather than each page having to wire
 * this up itself.
 */
export function Desktop({ children }: { children: ReactNode }) {
  const route = useRoute((s) => s.route)
  const navigate = useRoute((s) => s.navigate)
  const openProfile = useRoute((s) => s.openProfile)
  const userId = useAuth((s) => s.user?.id)

  const desktopRef = useRef<HTMLDivElement>(null)
  const { geometry, reset, startDrag, startResize } = useFloatingWindow(desktopRef)

  // A fresh window (new route) always starts centered at its default size —
  // dragging/resizing only sticks for as long as you stay on that page.
  useEffect(() => { reset() }, [route, reset])

  function onWindowMouseDown(e: ReactMouseEvent) {
    const target = e.target as HTMLElement
    if (target.closest('.win-titlebar-btns') || target.closest('.win-titlebar-lang')) return
    if (!target.closest('.win-titlebar')) return
    startDrag(e)
  }

  function onWindowClick(e: ReactMouseEvent) {
    const target = e.target as HTMLElement
    if (target.closest('.win-close')) navigate('landing')
  }

  return (
    <div className="desktop" ref={desktopRef}>
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
        <div
          key={route}
          className="desktop-window"
          style={geometry ? { position: 'absolute', left: geometry.left, top: geometry.top, width: geometry.width, height: geometry.height } : undefined}
          onMouseDown={onWindowMouseDown}
          onClick={onWindowClick}
        >
          {children}
          {RESIZE_DIRS.map((dir) => (
            <span key={dir} className={`win-resize win-resize-${dir}`} onMouseDown={startResize(dir)} />
          ))}
        </div>
      ) : (
        <img className="desktop-wallpaper-logo" src={logoUrl} alt="Nevma" />
      )}
    </div>
  )
}

import { Suspense, lazy, useRef, type CSSProperties, type MouseEvent as ReactMouseEvent, type RefObject } from 'react'
import { useRoute, type WindowKind } from '@/state/route'
import { useAuth } from '@/state/auth'
import { useFloatingWindow } from './useFloatingWindow'
import { PageLoading } from './PageLoading'
import { useT } from '@/i18n'
import logoUrl from '@/assets/nevma-logo.png'

// Code-split alongside the Editor (see App.tsx) — Community pulls in the
// whole community/social data layer, which someone who only ever opens the
// Editor shouldn't have to download up front either.
const Community = lazy(() => import('@/pages/Community').then((m) => ({ default: m.Community })))
const Profile = lazy(() => import('@/pages/Profile').then((m) => ({ default: m.Profile })))

const RESIZE_DIRS = ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'] as const

// Pixel offset applied to each successive window's default (undragged)
// position, so that opening a second window while one is already open
// staggers it instead of stacking it exactly on top of the first.
const CASCADE_STEP = 28

/**
 * The Win98 "desktop" that Community/Profile float on top of as windows,
 * instead of filling the whole screen edge to edge. The Editor is
 * deliberately NOT wrapped in this — it stays a full-bleed page of its own,
 * and (unlike these windows) is not draggable, resizable, or closable.
 *
 * More than one of these windows can be open — and visible — at the same
 * time (e.g. Community and Profile side by side): `openWindows` in the
 * route store is the back-to-front ordered list of which ones currently
 * are, and each one gets its own independent drag/resize/maximize state
 * via its own `useFloatingWindow` instance in `FloatingWindow` below.
 * Clicking anywhere in a window brings it to the front of that order.
 *
 * The icons are always shown, regardless of which windows are open —
 * they're the permanent way back to any section, so they never hide
 * themselves just because that section is already open. When nothing is
 * open, the wallpaper shows the logo on its own instead of any window.
 */
export function Desktop() {
  const openWindows = useRoute((s) => s.openWindows)
  const navigate = useRoute((s) => s.navigate)
  const openProfile = useRoute((s) => s.openProfile)
  const userId = useAuth((s) => s.user?.id)
  const t = useT()

  const desktopRef = useRef<HTMLDivElement>(null)

  return (
    <div className="desktop" ref={desktopRef}>
      <div className="desktop-icons">
        <button className="desktop-icon" onClick={() => navigate('editor')}>
          <span className="desktop-icon-glyph">✂</span>
          <span className="desktop-icon-label">Nevma</span>
        </button>
        <button className="desktop-icon" onClick={() => navigate('community')}>
          <span className="desktop-icon-glyph">🌐</span>
          <span className="desktop-icon-label">{t('communityTitle')}</span>
        </button>
        {userId && (
          <button className="desktop-icon" onClick={() => openProfile(userId)}>
            <span className="desktop-icon-glyph">👤</span>
            <span className="desktop-icon-label">{t('profileTitle')}</span>
          </button>
        )}
      </div>
      {openWindows.length > 0 ? (
        openWindows.map((kind, i) => (
          <FloatingWindow key={kind} kind={kind} order={i} desktopRef={desktopRef} />
        ))
      ) : (
        <img className="desktop-wallpaper-logo" src={logoUrl} alt="Nevma" />
      )}
    </div>
  )
}

/** One floating window — Community or Profile — with its own drag/resize/
 *  maximize state, reusing whatever WinTitleBar the page renders as its
 *  first child (via event delegation on `.win-close`/`.win-max`) rather
 *  than each page having to wire this up itself. */
function FloatingWindow({ kind, order, desktopRef }: { kind: WindowKind; order: number; desktopRef: RefObject<HTMLDivElement | null> }) {
  const focusWindow = useRoute((s) => s.focusWindow)
  const closeWindow = useRoute((s) => s.closeWindow)
  const { geometry, maximized, toggleMaximize, startDrag, startResize } = useFloatingWindow(desktopRef, order * CASCADE_STEP)

  function onWindowMouseDownCapture() {
    focusWindow(kind)
  }

  function onWindowMouseDown(e: ReactMouseEvent) {
    const target = e.target as HTMLElement
    if (target.closest('.win-titlebar-btns') || target.closest('.win-titlebar-lang')) return
    if (!target.closest('.win-titlebar')) return
    startDrag(e)
  }

  function onWindowClick(e: ReactMouseEvent) {
    const target = e.target as HTMLElement
    if (target.closest('.win-close')) { closeWindow(kind); return }
    if (target.closest('.win-max')) toggleMaximize()
  }

  // While maximized, the `.desktop-window-max` CSS class (with !important)
  // takes over position/size entirely, so the geometry/cascade styling
  // below is only needed for the non-maximized case.
  const style: CSSProperties = maximized
    ? { zIndex: 10 + order }
    : geometry
      ? { position: 'absolute', left: geometry.left, top: geometry.top, width: geometry.width, height: geometry.height, transform: 'none', zIndex: 10 + order }
      : { transform: `translate(calc(-50% + ${order * CASCADE_STEP}px), calc(-50% + ${order * CASCADE_STEP}px))`, zIndex: 10 + order }

  return (
    <div
      className={`desktop-window${maximized ? ' desktop-window-max' : ''}`}
      style={style}
      onMouseDownCapture={onWindowMouseDownCapture}
      onMouseDown={onWindowMouseDown}
      onClick={onWindowClick}
    >
      <Suspense fallback={<PageLoading />}>
        {kind === 'community' ? <Community /> : <Profile />}
      </Suspense>
      {!maximized && RESIZE_DIRS.map((dir) => (
        <span key={dir} className={`win-resize win-resize-${dir}`} onMouseDown={startResize(dir)} />
      ))}
    </div>
  )
}

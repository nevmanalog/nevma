import { create } from 'zustand'

/** Top-level app sections — deliberately separate from `TopStage` in
 *  `state/ui.ts`, which only switches panels *inside* the editor.
 *  Kept as a tiny hand-rolled hash router (no react-router dependency):
 *  the project has no backend/build-time routing needs yet, and this way
 *  back/forward and shareable links (#/community, #/profile/<id>) work for
 *  free. */
export type Route = 'landing' | 'community' | 'editor' | 'profile'

/** The subset of routes that render as floating windows on the Desktop
 *  (see app/panels/Desktop.tsx) rather than as a full-bleed page. More than
 *  one of these can be open — and visible — at the same time. */
export type WindowKind = 'community' | 'profile'

function isWindowKind(r: Route): r is WindowKind {
  return r === 'community' || r === 'profile'
}

const SIMPLE_ROUTES: Route[] = ['landing', 'community', 'editor']

interface ParsedHash {
  route: Route
  profileId: string | null
  /** Post to open (as a modal) on top of whatever `route` resolves to —
   *  independent of `route` itself, since a post link should still land on
   *  the community feed with the post open, not replace the feed. */
  postId: string | null
}

function readHash(): ParsedHash {
  const raw = window.location.hash.replace(/^#\/?/, '')
  const profileMatch = raw.match(/^profile\/(.+)$/)
  if (profileMatch) return { route: 'profile', profileId: decodeURIComponent(profileMatch[1]), postId: null }
  const postMatch = raw.match(/^post\/(.+)$/)
  if (postMatch) return { route: 'community', profileId: null, postId: decodeURIComponent(postMatch[1]) }
  if ((SIMPLE_ROUTES as string[]).includes(raw)) return { route: raw as Route, profileId: null, postId: null }
  return { route: 'landing', profileId: null, postId: null }
}

/** `/p/<id>` is a real (non-hash) path so that Netlify's edge function can
 *  see it server-side and serve per-post Open Graph tags to link-preview
 *  bots (see netlify/edge-functions/post-og.ts) — hash fragments never
 *  reach the server, so they can't be used for that. A human landing here
 *  gets folded straight into the normal hash-routed SPA: we translate the
 *  path into `#/post/<id>` and swap the URL with `replaceState` (no extra
 *  back-button entry), then the rest of the app never has to know this
 *  path-based entry point exists.
 *  Read once at module load, before `readHash()` — a page landing on
 *  `/p/<id>#/community` (unlikely, but) should still prefer the path. */
function foldSharePathIntoHash(): void {
  const match = window.location.pathname.match(/^\/p\/([^/]+)\/?$/)
  if (!match) return
  const id = decodeURIComponent(match[1])
  window.history.replaceState(null, '', `/#/post/${encodeURIComponent(id)}`)
}
foldSharePathIntoHash()

/** Moves `kind` to the end of the list (front-most / focused) without
 *  duplicating it if it's already there. */
function bringToFront(list: WindowKind[], kind: WindowKind): WindowKind[] {
  return [...list.filter((k) => k !== kind), kind]
}

interface RouteState {
  route: Route
  /** Only meaningful when route === 'profile'. */
  profileId: string | null
  /** Post open as a modal on top of the current route, or null. Cleared by
   *  `navigate`/`openProfile` so switching pages closes any open post. */
  postId: string | null
  /** Which floating windows (Community/Profile) are currently open, in
   *  back-to-front order — the last entry is the topmost/focused window.
   *  Both can be open (and visible) at once; `route` still tracks whichever
   *  one most recently had focus, for the hash and for consumers (like
   *  CommunityNav) that only care about "am I currently looking at X". */
  openWindows: WindowKind[]
  navigate: (r: Exclude<Route, 'profile'>) => void
  openProfile: (id: string) => void
  openPost: (id: string) => void
  closePost: () => void
  /** Brings an already-open window to the front without touching the URL
   *  hash — used when a window is clicked, which should re-order it but
   *  shouldn't spam browser history the way navigate()/openProfile() do. */
  focusWindow: (kind: WindowKind) => void
  /** Closes one specific window. If it was the focused one, focus falls
   *  back to whatever window is now front-most, or to 'landing' (the bare
   *  wallpaper) if none are left open. */
  closeWindow: (kind: WindowKind) => void
}

export const useRoute = create<RouteState>((set) => {
  const initial = readHash()
  return {
    ...initial,
    openWindows: isWindowKind(initial.route) ? [initial.route] : [],

    navigate: (r) => {
      // Pushes a new hash entry so the browser's back button steps between
      // pages instead of leaving the site.
      window.location.hash = r === 'landing' ? '' : `/${r}`
      set((s) => ({
        route: r,
        postId: null,
        openWindows: r === 'community' ? bringToFront(s.openWindows, 'community') : s.openWindows,
      }))
    },

    openProfile: (id) => {
      window.location.hash = `/profile/${encodeURIComponent(id)}`
      set((s) => ({
        route: 'profile',
        profileId: id,
        postId: null,
        openWindows: bringToFront(s.openWindows, 'profile'),
      }))
    },

    openPost: (id) => {
      window.location.hash = `/post/${encodeURIComponent(id)}`
      set((s) => ({ route: 'community', postId: id, openWindows: bringToFront(s.openWindows, 'community') }))
    },

    closePost: () => {
      window.location.hash = '/community'
      set({ postId: null })
    },

    focusWindow: (kind) => {
      set((s) => (s.openWindows[s.openWindows.length - 1] === kind
        ? {}
        : { openWindows: bringToFront(s.openWindows, kind), route: kind }))
    },

    closeWindow: (kind) => {
      set((s) => {
        const openWindows = s.openWindows.filter((k) => k !== kind)
        const changes: Partial<RouteState> = { openWindows }
        if (kind === 'profile') changes.profileId = null
        if (s.route === kind) {
          const fallback = (openWindows[openWindows.length - 1] ?? 'landing') as Route
          changes.route = fallback
          window.location.hash = fallback === 'landing' ? '' : `/${fallback}`
        }
        return changes
      })
    },
  }
})

window.addEventListener('hashchange', () => {
  const parsed = readHash()
  useRoute.setState((s) => ({
    ...parsed,
    openWindows: isWindowKind(parsed.route) ? bringToFront(s.openWindows, parsed.route) : s.openWindows,
  }))
})

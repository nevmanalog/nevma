import { create } from 'zustand'

/** Top-level app sections — deliberately separate from `TopStage` in
 *  `state/ui.ts`, which only switches panels *inside* the editor.
 *  Kept as a tiny hand-rolled hash router (no react-router dependency):
 *  the project has no backend/build-time routing needs yet, and this way
 *  back/forward and shareable links (#/community, #/profile/<id>) work for
 *  free. */
export type Route = 'landing' | 'community' | 'editor' | 'profile'

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

interface RouteState {
  route: Route
  /** Only meaningful when route === 'profile'. */
  profileId: string | null
  /** Post open as a modal on top of the current route, or null. Cleared by
   *  `navigate`/`openProfile` so switching pages closes any open post. */
  postId: string | null
  navigate: (r: Exclude<Route, 'profile'>) => void
  openProfile: (id: string) => void
  openPost: (id: string) => void
  closePost: () => void
}

export const useRoute = create<RouteState>((set) => ({
  ...readHash(),
  navigate: (r) => {
    // Pushes a new hash entry so the browser's back button steps between
    // pages instead of leaving the site.
    window.location.hash = r === 'landing' ? '' : `/${r}`
    set({ route: r, profileId: null, postId: null })
  },
  openProfile: (id) => {
    window.location.hash = `/profile/${encodeURIComponent(id)}`
    set({ route: 'profile', profileId: id, postId: null })
  },
  openPost: (id) => {
    window.location.hash = `/post/${encodeURIComponent(id)}`
    set({ route: 'community', postId: id })
  },
  closePost: () => {
    window.location.hash = '/community'
    set({ postId: null })
  },
}))

window.addEventListener('hashchange', () => {
  useRoute.setState(readHash())
})

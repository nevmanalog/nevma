import { create } from 'zustand'
import type { Session, User } from '@supabase/supabase-js'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'

/** Row shape of the `profiles` table (one row per user, created client-side
 *  right after their first confirmed sign-up — see the onboarding flow in
 *  AuthWidget.tsx). `displayName`/`avatarUrl` are what other users see in
 *  Community and are freely editable — nothing here is tied to how the
 *  account was created. */
export interface Profile {
  id: string
  displayName: string
  avatarUrl: string | null
  createdAt: string
  /** 'admin' can delete/edit anyone's post or comment (see
   *  supabase/admin_role_migration.sql) and gets a badge next to their name
   *  wherever it's shown — everyone else is 'user'. */
  role: 'user' | 'admin'
}

interface AuthState {
  session: Session | null
  user: User | null
  profile: Profile | null
  /** True while we're restoring the session / fetching the profile on load. */
  loading: boolean
  /** True right after a first-ever confirmed sign-up, before a profile row
   *  exists — drives the "pick a nickname" onboarding screen. */
  needsOnboarding: boolean
  /** Controls the sign-in/sign-up modal (AuthModal.tsx). A single piece of
   *  app-wide state rather than local to one component, so any screen can
   *  trigger it — e.g. clicking "Follow" or "Publish" while signed out —
   *  without needing that page to also render the widget that owns it. */
  authModalOpen: boolean
  openAuthModal: () => void
  closeAuthModal: () => void
  /** Returns needsEmailConfirmation: true when the project has "Confirm
   *  email" on (the default) — no session yet, nothing else to do until the
   *  person clicks the link in their inbox and lands back here. */
  signUpWithPassword: (email: string, password: string) => Promise<{ needsEmailConfirmation: boolean }>
  signInWithPassword: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
  /** Upserts the profiles row. Used both for first-run onboarding and for
   *  later "edit profile" — same shape, same table, no reason to duplicate. */
  saveProfile: (input: { displayName: string; avatarUrl: string | null }) => Promise<void>
  /** Returns an unsubscribe/cleanup function (or undefined when Supabase
   *  isn't configured) — callers should return it from a useEffect. */
  init: () => (() => void) | undefined
}

export const useAuth = create<AuthState>((set, get) => ({
  session: null,
  user: null,
  profile: null,
  loading: isSupabaseConfigured,
  needsOnboarding: false,
  authModalOpen: false,

  openAuthModal: () => set({ authModalOpen: true }),
  closeAuthModal: () => set({ authModalOpen: false }),

  signUpWithPassword: async (email, password) => {
    if (!supabase) throw new Error('Supabase is not configured')
    // Explicit emailRedirectTo so the confirmation link always lands back on
    // whichever origin the app is actually running on (localhost while
    // developing, the real domain in production) instead of depending on
    // the Supabase project's "Site URL" staying in sync with every place
    // the app is deployed.
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: window.location.origin },
    })
    if (error) throw error
    // With "Confirm email" on (Supabase's default), signUp returns a user
    // but no session yet — onAuthStateChange in init() picks the session up
    // automatically once they click the link and land back on the site.
    return { needsEmailConfirmation: !data.session }
  },

  signInWithPassword: async (email, password) => {
    if (!supabase) throw new Error('Supabase is not configured')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
    set({ authModalOpen: false })
  },

  signOut: async () => {
    if (!supabase) return
    await supabase.auth.signOut()
    set({ session: null, user: null, profile: null, needsOnboarding: false })
  },

  saveProfile: async ({ displayName, avatarUrl }) => {
    if (!supabase) return
    const user = get().user
    if (!user) return
    const { data, error } = await supabase
      .from('profiles')
      .upsert({ id: user.id, display_name: displayName, avatar_url: avatarUrl })
      .select()
      .single()
    if (error) throw error
    set({
      profile: {
        id: data.id, displayName: data.display_name, avatarUrl: data.avatar_url, createdAt: data.created_at,
        role: (data.role as 'user' | 'admin' | undefined) ?? 'user',
      },
      needsOnboarding: false,
    })
  },

  init: () => {
    if (!supabase) { set({ loading: false }); return undefined }
    // TS can't carry the null-check narrowing into the nested closure below
    // (supabase is a module-level const, not a local one) — capture it here
    // so `client` is provably non-null everywhere it's used.
    const client = supabase

    // Ignore stale async work: React 18 StrictMode (dev) invokes effects
    // twice. App.tsx's `useEffect(() => initAuth(), [initAuth])` does
    // return `init()`'s cleanup function (the arrow body is an implicit
    // return, and `init()` returns the unsubscribe closure below), so
    // React does tear the first instance down before mounting the second —
    // but that teardown still races the in-flight `loadProfile` promise
    // from the first instance. Without this flag, that stale promise's
    // `set()` calls could land after the second instance is already live.
    let cancelled = false

    const loadProfile = async (session: Session | null) => {
      if (cancelled) return
      if (!session) { set({ session: null, user: null, profile: null, needsOnboarding: false, loading: false }); return }
      const { data } = await client.from('profiles').select('*').eq('id', session.user.id).maybeSingle()
      if (cancelled) return
      if (data) {
        set({
          session, user: session.user, loading: false, needsOnboarding: false, authModalOpen: false,
          profile: {
            id: data.id, displayName: data.display_name, avatarUrl: data.avatar_url, createdAt: data.created_at,
            role: (data.role as 'user' | 'admin' | undefined) ?? 'user',
          },
        })
      } else {
        // First login ever for this account — no profiles row yet.
        set({ session, user: session.user, profile: null, needsOnboarding: true, loading: false, authModalOpen: false })
      }
    }

    // onAuthStateChange fires once immediately with the current session
    // (INITIAL_SESSION) and again on every future sign-in/out/refresh, so it
    // alone covers both the initial load and subsequent changes — no need
    // to also call getSession() up front and race the two.
    const { data: { subscription } } = client.auth.onAuthStateChange((_event, session) => { loadProfile(session) })

    return () => { cancelled = true; subscription.unsubscribe() }
  },
}))

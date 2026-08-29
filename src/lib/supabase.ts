import { createClient, type SupabaseClient } from '@supabase/supabase-js'

// Filled in from a local `.env` (see `.env.example`) — never commit real
// values. Vite only exposes vars prefixed with VITE_ to client code.
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

/** True once `.env` has real Supabase credentials. Everything that talks to
 *  auth/DB checks this first so the app still runs (Editor works fully,
 *  Community just shows a "not configured yet" state) before the backend
 *  is wired up. */
export const isSupabaseConfigured = Boolean(url && anonKey)

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(url!, anonKey!)
  : null

if (!isSupabaseConfigured) {
  // eslint-disable-next-line no-console
  console.warn(
    '[supabase] VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are not set — ' +
    'Community sign-in and data are disabled. Copy .env.example to .env and fill them in.'
  )
}

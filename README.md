# nevma

A browser-based photo editor that simulates analog print/development effects
(grain, scratches, chemical aging, physical tools like a knife/sandpaper/marker
acting on a simulated material sheet), plus a small Instagram-style community
around it — a public feed, profiles, likes, and comments — for sharing what
you make.

The whole UI (editor, feed, profile windows) is styled as a fake Windows 98
desktop: draggable/resizable windows, a boot screen, XP-style chrome.

## Stack

- React 18 + TypeScript, built with Vite
- [Konva](https://konvajs.org/) for the canvas/layer viewport
- A custom WebGL + Web Worker rendering engine (`src/engine/`) for the actual
  material simulation — heavy per-pixel work runs off the main thread, with a
  synchronous fallback when `SharedArrayBuffer`/cross-origin isolation isn't
  available
- [Supabase](https://supabase.com/) (Postgres + Auth + Storage) for the
  community layer — auth, profiles, posts, likes, comments
- [Zustand](https://github.com/pmndrs/zustand) for client state
- [Vitest](https://vitest.dev/) for tests

## Getting started

Requires Node `^20.19.0` or `>=22.12.0` (see `engines` in `package.json`).

```bash
npm install
npm run dev
```

The app runs and the editor works fully without any further setup. Sign-in
and the community feed need Supabase — without it configured, the auth
widget shows "sign-in coming soon" and the feed falls back to placeholder
posts so the page never looks broken.

### Setting up Supabase (optional, for auth/community)

1. Create a project at [supabase.com](https://supabase.com).
2. Copy `.env.example` to `.env` and fill in `VITE_SUPABASE_URL` and
   `VITE_SUPABASE_ANON_KEY` from Project Settings → API.
3. Run `supabase/schema.sql` in the Supabase SQL Editor (New query → paste →
   Run). It's safe to re-run — creates tables, RLS policies, and storage
   buckets if they don't already exist, and is also how you pick up schema
   changes on an existing project.

Without step 3, sign-up will succeed but saving the profile will fail, since
the `profiles` table won't exist yet.

## Scripts

| Command | Does |
|---|---|
| `npm run dev` | Start the Vite dev server |
| `npm run build` | Typecheck (`tsc -b`) then production build to `dist/` |
| `npm run preview` | Serve the production build locally |
| `npm run typecheck` | Typecheck only, no build |
| `npm test` | Run the test suite once |
| `npm run test:watch` | Run tests in watch mode |

## Project layout

```
src/
  app/         UI panels and the Konva viewport (the editor's own chrome)
  engine/      The material simulation — tools, adjustments, GL/worker code
  pages/       Top-level screens: Landing, Editor, Community, Profile
  state/       Zustand stores (editor doc/history, auth, route, ui, toast)
  lib/         Supabase-backed data access (community posts/comments/likes)
  domain/      Shared types and tool parameter definitions
  i18n/        EN/RU translation dictionary + useT() hook
  shared/      Small framework-agnostic utilities (bounds, image loading, ...)
bench/         Standalone perf/correctness harnesses for the engine, run with
               tsx outside the browser — see comments in each file
tests/         Vitest suite (engine determinism, checkpoints, state, domain)
supabase/      schema.sql — the full DB schema, RLS policies, and storage
               bucket setup, meant to be pasted into the Supabase SQL Editor
netlify/       Edge function for /p/<id> Open Graph previews on shared posts
```

## Deployment

Configured for [Netlify](https://netlify.com) out of the box (`netlify.toml`):
`npm run build` → `dist/`, with the cross-origin-isolation headers the engine's
worker pool needs, and an edge function that rewrites Open Graph tags for
`/p/<id>` post links so they preview correctly when shared. Set
`SUPABASE_URL` and `SUPABASE_ANON_KEY` (server-side) alongside the
`VITE_`-prefixed client env vars in the Netlify site settings for that to
work.

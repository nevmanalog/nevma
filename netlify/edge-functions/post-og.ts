// Runs (Deno) at Netlify's edge for every request to /p/<id> — see the
// [[edge_functions]] entry in netlify.toml. Its only job: fetch that post's
// title + image from Supabase and inject them as Open Graph / Twitter Card
// meta tags into the HTML *before* it reaches the browser.
//
// Why this has to happen here and not in React: link-preview bots
// (Facebook, Telegram, WhatsApp, Discord, Twitter/X, iMessage…) fetch the
// URL once, read whatever HTML comes back, and do NOT run JavaScript. If we
// only set these tags client-side (React `useEffect`, `document.title`,
// etc.), a bot fetching `/p/<id>` sees the exact same generic `index.html`
// for every single post — which is why link previews were generic before
// this existed. This function is what makes each post's shared link show
// its own artwork + title in a chat/social preview instead of the site's
// default icon.
//
// A real *person* who clicks the link still just gets the normal app: this
// function only rewrites <head> tags in the HTML it passes through, the
// React bundle underneath is untouched, and src/state/route.ts folds
// `/p/<id>` into the app's usual `#/post/<id>` hash route on load.
//
// Env vars: reuses the same Supabase project as the client app. Set
// SUPABASE_URL and SUPABASE_ANON_KEY in Netlify's site settings → Environment
// variables (same values as VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY —
// the VITE_ prefix only matters for Vite's client-side bundling, this
// function reads the plain names directly via Deno.env).

// Minimal local shape instead of importing `@netlify/edge-functions` for
// one type — keeps this file dependency-free so it can't break the build
// over an unrelated package/version mismatch. `context.next()` is all this
// function uses.
interface Context {
  next: () => Promise<Response>
}

interface PostRow {
  title: string
  image_url: string | null
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

async function fetchPost(id: string): Promise<PostRow | null> {
  const url = Deno.env.get('SUPABASE_URL')
  const key = Deno.env.get('SUPABASE_ANON_KEY')
  if (!url || !key) return null

  const endpoint = `${url}/rest/v1/posts?id=eq.${encodeURIComponent(id)}&select=title,image_url`
  const res = await fetch(endpoint, { headers: { apikey: key, Authorization: `Bearer ${key}` } })
  if (!res.ok) return null
  const rows = (await res.json()) as PostRow[]
  return rows[0] ?? null
}

export default async function handler(request: Request, context: Context): Promise<Response> {
  const response = await context.next()

  const match = new URL(request.url).pathname.match(/^\/p\/([^/]+)\/?$/)
  const id = match ? decodeURIComponent(match[1]) : null
  if (!id) return response

  let post: PostRow | null = null
  try {
    post = await fetchPost(id)
  } catch (err) {
    console.error('[post-og] fetch failed:', err)
  }
  // No post (deleted, bad id, Supabase unreachable) — serve the page as-is,
  // with the generic fallback tags already in index.html. Never break the
  // page over a missing preview.
  if (!post) return response

  const html = await response.text()
  const title = escapeHtml(`${post.title} — Nevma`)
  const description = 'An analog-collage piece made on Nevma — paper, print, scan, and every tool in between.'
  const image = post.image_url ? escapeHtml(post.image_url) : null
  const pageUrl = escapeHtml(request.url)

  const tags = [
    `<title>${title}</title>`,
    `<meta property="og:type" content="article" />`,
    `<meta property="og:title" content="${title}" />`,
    `<meta property="og:description" content="${description}" />`,
    `<meta property="og:url" content="${pageUrl}" />`,
    image ? `<meta property="og:image" content="${image}" />` : '',
    `<meta name="twitter:card" content="${image ? 'summary_large_image' : 'summary'}" />`,
    `<meta name="twitter:title" content="${title}" />`,
    image ? `<meta name="twitter:image" content="${image}" />` : '',
  ].filter(Boolean).join('\n    ')

  // The default tags in index.html carry an id="og-tags" wrapper marker
  // (see index.html) so this is a single clean swap instead of trying to
  // patch each tag individually.
  const rewritten = html.replace(
    /<!-- og:start -->[\s\S]*?<!-- og:end -->/,
    `<!-- og:start -->\n    ${tags}\n    <!-- og:end -->`
  )

  return new Response(rewritten, {
    status: response.status,
    headers: { ...Object.fromEntries(response.headers), 'content-type': 'text/html; charset=utf-8' },
  })
}

export const config = { path: '/p/*' }

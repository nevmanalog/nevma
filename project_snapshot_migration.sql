-- Run this in the Supabase dashboard: SQL Editor -> New query -> paste -> Run.
-- Safe to re-run: uses `if not exists` / `on conflict` throughout.
-- Apply this AFTER your existing schema.sql (adds to it, doesn't replace it).

-- ---------------------------------------------------------------------------
-- posts.project_url: URL of the full serialized project (layers, bitmaps,
-- groups — see src/engine/project.ts's serializePostProjectSnapshot),
-- captured when a post is published from the editor's Final tab. Lets
-- "Посмотреть проект" (src/pages/community/remix.ts's
-- viewCommunityProject) reopen the post as a real, editable copy laid out
-- exactly like the author's original, instead of only ever loading the
-- flattened preview image as a new layer. Null for posts published before
-- this existed and for the Community page's caption-only flow (no editor
-- state to capture) — those fall back to the older behaviour.
-- ---------------------------------------------------------------------------
alter table public.posts add column if not exists project_url text;

-- ---------------------------------------------------------------------------
-- The `posts` Storage bucket (see schema.sql) only allowed image mime types
-- and capped uploads at 20MB — fine for a single rendered composition, too
-- narrow for a multi-layer project's bitmaps bundled into one JSON file.
-- Widen both: allow application/json, and raise the cap to 50MB. A complex
-- multi-layer project can still legitimately exceed this — that upload will
-- fail with a clear storage error rather than hang, and the post itself
-- still publishes fine (project snapshot is uploaded separately from the
-- post image, see src/lib/community.ts's createPost).
-- ---------------------------------------------------------------------------
update storage.buckets
set allowed_mime_types = array['image/png', 'image/jpeg', 'image/webp', 'application/json'],
    file_size_limit = 52428800
where id = 'posts';

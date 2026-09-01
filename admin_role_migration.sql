-- Run this in the Supabase dashboard: SQL Editor -> New query -> paste -> Run.
-- Safe to re-run: uses `if not exists` / `drop policy if exists` throughout.
-- Apply this AFTER your existing schema.sql (adds to it, doesn't replace it).

-- ---------------------------------------------------------------------------
-- profiles.role: 'user' (default) or 'admin'. Admins can moderate posts and
-- comments (delete/update anyone's) and get a badge in the UI.
-- ---------------------------------------------------------------------------
alter table public.profiles add column if not exists role text not null default 'user';

alter table public.profiles drop constraint if exists profiles_role_valid;
alter table public.profiles add constraint profiles_role_valid check (role in ('user', 'admin'));

-- Small helper so the "am I admin" check isn't duplicated in every policy
-- below. security definer + fixed search_path so it can't be hijacked by a
-- session that's changed its search_path.
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- ---------------------------------------------------------------------------
-- posts: admins can delete or edit (e.g. un-pin, fix a title) anyone's post,
-- on top of the existing "own post" rule.
-- ---------------------------------------------------------------------------
drop policy if exists "users can delete their own posts" on public.posts;
create policy "users can delete their own posts"
  on public.posts for delete
  using (auth.uid() = author_id or public.is_admin());

drop policy if exists "users can update their own posts" on public.posts;
create policy "users can update their own posts"
  on public.posts for update
  using (auth.uid() = author_id or public.is_admin())
  with check (auth.uid() = author_id or public.is_admin());

-- ---------------------------------------------------------------------------
-- comments: admins can delete anyone's comment (e.g. remove abuse/spam).
-- ---------------------------------------------------------------------------
drop policy if exists "users can delete their own comments" on public.comments;
create policy "users can delete their own comments"
  on public.comments for delete
  using (auth.uid() = author_id or public.is_admin());

-- ---------------------------------------------------------------------------
-- posts.full_image_url: the original, uncompressed render — only fetched
-- when someone explicitly opens "view full resolution" (see
-- lib/community.ts's uploadPostImage / PostModal.tsx's post-modal-media-link).
-- posts.image_url keeps being the compressed, downscaled version everyone
-- actually downloads by default (feed tiles, profile grid, the open post).
-- Existing rows fall back to their own image_url until republished, both in
-- this column and in the app (lib/community.ts's mapPost).
-- ---------------------------------------------------------------------------
alter table public.posts add column if not exists full_image_url text;
update public.posts set full_image_url = image_url where full_image_url is null and image_url is not null;

-- ---------------------------------------------------------------------------
-- After running everything above, make yourself an admin by UUID (grab it
-- from Authentication -> Users in the Supabase dashboard, or run:
--   select id, display_name from public.profiles;
-- to find yourself by display_name):
--
--   update public.profiles set role = 'admin' where id = '<your-user-uuid>';
-- ---------------------------------------------------------------------------

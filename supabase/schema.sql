-- Run this in the Supabase dashboard: SQL Editor -> New query -> paste -> Run.
-- Safe to re-run: uses `if not exists` / `drop policy if exists` throughout.

-- ---------------------------------------------------------------------------
-- profiles: one row per signed-in user, created client-side right after
-- their first confirmed sign-up (see src/state/auth.ts -> saveProfile).
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null,
  avatar_url text,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "profiles are publicly readable" on public.profiles;
create policy "profiles are publicly readable"
  on public.profiles for select
  using (true);

drop policy if exists "users can insert their own profile" on public.profiles;
create policy "users can insert their own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

drop policy if exists "users can update their own profile" on public.profiles;
create policy "users can update their own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- ---------------------------------------------------------------------------
-- posts: one row per published preset. `image_url` is optional — captions
-- created from the Community page (no canvas at hand) leave it null and the
-- feed falls back to a placeholder tile; posts published from the editor's
-- Final tab attach the rendered composition (see the `posts` bucket below).
-- ---------------------------------------------------------------------------
create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles (id) on delete cascade,
  title text not null,
  image_url text,
  preset_data jsonb,
  created_at timestamptz not null default now()
);

-- `create table if not exists` above is a no-op on a database that already
-- has `posts` from before these columns existed, so add them explicitly too.
alter table public.posts add column if not exists image_url text;
alter table public.posts add column if not exists preset_data jsonb;

create index if not exists posts_author_id_idx on public.posts (author_id);
create index if not exists posts_created_at_idx on public.posts (created_at desc);

alter table public.posts enable row level security;

drop policy if exists "posts are publicly readable" on public.posts;
create policy "posts are publicly readable"
  on public.posts for select
  using (true);

drop policy if exists "users can publish their own posts" on public.posts;
create policy "users can publish their own posts"
  on public.posts for insert
  with check (auth.uid() = author_id);

drop policy if exists "users can delete their own posts" on public.posts;
create policy "users can delete their own posts"
  on public.posts for delete
  using (auth.uid() = author_id);

drop policy if exists "users can update their own posts" on public.posts;
create policy "users can update their own posts"
  on public.posts for update
  using (auth.uid() = author_id)
  with check (auth.uid() = author_id);

-- ---------------------------------------------------------------------------
-- follows: directed edge follower_id -> following_id. Composite primary key
-- means a duplicate follow just fails instead of creating a second row.
-- ---------------------------------------------------------------------------
create table if not exists public.follows (
  follower_id uuid not null references public.profiles (id) on delete cascade,
  following_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, following_id),
  constraint no_self_follow check (follower_id <> following_id)
);

create index if not exists follows_following_id_idx on public.follows (following_id);

alter table public.follows enable row level security;

drop policy if exists "follow graph is publicly readable" on public.follows;
create policy "follow graph is publicly readable"
  on public.follows for select
  using (true);

drop policy if exists "users can follow as themselves" on public.follows;
create policy "users can follow as themselves"
  on public.follows for insert
  with check (auth.uid() = follower_id);

drop policy if exists "users can unfollow as themselves" on public.follows;
create policy "users can unfollow as themselves"
  on public.follows for delete
  using (auth.uid() = follower_id);

-- ---------------------------------------------------------------------------
-- likes: one row per (post, user). Composite primary key means a duplicate
-- like just fails instead of creating a second row.
-- ---------------------------------------------------------------------------
create table if not exists public.likes (
  post_id uuid not null references public.posts (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create index if not exists likes_post_id_idx on public.likes (post_id);

alter table public.likes enable row level security;

drop policy if exists "likes are publicly readable" on public.likes;
create policy "likes are publicly readable"
  on public.likes for select
  using (true);

drop policy if exists "users can like as themselves" on public.likes;
create policy "users can like as themselves"
  on public.likes for insert
  with check (auth.uid() = user_id);

drop policy if exists "users can unlike as themselves" on public.likes;
create policy "users can unlike as themselves"
  on public.likes for delete
  using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- comments: one row per comment on a post.
-- ---------------------------------------------------------------------------
create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);

-- `create table if not exists` above is a no-op on a database that already
-- has `comments` from before `parent_id` existed, so add it explicitly too.
-- A reply always points at a top-level comment (never at another reply) —
-- enforced in the app layer, not the database — so the thread only ever
-- goes one level deep, Instagram-style.
alter table public.comments add column if not exists parent_id uuid references public.comments (id) on delete cascade;

create index if not exists comments_post_id_idx on public.comments (post_id);
create index if not exists comments_parent_id_idx on public.comments (parent_id);

alter table public.comments enable row level security;

drop policy if exists "comments are publicly readable" on public.comments;
create policy "comments are publicly readable"
  on public.comments for select
  using (true);

drop policy if exists "users can comment as themselves" on public.comments;
create policy "users can comment as themselves"
  on public.comments for insert
  with check (auth.uid() = author_id);

drop policy if exists "users can delete their own comments" on public.comments;
create policy "users can delete their own comments"
  on public.comments for delete
  using (auth.uid() = author_id);

-- ---------------------------------------------------------------------------
-- comment_reactions: one row per (comment, user) — `reaction` is 'like' or
-- 'dislike'. Composite primary key means switching from like to dislike is
-- an upsert (update the existing row) rather than a second row.
-- ---------------------------------------------------------------------------
create table if not exists public.comment_reactions (
  comment_id uuid not null references public.comments (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  reaction text not null check (reaction in ('like', 'dislike')),
  created_at timestamptz not null default now(),
  primary key (comment_id, user_id)
);

create index if not exists comment_reactions_comment_id_idx on public.comment_reactions (comment_id);

alter table public.comment_reactions enable row level security;

drop policy if exists "comment reactions are publicly readable" on public.comment_reactions;
create policy "comment reactions are publicly readable"
  on public.comment_reactions for select
  using (true);

drop policy if exists "users can react to comments as themselves" on public.comment_reactions;
create policy "users can react to comments as themselves"
  on public.comment_reactions for insert
  with check (auth.uid() = user_id);

drop policy if exists "users can change their own comment reaction" on public.comment_reactions;
create policy "users can change their own comment reaction"
  on public.comment_reactions for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "users can remove their own comment reaction" on public.comment_reactions;
create policy "users can remove their own comment reaction"
  on public.comment_reactions for delete
  using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- notifications: one row per event someone should be told about — a like,
-- a comment, or a new follower. `actor_id` is who did it, `recipient_id` is
-- who it's for. Written client-side right alongside the like/comment/follow
-- itself (see src/lib/community.ts) rather than via a database trigger, so
-- it's easy to see everywhere a notification gets created by reading the
-- app code — no server-side magic to keep in sync separately.
-- ---------------------------------------------------------------------------
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles (id) on delete cascade,
  actor_id uuid not null references public.profiles (id) on delete cascade,
  type text not null check (type in ('like', 'comment', 'follow')),
  post_id uuid references public.posts (id) on delete cascade,
  comment_id uuid references public.comments (id) on delete cascade,
  read boolean not null default false,
  created_at timestamptz not null default now(),
  constraint no_self_notification check (recipient_id <> actor_id)
);

create index if not exists notifications_recipient_id_created_at_idx
  on public.notifications (recipient_id, created_at desc);

alter table public.notifications enable row level security;

-- Only the recipient ever reads their own notifications — unlike posts/likes/
-- comments/follows, this isn't public data.
drop policy if exists "users can read their own notifications" on public.notifications;
create policy "users can read their own notifications"
  on public.notifications for select
  using (auth.uid() = recipient_id);

-- Anyone signed in can create a notification, but only as themselves as the
-- actor (auth.uid() = actor_id) — e.g. liking someone's post writes a
-- notification with yourself as actor and the post's author as recipient.
-- This mirrors how likes/comments/follows are already inserted client-side
-- as the acting user; it does not let you impersonate another actor, only
-- write events for their benefit.
drop policy if exists "users can notify others of their own actions" on public.notifications;
create policy "users can notify others of their own actions"
  on public.notifications for insert
  with check (auth.uid() = actor_id);

-- Marking as read (single or "mark all") is an update the recipient makes
-- on their own rows.
drop policy if exists "users can mark their own notifications read" on public.notifications;
create policy "users can mark their own notifications read"
  on public.notifications for update
  using (auth.uid() = recipient_id)
  with check (auth.uid() = recipient_id);

-- Lets the bell (src/pages/community/NotificationsBell.tsx) subscribe to new
-- rows over Supabase Realtime instead of only polling. Guarded so re-running
-- this script doesn't fail if it's already been added.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- avatars: public Storage bucket for profile pictures.
-- Files live at <user id>/<random id>.jpg (see src/lib/avatar.ts) — the RLS
-- policies below key off that first path segment matching the caller's own
-- auth.uid(), the same convention used in Supabase's own avatar-upload docs.
-- Public = true only affects READS (anyone with the URL can view the image,
-- same as any Instagram avatar); writes still go through the policies below.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "avatar images are publicly readable" on storage.objects;
create policy "avatar images are publicly readable"
  on storage.objects for select
  using (bucket_id = 'avatars');

drop policy if exists "users can upload their own avatar" on storage.objects;
create policy "users can upload their own avatar"
  on storage.objects for insert
  with check (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "users can replace their own avatar" on storage.objects;
create policy "users can replace their own avatar"
  on storage.objects for update
  using (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "users can delete their own avatar" on storage.objects;
create policy "users can delete their own avatar"
  on storage.objects for delete
  using (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- ---------------------------------------------------------------------------
-- posts: public Storage bucket for the rendered composition attached to a
-- post (published from the editor's Final tab — see src/lib/community.ts ->
-- uploadPostImage). Same convention as `avatars`: files live at
-- <user id>/<random id>.png and the RLS policies key off that first path
-- segment matching the caller's own auth.uid().
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('posts', 'posts', true, 20971520, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "post images are publicly readable" on storage.objects;
create policy "post images are publicly readable"
  on storage.objects for select
  using (bucket_id = 'posts');

drop policy if exists "users can upload their own post images" on storage.objects;
create policy "users can upload their own post images"
  on storage.objects for insert
  with check (
    bucket_id = 'posts'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "users can delete their own post images" on storage.objects;
create policy "users can delete their own post images"
  on storage.objects for delete
  using (
    bucket_id = 'posts'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

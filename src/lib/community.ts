import { supabase } from './supabase'
import { newId } from '@/shared/id'
import { notify } from './notifications'
import type { Layer } from '@/domain/types'

export interface CommunityProfile {
  id: string
  displayName: string
  avatarUrl: string | null
  createdAt: string
  role: 'user' | 'admin'
}

/** What's needed to reproduce a work's exact "processing" (paper/printer/
 *  damage/scanner/etc settings) — same shape as the editor's own SavedPreset
 *  (state/store.ts), minus the name (that comes from the post itself: title
 *  + author, filled in wherever this gets imported). */
export interface PostPresetData {
  effects: Layer['effects']
  seed: number
}

export interface CommunityPost {
  id: string
  authorId: string
  authorName: string
  authorAvatarUrl: string | null
  authorRole: 'user' | 'admin'
  title: string
  previewUrl: string | null
  /** Full-resolution original — only loaded when someone clicks "open full
   *  resolution" (see PostModal.tsx). Falls back to previewUrl for posts
   *  published before this existed (see admin_role_migration.sql). */
  fullUrl: string | null
  createdAt: string
  likeCount: number
  commentCount: number
  /** Present when this post was published from the editor's Final tab —
   *  lets anyone viewing it load the exact same processing into their own
   *  editor (see PostPresetChip / state/store.ts -> importPreset). Absent
   *  for posts published from the Community page's caption-only flow,
   *  which has no editor state to capture. */
  presetData: PostPresetData | null
}

export interface CommunityComment {
  id: string
  postId: string
  /** Id of the top-level comment this is a reply to, or null for a
   *  top-level comment. A reply's parentId always points at a top-level
   *  comment, never at another reply — same one-level-deep thread Instagram
   *  uses, kept simple by only ever passing a top-level id when posting. */
  parentId: string | null
  authorId: string
  authorName: string
  authorAvatarUrl: string | null
  authorRole: 'user' | 'admin'
  body: string
  createdAt: string
  likeCount: number
  dislikeCount: number
  myReaction: 'like' | 'dislike' | null
}

interface ProfileRow {
  id: string
  display_name: string
  avatar_url: string | null
  created_at: string
  role?: 'user' | 'admin'
}

function mapProfile(row: ProfileRow): CommunityProfile {
  return {
    id: row.id, displayName: row.display_name, avatarUrl: row.avatar_url, createdAt: row.created_at,
    role: row.role ?? 'user',
  }
}

export async function fetchProfile(id: string): Promise<CommunityProfile | null> {
  if (!supabase) return null
  const { data, error } = await supabase.from('profiles').select('*').eq('id', id).maybeSingle()
  if (error || !data) return null
  return mapProfile(data as ProfileRow)
}

export async function fetchFollowCounts(id: string): Promise<{ followers: number; following: number }> {
  if (!supabase) return { followers: 0, following: 0 }
  const [followers, following] = await Promise.all([
    supabase.from('follows').select('follower_id', { count: 'exact', head: true }).eq('following_id', id),
    supabase.from('follows').select('following_id', { count: 'exact', head: true }).eq('follower_id', id),
  ])
  return { followers: followers.count ?? 0, following: following.count ?? 0 }
}

export async function isFollowing(followerId: string, targetId: string): Promise<boolean> {
  if (!supabase) return false
  const { data } = await supabase
    .from('follows')
    .select('follower_id')
    .eq('follower_id', followerId)
    .eq('following_id', targetId)
    .maybeSingle()
  return Boolean(data)
}

export async function follow(followerId: string, targetId: string): Promise<void> {
  if (!supabase) return
  const { error } = await supabase.from('follows').insert({ follower_id: followerId, following_id: targetId })
  if (error) throw error
  await notify(followerId, targetId, 'follow')
}

export async function unfollow(followerId: string, targetId: string): Promise<void> {
  if (!supabase) return
  const { error } = await supabase
    .from('follows')
    .delete()
    .eq('follower_id', followerId)
    .eq('following_id', targetId)
  if (error) throw error
}

/** Ids of everyone `userId` follows — used to build the "Following" feed
 *  scope. A separate round trip rather than a single joined query because
 *  PostgREST can't express "posts where author_id in (subquery)" without
 *  either a database view/RPC or fetching the id list client-side first;
 *  the extra request is cheap (this table has no other columns to embed)
 *  and keeps the filtering logic next to fetchFollowingFeedPosts below
 *  instead of splitting it across a SQL view someone has to remember to
 *  keep in sync with the schema. */
export async function fetchFollowingIds(userId: string): Promise<string[]> {
  if (!supabase) return []
  const { data, error } = await supabase.from('follows').select('following_id').eq('follower_id', userId)
  if (error) { console.error('[community] fetchFollowingIds failed:', error.message); return [] }
  return (data ?? []).map((row) => row.following_id as string)
}


// `profiles` is embedded via the posts.author_id -> profiles.id foreign key,
// so PostgREST resolves the join automatically from the relationship name.
// `likes(count)` / `comments(count)` are PostgREST's aggregate-embed syntax —
// they come back as a one-element array like `[{ count: 3 }]` rather than a
// plain number.
// `!author_id` tells PostgREST exactly which foreign key to embed through —
// without it, a project with more than one FK between `posts`/`comments`
// and `profiles` (e.g. one added by hand in the Supabase table editor on
// top of this script) makes the embed ambiguous and the whole query fails.
const POST_SELECT = 'id, title, image_url, full_image_url, preset_data, created_at, author_id, profiles!author_id ( display_name, avatar_url, role ), likes(count), comments(count)'

interface PostRow {
  id: string
  title: string
  image_url: string | null
  full_image_url: string | null
  preset_data: PostPresetData | null
  created_at: string
  author_id: string
  profiles: { display_name: string; avatar_url: string | null; role?: 'user' | 'admin' } | null
  likes?: { count: number }[]
  comments?: { count: number }[]
}

function mapPost(row: PostRow): CommunityPost {
  return {
    id: row.id,
    authorId: row.author_id,
    authorName: row.profiles?.display_name ?? 'unknown',
    authorAvatarUrl: row.profiles?.avatar_url ?? null,
    authorRole: row.profiles?.role ?? 'user',
    title: row.title,
    previewUrl: row.image_url,
    fullUrl: row.full_image_url ?? row.image_url,
    createdAt: row.created_at,
    likeCount: row.likes?.[0]?.count ?? 0,
    commentCount: row.comments?.[0]?.count ?? 0,
    presetData: row.preset_data ?? null,
  }
}

export async function fetchFeedPosts(limit = 30): Promise<CommunityPost[]> {
  if (!supabase) return []
  const { data, error } = await supabase
    .from('posts')
    .select(POST_SELECT)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) console.error('[community] fetchFeedPosts failed:', error.message)
  if (error || !data) return []
  return (data as unknown as PostRow[]).map(mapPost)
}

/** Same shape as fetchFeedPosts, but only posts by people `userId` follows
 *  — the "Following" feed scope (see Community.tsx). Two round trips
 *  (follow list, then the posts themselves) rather than one — see
 *  fetchFollowingIds' own comment for why. Empty following list short-
 *  circuits before the second request, since `.in('author_id', [])` would
 *  otherwise still be a request just to learn what an empty array already
 *  told us: no posts to show. */
export async function fetchFollowingFeedPosts(userId: string, limit = 30): Promise<CommunityPost[]> {
  if (!supabase) return []
  const ids = await fetchFollowingIds(userId)
  if (ids.length === 0) return []
  const { data, error } = await supabase
    .from('posts')
    .select(POST_SELECT)
    .in('author_id', ids)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) console.error('[community] fetchFollowingFeedPosts failed:', error.message)
  if (error || !data) return []
  return (data as unknown as PostRow[]).map(mapPost)
}

export async function fetchUserPosts(authorId: string): Promise<CommunityPost[]> {
  if (!supabase) return []
  const { data, error } = await supabase
    .from('posts')
    .select(POST_SELECT)
    .eq('author_id', authorId)
    .order('created_at', { ascending: false })
  if (error) console.error('[community] fetchUserPosts failed:', error.message)
  if (error || !data) return []
  return (data as unknown as PostRow[]).map(mapPost)
}

/** Single post by id — used for direct-link deep loading (`/p/<id>` and
 *  `#/post/<id>`), where we land on a post nobody has fetched into the
 *  feed list yet and can't just find it by scanning `posts` in state. */
export async function fetchPostById(id: string): Promise<CommunityPost | null> {
  if (!supabase) return null
  const { data, error } = await supabase
    .from('posts')
    .select(POST_SELECT)
    .eq('id', id)
    .maybeSingle()
  if (error) console.error('[community] fetchPostById failed:', error.message)
  if (error || !data) return null
  return mapPost(data as unknown as PostRow)
}

/** Which of the given posts the user has liked — used to draw the heart
 *  filled/unfilled per post without a round trip per tile. */
export async function fetchLikedPostIds(userId: string, postIds: string[]): Promise<Set<string>> {
  if (!supabase || postIds.length === 0) return new Set()
  const { data } = await supabase.from('likes').select('post_id').eq('user_id', userId).in('post_id', postIds)
  return new Set((data ?? []).map((row) => row.post_id as string))
}

export async function likePost(postId: string, userId: string, postAuthorId?: string): Promise<void> {
  if (!supabase) return
  const { error } = await supabase.from('likes').insert({ post_id: postId, user_id: userId })
  if (error) throw error
  if (postAuthorId) await notify(userId, postAuthorId, 'like', { postId })
}

export async function unlikePost(postId: string, userId: string): Promise<void> {
  if (!supabase) return
  const { error } = await supabase.from('likes').delete().eq('post_id', postId).eq('user_id', userId)
  if (error) throw error
}

/** Ground truth for "did this user like this post" — used to reconcile the
 *  UI after a like/unlike, instead of trusting a locally-incremented count
 *  that can drift (double clicks, an insert that fails because the row
 *  already existed, etc). */
export async function isPostLiked(postId: string, userId: string): Promise<boolean> {
  if (!supabase) return false
  const { data } = await supabase
    .from('likes')
    .select('post_id')
    .eq('post_id', postId)
    .eq('user_id', userId)
    .maybeSingle()
  return Boolean(data)
}

/** Ground truth for a post's like count — same reasoning as isPostLiked. */
export async function fetchLikeCount(postId: string): Promise<number> {
  if (!supabase) return 0
  const { count } = await supabase.from('likes').select('*', { count: 'exact', head: true }).eq('post_id', postId)
  return count ?? 0
}

interface CommentRow {
  id: string
  post_id: string
  parent_id: string | null
  author_id: string
  body: string
  created_at: string
  profiles: { display_name: string; avatar_url: string | null; role?: 'user' | 'admin' } | null
}

interface ReactionRow {
  comment_id: string
  user_id: string
  reaction: 'like' | 'dislike'
}

/** Loads every reaction on the given comments in one query — cheaper than a
 *  per-comment round trip — and hands back the ready-to-use fields for each
 *  comment. */
async function fetchCommentReactions(commentIds: string[], currentUserId?: string | null) {
  if (!supabase || commentIds.length === 0) return new Map<string, { likeCount: number; dislikeCount: number; myReaction: 'like' | 'dislike' | null }>()
  const { data } = await supabase.from('comment_reactions').select('comment_id, user_id, reaction').in('comment_id', commentIds)
  const rows = (data ?? []) as ReactionRow[]
  const byComment = new Map<string, { likeCount: number; dislikeCount: number; myReaction: 'like' | 'dislike' | null }>()
  for (const id of commentIds) byComment.set(id, { likeCount: 0, dislikeCount: 0, myReaction: null })
  for (const row of rows) {
    const entry = byComment.get(row.comment_id)
    if (!entry) continue
    if (row.reaction === 'like') entry.likeCount += 1
    else entry.dislikeCount += 1
    if (currentUserId && row.user_id === currentUserId) entry.myReaction = row.reaction
  }
  return byComment
}

export async function fetchComments(postId: string, currentUserId?: string | null): Promise<CommunityComment[]> {
  if (!supabase) return []
  const { data, error } = await supabase
    .from('comments')
    .select('id, post_id, parent_id, author_id, body, created_at, profiles!author_id ( display_name, avatar_url, role )')
    .eq('post_id', postId)
    .order('created_at', { ascending: true })
  if (error) console.error('[community] fetchComments failed:', error.message)
  if (error || !data) return []
  const rows = data as unknown as CommentRow[]
  const reactions = await fetchCommentReactions(rows.map((r) => r.id), currentUserId)
  return rows.map((row) => {
    const r = reactions.get(row.id) ?? { likeCount: 0, dislikeCount: 0, myReaction: null }
    return {
      id: row.id,
      postId: row.post_id,
      parentId: row.parent_id,
      authorId: row.author_id,
      authorName: row.profiles?.display_name ?? 'unknown',
      authorAvatarUrl: row.profiles?.avatar_url ?? null,
      authorRole: row.profiles?.role ?? 'user',
      body: row.body,
      createdAt: row.created_at,
      likeCount: r.likeCount,
      dislikeCount: r.dislikeCount,
      myReaction: r.myReaction,
    }
  })
}

/** `parentId` is the top-level comment being replied to (or null for a
 *  top-level comment) — see the note on `CommunityComment.parentId`.
 *  Returns the inserted row's real id/timestamp so callers don't have to
 *  keep a client-generated placeholder id around (a placeholder id can't
 *  be used to react to the comment, since comment_reactions.comment_id is
 *  a foreign key into this table). */
export async function addComment(
  postId: string, authorId: string, body: string, parentId?: string | null, postAuthorId?: string,
): Promise<{ id: string; createdAt: string }> {
  if (!supabase) throw new Error('Supabase is not configured')
  const { data, error } = await supabase
    .from('comments')
    .insert({ post_id: postId, author_id: authorId, body, parent_id: parentId ?? null })
    .select('id, created_at')
    .single()
  if (error) throw error
  if (postAuthorId) await notify(authorId, postAuthorId, 'comment', { postId, commentId: data.id })
  return { id: data.id, createdAt: data.created_at }
}

/** Sets, changes, or clears (pass null) the current user's reaction to a
 *  comment. Upserts on the (comment_id, user_id) primary key, so switching
 *  from like to dislike replaces the row instead of adding a second one. */
export async function setCommentReaction(commentId: string, userId: string, reaction: 'like' | 'dislike' | null): Promise<void> {
  if (!supabase) return
  if (reaction === null) {
    const { error } = await supabase.from('comment_reactions').delete().eq('comment_id', commentId).eq('user_id', userId)
    if (error) throw error
    return
  }
  const { error } = await supabase.from('comment_reactions').upsert({ comment_id: commentId, user_id: userId, reaction })
  if (error) throw error
}

/** Ground truth for a single comment's reaction counts — used to reconcile
 *  the UI after a like/dislike click, same reasoning as fetchLikeCount. */
export async function fetchCommentReactionCounts(commentId: string): Promise<{ likeCount: number; dislikeCount: number }> {
  if (!supabase) return { likeCount: 0, dislikeCount: 0 }
  const [likes, dislikes] = await Promise.all([
    supabase.from('comment_reactions').select('*', { count: 'exact', head: true }).eq('comment_id', commentId).eq('reaction', 'like'),
    supabase.from('comment_reactions').select('*', { count: 'exact', head: true }).eq('comment_id', commentId).eq('reaction', 'dislike'),
  ])
  return { likeCount: likes.count ?? 0, dislikeCount: dislikes.count ?? 0 }
}

export async function fetchMyCommentReaction(commentId: string, userId: string): Promise<'like' | 'dislike' | null> {
  if (!supabase) return null
  const { data } = await supabase
    .from('comment_reactions')
    .select('reaction')
    .eq('comment_id', commentId)
    .eq('user_id', userId)
    .maybeSingle()
  return (data?.reaction as 'like' | 'dislike' | undefined) ?? null
}

const POSTS_BUCKET = 'posts'

/**
 * Downscales+recompresses a rendered post image for anything that isn't the
 * explicit "open full resolution" view: feed tiles, the profile grid, and
 * the open-post display itself. The editor exports a lossless, full-working-
 * resolution PNG (see engine/exportLayers.ts's renderFinalImage) which can
 * run into several MB — fine as the one-time "view full size" download, way
 * too much for something fetched on every scroll past a tile.
 *
 * Caps the longest side at 1600px (plenty for any screen this app renders
 * the image on) and re-encodes as JPEG at 0.85 quality. Falls back to the
 * original blob if canvas decoding fails for any reason (e.g. an
 * unsupported format) rather than blocking the publish.
 */
async function createDisplayImage(source: Blob, maxDim = 1600, quality = 0.85): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(source)
    const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height))
    const w = Math.max(1, Math.round(bitmap.width * scale))
    const h = Math.max(1, Math.round(bitmap.height * scale))
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) return source
    // JPEG has no alpha channel — flatten onto white first so transparent
    // areas (e.g. a paper edge that hasn't been fully cropped) don't turn
    // black, which is JPEG's default for "no pixel data" instead of white.
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, w, h)
    ctx.drawImage(bitmap, 0, 0, w, h)
    bitmap.close()
    const blob: Blob | null = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality))
    return blob ?? source
  } catch (err) {
    console.error('[community] createDisplayImage failed, uploading original instead:', err)
    return source
  }
}

/**
 * Uploads both the compressed display image and the full-resolution
 * original to the `posts` bucket and returns both public URLs. Path is
 * `${userId}/${newId()}.<ext>` — same per-user-folder convention as
 * uploadAvatar, which is what the storage RLS policies in
 * supabase/schema.sql key off.
 */
export async function uploadPostImage(userId: string, image: Blob): Promise<{ displayUrl: string; fullUrl: string }> {
  if (!supabase) throw new Error('Supabase is not configured')
  const id = newId()
  const displayImage = await createDisplayImage(image)
  const fullPath = `${userId}/${id}.png`
  const displayPath = displayImage === image ? fullPath : `${userId}/${id}_display.jpg`

  const { error: fullError } = await supabase.storage
    .from(POSTS_BUCKET)
    .upload(fullPath, image, { contentType: 'image/png', cacheControl: '31536000' })
  if (fullError) throw fullError
  const fullUrl = supabase.storage.from(POSTS_BUCKET).getPublicUrl(fullPath).data.publicUrl

  if (displayPath === fullPath) return { displayUrl: fullUrl, fullUrl }

  const { error: displayError } = await supabase.storage
    .from(POSTS_BUCKET)
    .upload(displayPath, displayImage, { contentType: 'image/jpeg', cacheControl: '31536000' })
  if (displayError) throw displayError
  const displayUrl = supabase.storage.from(POSTS_BUCKET).getPublicUrl(displayPath).data.publicUrl

  return { displayUrl, fullUrl }
}

/**
 * `image` is optional so the Community page's caption-only publish flow
 * (no canvas to render from) still works exactly as before; the editor's
 * Final-tab publish button passes the rendered composition through.
 *
 * `presetData` is likewise only present from the editor's publish button —
 * it's the active layer's effects+seed at the moment of publishing, stored
 * as-is (jsonb) so anyone can later load the exact same processing via
 * PostPresetChip -> state/store.ts's importPreset.
 */
export async function createPost(
  authorId: string, title: string, image?: Blob | null, presetData?: PostPresetData | null,
): Promise<void> {
  if (!supabase) return
  const uploaded = image ? await uploadPostImage(authorId, image) : null
  const { error } = await supabase
    .from('posts')
    .insert({
      author_id: authorId, title,
      image_url: uploaded?.displayUrl ?? null,
      full_image_url: uploaded?.fullUrl ?? null,
      preset_data: presetData ?? null,
    })
  if (error) throw error
}

/**
 * Deletes a post. For a regular user this is scoped with
 * `.eq('author_id', authorId)` in addition to the RLS policy in
 * supabase/schema.sql — belt and suspenders, and it means a caller passing
 * the wrong id just deletes nothing instead of relying solely on the
 * database to reject it. An admin (see supabase/admin_role_migration.sql)
 * skips that client-side filter and deletes by id alone — the RLS
 * `is_admin()` check on the server is still the real gate, this just
 * avoids the client filtering out a row the caller is actually allowed to
 * touch.
 */
export async function deletePost(postId: string, authorId: string, isAdmin = false): Promise<void> {
  if (!supabase) return
  const query = supabase.from('posts').delete().eq('id', postId)
  const { error } = await (isAdmin ? query : query.eq('author_id', authorId))
  if (error) throw error
}

/**
 * Renames a post's caption. Requires the "users can update their own posts"
 * policy on public.posts (see supabase/schema.sql) — re-run that script if
 * this fails with a permissions error on an older database. `isAdmin` works
 * the same way as in deletePost above.
 */
export async function updatePostTitle(postId: string, authorId: string, title: string, isAdmin = false): Promise<void> {
  if (!supabase) return
  const query = supabase.from('posts').update({ title }).eq('id', postId)
  const { error } = await (isAdmin ? query : query.eq('author_id', authorId))
  if (error) throw error
}

/**
 * Deletes a comment. Same own-row-or-admin shape as deletePost — mirrors
 * the "users can delete their own comments" RLS policy, which now also
 * allows public.is_admin() (see supabase/admin_role_migration.sql).
 */
export async function deleteComment(commentId: string, authorId: string, isAdmin = false): Promise<void> {
  if (!supabase) return
  const query = supabase.from('comments').delete().eq('id', commentId)
  const { error } = await (isAdmin ? query : query.eq('author_id', authorId))
  if (error) throw error
}

import { supabase } from './supabase'

export type NotificationType = 'like' | 'comment' | 'follow'

export interface CommunityNotification {
  id: string
  type: NotificationType
  read: boolean
  createdAt: string
  actorId: string
  actorName: string
  actorAvatarUrl: string | null
  postId: string | null
  commentId: string | null
}

interface NotificationRow {
  id: string
  type: NotificationType
  read: boolean
  created_at: string
  actor_id: string
  post_id: string | null
  comment_id: string | null
  profiles: { display_name: string; avatar_url: string | null } | null
}

// `!actor_id` picks the actor's profile through that specific foreign key —
// notifications also has a recipient_id -> profiles FK, so without it
// PostgREST can't tell which relationship to embed and the query fails.
const NOTIFICATION_SELECT = 'id, type, read, created_at, actor_id, post_id, comment_id, profiles!actor_id ( display_name, avatar_url )'

function mapNotification(row: NotificationRow): CommunityNotification {
  return {
    id: row.id,
    type: row.type,
    read: row.read,
    createdAt: row.created_at,
    actorId: row.actor_id,
    actorName: row.profiles?.display_name ?? 'unknown',
    actorAvatarUrl: row.profiles?.avatar_url ?? null,
    postId: row.post_id,
    commentId: row.comment_id,
  }
}

/**
 * Best-effort: called right after a like/comment/follow succeeds (see
 * community.ts) to tell the other person about it. Never throws — a failed
 * notification insert (e.g. an older database that hasn't run the latest
 * supabase/schema.sql yet) shouldn't undo or block the like/comment/follow
 * it's attached to.
 */
export async function notify(
  actorId: string,
  recipientId: string,
  type: NotificationType,
  extra?: { postId?: string; commentId?: string },
): Promise<void> {
  if (!supabase || actorId === recipientId) return
  const { error } = await supabase.from('notifications').insert({
    actor_id: actorId,
    recipient_id: recipientId,
    type,
    post_id: extra?.postId ?? null,
    comment_id: extra?.commentId ?? null,
  })
  if (error) console.error('[notifications] notify failed:', error.message)
}

export async function fetchNotifications(recipientId: string, limit = 30): Promise<CommunityNotification[]> {
  if (!supabase) return []
  const { data, error } = await supabase
    .from('notifications')
    .select(NOTIFICATION_SELECT)
    .eq('recipient_id', recipientId)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) console.error('[notifications] fetchNotifications failed:', error.message)
  if (error || !data) return []
  return (data as unknown as NotificationRow[]).map(mapNotification)
}

export async function fetchUnreadCount(recipientId: string): Promise<number> {
  if (!supabase) return 0
  const { count, error } = await supabase
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('recipient_id', recipientId)
    .eq('read', false)
  if (error) console.error('[notifications] fetchUnreadCount failed:', error.message)
  return count ?? 0
}

export async function markNotificationRead(id: string): Promise<void> {
  if (!supabase) return
  const { error } = await supabase.from('notifications').update({ read: true }).eq('id', id)
  if (error) console.error('[notifications] markNotificationRead failed:', error.message)
}

export async function markAllNotificationsRead(recipientId: string): Promise<void> {
  if (!supabase) return
  const { error } = await supabase
    .from('notifications')
    .update({ read: true })
    .eq('recipient_id', recipientId)
    .eq('read', false)
  if (error) console.error('[notifications] markAllNotificationsRead failed:', error.message)
}

/**
 * Live updates via Supabase Realtime: fires `onInsert` for any new
 * notification addressed to this user (e.g. bump the unread badge without
 * polling). Returns an unsubscribe function; safe to call when Supabase
 * isn't configured (returns a no-op).
 */
export function subscribeToNotifications(recipientId: string, onInsert: (n: CommunityNotification) => void): () => void {
  if (!supabase) return () => {}
  const channel = supabase
    .channel(`notifications:${recipientId}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'notifications', filter: `recipient_id=eq.${recipientId}` },
      (payload) => {
        // The realtime payload doesn't include the joined profile, so fetch
        // that one row through the normal select to get the actor's name/
        // avatar rather than showing a blank "unknown" entry that then has
        // to be patched up later.
        const row = payload.new as { id: string }
        if (!supabase) return
        supabase.from('notifications').select(NOTIFICATION_SELECT).eq('id', row.id).maybeSingle()
          .then(({ data }) => { if (data) onInsert(mapNotification(data as unknown as NotificationRow)) })
      },
    )
    .subscribe()
  return () => { supabase?.removeChannel(channel) }
}

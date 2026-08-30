import { useEffect, useRef, useState } from 'react'
import { useT } from '@/i18n'
import { useAuth } from '@/state/auth'
import { useRoute } from '@/state/route'
import {
  fetchNotifications, fetchUnreadCount, markNotificationRead, markAllNotificationsRead,
  subscribeToNotifications, type CommunityNotification,
} from '@/lib/notifications'

function Avatar({ url, name }: { url: string | null; name: string }) {
  return url
    ? <img className="notif-avatar" crossOrigin="anonymous" src={url} alt="" />
    : <div className="notif-avatar notif-avatar-fallback">{name[0]?.toUpperCase() ?? '?'}</div>
}

/** Relative time ("3m ago"), matching the granularity Instagram-style
 *  notification lists use — exact timestamps aren't useful at this scale. */
function useRelativeTime(iso: string, t: ReturnType<typeof useT>) {
  const then = new Date(iso).getTime()
  const diffSec = Math.max(0, Math.floor((Date.now() - then) / 1000))
  if (diffSec < 60) return t('timeJustNow')
  const diffMin = Math.floor(diffSec / 60)
  if (diffMin < 60) return t('timeMinutesAgo').replace('{n}', String(diffMin))
  const diffHr = Math.floor(diffMin / 60)
  if (diffHr < 24) return t('timeHoursAgo').replace('{n}', String(diffHr))
  const diffDay = Math.floor(diffHr / 24)
  return t('timeDaysAgo').replace('{n}', String(diffDay))
}

function NotificationRow({
  n, t, onOpen,
}: {
  n: CommunityNotification
  t: ReturnType<typeof useT>
  onOpen: (n: CommunityNotification) => void
}) {
  const relTime = useRelativeTime(n.createdAt, t)
  const textKey = n.type === 'like' ? 'notificationLike' : n.type === 'comment' ? 'notificationComment' : 'notificationFollow'
  const icon = n.type === 'like' ? '♥' : n.type === 'comment' ? '💬' : '➕'
  return (
    <button
      type="button"
      className={`notif-row${n.read ? '' : ' notif-row-unread'}`}
      onClick={() => onOpen(n)}
    >
      <Avatar url={n.actorAvatarUrl} name={n.actorName} />
      <span className="notif-row-body">
        <span className="notif-row-text">
          <span className="notif-row-icon" aria-hidden="true">{icon}</span>{' '}
          {t(textKey).replace('{name}', n.actorName)}
        </span>
        <span className="notif-row-time">{relTime}</span>
      </span>
      {!n.read && <span className="notif-row-dot" aria-hidden="true" />}
    </button>
  )
}

/**
 * Bell button + dropdown in the Community topbar. Only rendered for signed-in
 * users (see Community.tsx). Polls the unread count on a light interval and
 * also listens for live inserts over Supabase Realtime, so a badge appears
 * without needing to reopen the page — the poll is just a fallback for
 * environments where Realtime isn't reachable (e.g. a restrictive network).
 */
export function NotificationsBell() {
  const t = useT()
  const user = useAuth((s) => s.user)
  const openPost = useRoute((s) => s.openPost)
  const openProfile = useRoute((s) => s.openProfile)

  const [open, setOpen] = useState(false)
  const [unread, setUnread] = useState(0)
  const [items, setItems] = useState<CommunityNotification[]>([])
  const [loaded, setLoaded] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  const userId = user?.id ?? null

  // Unread badge: initial load + light poll + realtime push, whichever
  // arrives first for any given event.
  useEffect(() => {
    if (!userId) { setUnread(0); return }
    let cancelled = false
    const refreshCount = () => fetchUnreadCount(userId).then((n) => { if (!cancelled) setUnread(n) })
    refreshCount()
    const poll = window.setInterval(refreshCount, 60_000)
    const unsubscribe = subscribeToNotifications(userId, () => { if (!cancelled) setUnread((n) => n + 1) })
    return () => { cancelled = true; window.clearInterval(poll); unsubscribe() }
  }, [userId])

  // Full list: fetched lazily the first time the panel is opened, then kept
  // in state — no need to refetch every open within the same session.
  useEffect(() => {
    if (!open || !userId || loaded) return
    fetchNotifications(userId).then((list) => { setItems(list); setLoaded(true) })
  }, [open, userId, loaded])

  // Close on outside click / Escape — the one dropdown in an app otherwise
  // built entirely out of full-screen modals, so there's no existing pattern
  // to lean on here.
  useEffect(() => {
    if (!open) return
    const onDown = (ev: MouseEvent) => { if (wrapRef.current && !wrapRef.current.contains(ev.target as Node)) setOpen(false) }
    const onKey = (ev: KeyboardEvent) => { if (ev.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey) }
  }, [open])

  if (!userId) return null

  const markAllRead = () => {
    markAllNotificationsRead(userId)
    setItems((list) => list.map((n) => ({ ...n, read: true })))
    setUnread(0)
  }

  const openNotification = (n: CommunityNotification) => {
    if (!n.read) {
      markNotificationRead(n.id)
      setItems((list) => list.map((x) => (x.id === n.id ? { ...x, read: true } : x)))
      setUnread((count) => Math.max(0, count - 1))
    }
    setOpen(false)
    if (n.type === 'follow') openProfile(n.actorId)
    else if (n.postId) openPost(n.postId)
  }

  return (
    <div className="notif-bell-wrap" ref={wrapRef}>
      <button
        type="button"
        className="notif-bell-btn"
        aria-label={t('notificationsTitle')}
        onClick={() => setOpen((v) => !v)}
      >
        🔔
        {unread > 0 && <span className="notif-bell-badge">{unread > 9 ? '9+' : unread}</span>}
      </button>

      {open && (
        <div className="notif-panel raised-out">
          <div className="notif-panel-header">
            <span>{t('notificationsTitle')}</span>
            {items.some((n) => !n.read) && (
              <button type="button" className="notif-mark-all" onClick={markAllRead}>
                {t('notificationsMarkAllRead')}
              </button>
            )}
          </div>
          <div className="notif-panel-list">
            {loaded && items.length === 0 && (
              <p className="notif-panel-empty">{t('notificationsEmpty')}</p>
            )}
            {items.map((n) => (
              <NotificationRow key={n.id} n={n} t={t} onOpen={openNotification} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

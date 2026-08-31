import { useEffect, useState } from 'react'
import { useT } from '@/i18n'
import {
  fetchComments, addComment, setCommentReaction, fetchCommentReactionCounts, fetchMyCommentReaction,
  type CommunityPost, type CommunityComment,
} from '@/lib/community'
import { PostPresetChip } from './PostPresetChip'

interface Props {
  post: CommunityPost
  liked: boolean
  currentUserId: string | null
  currentUserName: string | null
  currentUserAvatarUrl: string | null
  onClose: () => void
  onToggleLike: () => void
  onRequireAuth: () => void
  /** Navigates to a commenter's/author's profile and closes this modal —
   *  wired from the page-level `openProfile` (see state/route.ts). */
  onOpenProfile: (userId: string) => void
  /** Called right after a comment is successfully posted, so the caller can
   *  bump this post's commentCount in the feed/profile list behind the
   *  modal — that count lives outside this component. */
  onCommentAdded: () => void
}

function Avatar({ url, name, className }: { url: string | null; name: string; className: string }) {
  return url
    ? <img className={className} crossOrigin="anonymous" src={url} alt="" />
    : <div className={`${className} post-modal-avatar-fallback`}>{name[0]?.toUpperCase()}</div>
}

/** Full-screen, Instagram-style post view: image on one side, header +
 *  scrollable comment thread + composer on the other. Opened from a post
 *  tile on the feed or on a profile page. */
export function PostModal({
  post, liked, currentUserId, currentUserName, currentUserAvatarUrl,
  onClose, onToggleLike, onRequireAuth, onOpenProfile, onCommentAdded,
}: Props) {
  const t = useT()
  const [comments, setComments] = useState<CommunityComment[]>([])
  const [loadingComments, setLoadingComments] = useState(true)
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState(false)
  const [replyTo, setReplyTo] = useState<{ id: string; name: string } | null>(null)
  const [linkCopied, setLinkCopied] = useState(false)

  // `/p/<id>` rather than the in-app `#/post/<id>` hash — a real path is
  // what lets link-preview bots and search engines see which post this is
  // (see netlify/edge-functions/post-og.ts); a person opening it just gets
  // folded straight back into the normal app (state/route.ts).
  const shareUrl = `${window.location.origin}/p/${encodeURIComponent(post.id)}`

  const share = async () => {
    if (navigator.share) {
      try { await navigator.share({ title: post.title, url: shareUrl }); return } catch { /* cancelled — fall through to copy */ }
    }
    try {
      await navigator.clipboard.writeText(shareUrl)
      setLinkCopied(true)
      window.setTimeout(() => setLinkCopied(false), 2000)
    } catch (err) {
      console.error('[community] copy share link failed:', err)
    }
  }

  useEffect(() => {
    let cancelled = false
    setLoadingComments(true)
    fetchComments(post.id, currentUserId).then((c) => {
      if (cancelled) return
      setComments(c)
      setLoadingComments(false)
    })
    return () => { cancelled = true }
    // `currentUserId` genuinely belongs in the deps (not just to satisfy
    // the linter): it decides each comment's `myReaction`, and this modal
    // can stay mounted across a sign-in/sign-out (AuthModal layers on top
    // of it rather than replacing it) — without refetching here, the
    // like/dislike state shown would still reflect whoever was signed in
    // when the modal first opened.
  }, [post.id, currentUserId])

  const submitComment = async () => {
    if (!currentUserId) { onRequireAuth(); return }
    const trimmed = text.trim()
    if (!trimmed || sending) return
    setSending(true)
    setSendError(false)
    const parentId = replyTo?.id ?? null
    const body = replyTo ? `@${replyTo.name} ${trimmed}` : trimmed
    try {
      const created = await addComment(post.id, currentUserId, body, parentId, post.authorId)
      setComments((c) => [...c, {
        id: created.id,
        postId: post.id,
        parentId,
        authorId: currentUserId,
        authorName: currentUserName ?? '',
        authorAvatarUrl: currentUserAvatarUrl,
        body,
        createdAt: created.createdAt,
        likeCount: 0,
        dislikeCount: 0,
        myReaction: null,
      }])
      setText('')
      setReplyTo(null)
      onCommentAdded()
    } catch (err) {
      console.error('[community] addComment failed:', err)
      setSendError(true)
    } finally {
      setSending(false)
    }
  }

  const react = async (comment: CommunityComment, reaction: 'like' | 'dislike') => {
    if (!currentUserId) { onRequireAuth(); return }
    const next = comment.myReaction === reaction ? null : reaction
    // Optimistic flip for instant feedback...
    setComments((cs) => cs.map((c) => {
      if (c.id !== comment.id) return c
      let likeCount = c.likeCount
      let dislikeCount = c.dislikeCount
      if (c.myReaction === 'like') likeCount -= 1
      if (c.myReaction === 'dislike') dislikeCount -= 1
      if (next === 'like') likeCount += 1
      if (next === 'dislike') dislikeCount += 1
      return { ...c, myReaction: next, likeCount, dislikeCount }
    }))
    try {
      await setCommentReaction(comment.id, currentUserId, next)
    } catch (err) {
      console.error('[community] setCommentReaction failed:', err)
    }
    // ...then reconcile with the server, same reasoning as the post like
    // button: a double click or a race can never leave the counts wrong.
    const [counts, mine] = await Promise.all([
      fetchCommentReactionCounts(comment.id),
      fetchMyCommentReaction(comment.id, currentUserId),
    ])
    setComments((cs) => cs.map((c) => (c.id === comment.id ? { ...c, ...counts, myReaction: mine } : c)))
  }

  const topLevel = comments.filter((c) => !c.parentId)
  const repliesOf = (id: string) => comments.filter((c) => c.parentId === id)

  const CommentRow = ({ comment, isReply, replyParentId }: { comment: CommunityComment; isReply: boolean; replyParentId: string }) => (
    <div className={`post-modal-comment-row${isReply ? ' post-modal-comment-row-reply' : ''}`}>
      <button type="button" className="post-modal-comment-avatar-btn" onClick={() => onOpenProfile(comment.authorId)}>
        <Avatar url={comment.authorAvatarUrl} name={comment.authorName} className="post-modal-comment-avatar" />
      </button>
      <div className="post-modal-comment-body">
        <p className="post-modal-comment-text">
          <button type="button" className="post-modal-comment-author-btn" onClick={() => onOpenProfile(comment.authorId)}>
            @{comment.authorName}
          </button>
          {' '}{comment.body}
        </p>
        <div className="post-modal-comment-actions">
          <button
            type="button"
            className={`post-modal-comment-action${comment.myReaction === 'like' ? ' post-modal-comment-action-active' : ''}`}
            onClick={() => react(comment, 'like')}
          >
            👍 {comment.likeCount}
          </button>
          <button
            type="button"
            className={`post-modal-comment-action${comment.myReaction === 'dislike' ? ' post-modal-comment-action-active' : ''}`}
            onClick={() => react(comment, 'dislike')}
          >
            👎 {comment.dislikeCount}
          </button>
          <button
            type="button"
            className="post-modal-comment-action"
            onClick={() => (currentUserId ? setReplyTo({ id: replyParentId, name: comment.authorName }) : onRequireAuth())}
          >
            {t('commentReply')}
          </button>
        </div>
      </div>
    </div>
  )

  return (
    <div className="welcome-overlay post-modal-overlay" onClick={onClose}>
      <div className="post-modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="post-modal-media sunk-in">
          {post.previewUrl
            ? <img className="post-modal-media-img" crossOrigin="anonymous" src={post.previewUrl} alt="" />
            : <span className="post-modal-media-placeholder">🖼</span>}
        </div>

        <div className="post-modal-sidebar">
          <div className="post-modal-header">
            <button type="button" className="post-modal-header-identity" onClick={() => onOpenProfile(post.authorId)}>
              <Avatar url={post.authorAvatarUrl} name={post.authorName} className="post-modal-header-avatar" />
              <span className="post-modal-header-name">@{post.authorName}</span>
            </button>
            <button type="button" className="post-modal-close" onClick={onClose}>✕</button>
          </div>

          <div className="post-modal-caption-row">
            <b>@{post.authorName}</b> {post.title}
          </div>
          <PostPresetChip post={post} className="post-modal-preset-chip" />

          <div className="post-modal-actions">
            <button
              className={`ig-action-btn${liked ? ' ig-action-btn-active' : ''}`}
              onClick={() => (currentUserId ? onToggleLike() : onRequireAuth())}
            >
              ♥ {post.likeCount}
            </button>
            <span className="ig-action-btn">💬 {loadingComments ? post.commentCount : comments.length}</span>
            <button type="button" className="ig-action-btn post-modal-share" onClick={share}>
              {linkCopied ? `✓ ${t('postLinkCopied')}` : `🔗 ${t('postShare')}`}
            </button>
          </div>

          <div className="post-modal-comments">
            {loadingComments && <p className="profile-empty-hint">{t('loading')}</p>}
            {!loadingComments && topLevel.length === 0 && <p className="profile-empty-hint">{t('commentsEmpty')}</p>}
            {topLevel.map((c) => (
              <div key={c.id}>
                <CommentRow comment={c} isReply={false} replyParentId={c.id} />
                {repliesOf(c.id).map((r) => (
                  <div key={r.id} className="post-modal-comment-reply-indent">
                    <CommentRow comment={r} isReply replyParentId={c.id} />
                  </div>
                ))}
              </div>
            ))}
          </div>

          {replyTo && (
            <div className="post-modal-reply-chip">
              <span>{t('commentReplyingTo')} @{replyTo.name}</span>
              <button type="button" onClick={() => setReplyTo(null)}>✕</button>
            </div>
          )}
          {sendError && <p className="onboarding-error post-modal-send-error">{t('commentSendFailed')}</p>}
          <div className="post-modal-composer">
            <input
              className="onboarding-input"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={currentUserId ? t('commentPlaceholder') : t('communityPublishHint')}
              maxLength={300}
              onKeyDown={(e) => { if (e.key === 'Enter') submitComment() }}
            />
            <button className="onboarding-submit post-modal-send" disabled={sending} onClick={submitComment}>
              {t('commentSend')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

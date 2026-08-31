import { useEffect, useMemo, useRef, useState } from 'react'
import { WinTitleBar } from '@/app/panels/WinTitleBar'
import { CommunityNav } from '@/app/panels/CommunityNav'
import { StatusBar } from '@/app/panels/StatusBar'
import { WindowHeader } from '@/app/panels/WindowHeader'
import { useT } from '@/i18n'
import { useRoute } from '@/state/route'
import { useAuth } from '@/state/auth'
import { isSupabaseConfigured } from '@/lib/supabase'
import { fetchFeedPosts, fetchLikedPostIds, likePost, unlikePost, isPostLiked, fetchLikeCount, createPost, fetchPostById, type CommunityPost } from '@/lib/community'
import { useToast } from '@/state/toast'
import { AuthWidget } from './community/AuthWidget'
import { NotificationsBell } from './community/NotificationsBell'
import { PublishModal } from './community/PublishModal'
import { PostModal } from './community/PostModal'
import { PostPresetChip } from './community/PostPresetChip'
import { MOCK_POSTS } from './community/mockData'

type SortMode = 'popular' | 'recent'

/**
 * Public feed — anyone can browse without signing in. Actions that write
 * data (publish, like, comment) are gated behind sign-in: clicking them
 * signed-out opens the AuthModal instead of doing the action.
 *
 * Card-grid layout (image, title, author, ♥/💬 counts) matching the
 * reference design, built entirely out of the editor's own XP-chrome
 * components so it reads as the same app.
 *
 * Real posts come from Supabase once configured; until then (or if the
 * `posts` table is empty) it falls back to the placeholder feed in
 * ./community/mockData.ts so the page never looks broken during setup.
 */
export function Community() {
  const t = useT()
  const closeWindow = useRoute((s) => s.closeWindow)
  const openProfile = useRoute((s) => s.openProfile)
  const openPostRoute = useRoute((s) => s.openPost)
  const closePostRoute = useRoute((s) => s.closePost)
  const openPostId = useRoute((s) => s.postId)
  const user = useAuth((s) => s.user)
  const currentProfile = useAuth((s) => s.profile)
  const openAuthModal = useAuth((s) => s.openAuthModal)
  const showToast = useToast((s) => s.show)

  const [posts, setPosts] = useState<CommunityPost[]>([])
  const [loadingFeed, setLoadingFeed] = useState(isSupabaseConfigured)
  const [publishOpen, setPublishOpen] = useState(false)
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set())
  // Posts opened via a direct `#/post/<id>` link (shared URL, `/p/<id>`)
  // that aren't among the ~30 most recent posts already loaded into the
  // feed — fetched on demand, keyed by id so switching between a couple of
  // deep-linked posts in one session doesn't re-fetch either.
  const [deepLinkedPosts, setDeepLinkedPosts] = useState<Record<string, CommunityPost>>({})
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<SortMode>('recent')

  const loadFeed = () => {
    if (!isSupabaseConfigured) return
    setLoadingFeed(true)
    fetchFeedPosts().then((data) => { setPosts(data); setLoadingFeed(false) })
  }

  useEffect(loadFeed, [])

  // Which posts the signed-in user has already liked — refetched whenever
  // the feed or the signed-in user changes.
  useEffect(() => {
    if (!user || posts.length === 0) { setLikedIds(new Set()); return }
    let cancelled = false
    fetchLikedPostIds(user.id, posts.map((p) => p.id)).then((ids) => { if (!cancelled) setLikedIds(ids) })
    return () => { cancelled = true }
  }, [user, posts])

  const requireAuth = (action: () => void) => {
    if (user) action()
    else openAuthModal()
  }

  const toggleLike = async (post: CommunityPost) => {
    if (!user) { openAuthModal(); return }
    const wasLiked = likedIds.has(post.id)
    // Optimistic flip for instant feedback...
    setLikedIds((s) => {
      const next = new Set(s)
      if (wasLiked) next.delete(post.id); else next.add(post.id)
      return next
    })
    setPosts((ps) => ps.map((p) => (p.id === post.id ? { ...p, likeCount: p.likeCount + (wasLiked ? -1 : 1) } : p)))
    try {
      if (wasLiked) await unlikePost(post.id, user.id)
      else await likePost(post.id, user.id, post.authorId)
    } catch (err) {
      console.error('[community] toggleLike failed:', err)
    }
    // ...then reconcile with the real numbers from the server, so a double
    // click, a race, or a like that already existed can never leave the
    // count wrong or negative.
    const [liked, count] = await Promise.all([isPostLiked(post.id, user.id), fetchLikeCount(post.id)])
    setLikedIds((s) => {
      const next = new Set(s)
      if (liked) next.add(post.id); else next.delete(post.id)
      return next
    })
    setPosts((ps) => ps.map((p) => (p.id === post.id ? { ...p, likeCount: count } : p)))
  }

  const handleCommentAdded = (postId: string) => {
    setPosts((ps) => ps.map((p) => (p.id === postId ? { ...p, commentCount: p.commentCount + 1 } : p)))
  }

  const usingMocks = !isSupabaseConfigured || (!loadingFeed && posts.length === 0)
  const feed = usingMocks ? MOCK_POSTS : posts
  const openPost = posts.find((p) => p.id === openPostId) ?? (openPostId ? deepLinkedPosts[openPostId] : undefined) ?? null

  // Latest `posts`/`deepLinkedPosts` for the effect below to read without
  // depending on them: the effect intentionally re-runs only when
  // `openPostId` changes or the feed goes from empty to loaded
  // (`posts.length`), not on every post mutation (a like or comment count
  // bump creates a new `posts` array but shouldn't re-trigger this fetch).
  const postsRef = useRef(posts)
  postsRef.current = posts
  const deepLinkedPostsRef = useRef(deepLinkedPosts)
  deepLinkedPostsRef.current = deepLinkedPosts

  // A `#/post/<id>` link (from a share URL) may point at a post that isn't
  // in the loaded feed at all — fetch it directly rather than showing
  // nothing just because it scrolled off the "30 most recent" list.
  useEffect(() => {
    if (!openPostId || !isSupabaseConfigured) return
    if (postsRef.current.some((p) => p.id === openPostId) || deepLinkedPostsRef.current[openPostId]) return
    let cancelled = false
    fetchPostById(openPostId).then((post) => {
      if (cancelled || !post) return
      setDeepLinkedPosts((d) => ({ ...d, [post.id]: post }))
    })
    return () => { cancelled = true }
  }, [openPostId, posts.length])

  const visibleFeed = useMemo(() => {
    const q = search.trim().toLowerCase()
    const filtered = q
      ? feed.filter((p) => {
          const author = 'authorName' in p ? p.authorName : p.author
          return p.title.toLowerCase().includes(q) || author.toLowerCase().includes(q)
        })
      : feed
    const sorted = [...filtered]
    if (sort === 'popular') {
      sorted.sort((a, b) => {
        const la = 'likeCount' in a ? a.likeCount : a.likes
        const lb = 'likeCount' in b ? b.likeCount : b.likes
        return lb - la
      })
    }
    return sorted
  }, [feed, search, sort])

  return (
    <div className="landing-window">
      <WinTitleBar />

      <WindowHeader title={t('communityTitle')} onBack={() => closeWindow('community')}>
        <NotificationsBell />
        <AuthWidget />
      </WindowHeader>

      <CommunityNav active="feed" search={search} onSearch={setSearch} />

      <div className="community-scroll">
        <div className="community-latest-row">
          <div>
            <h2 className="community-latest-title">{t('communityLatestTitle')}</h2>
            <p className="community-latest-subtitle">{t('communityLatestSubtitle')}</p>
          </div>
          <div className="community-latest-actions">
            <select className="select community-sort-select" value={sort} onChange={(ev) => setSort(ev.target.value as SortMode)}>
              <option value="recent">{t('sortRecent')}</option>
              <option value="popular">{t('sortPopular')}</option>
            </select>
            <button className="community-publish-btn" onClick={() => requireAuth(() => setPublishOpen(true))}>
              + {t('communityPublish')}
            </button>
          </div>
        </div>
        {!user && <p className="community-publish-hint community-publish-hint-row">{t('communityPublishHint')}</p>}

        {isSupabaseConfigured && loadingFeed && (
          <p className="profile-empty-hint">{t('loading')}</p>
        )}

        {usingMocks && isSupabaseConfigured && !loadingFeed && (
          <p className="profile-empty-hint">{t('communityNoPostsYet')}</p>
        )}

        <div className="feed-grid">
          {visibleFeed.map((post) => {
            const hasProfile = 'authorId' in post
            const author = hasProfile ? (post as CommunityPost).authorName : post.author
            const likeCount = hasProfile ? (post as CommunityPost).likeCount : post.likes
            const commentCount = hasProfile ? (post as CommunityPost).commentCount : post.commentCount
            return (
              <article key={post.id} className="feed-card raised-out">
                <button
                  type="button"
                  className="feed-card-preview sunk-in"
                  disabled={!hasProfile}
                  onClick={() => hasProfile && openPostRoute((post as CommunityPost).id)}
                >
                  {post.previewUrl
                    ? <img className="feed-card-preview-img" crossOrigin="anonymous" src={post.previewUrl} alt="" />
                    : '🖼'}
                </button>
                <div className="feed-card-body">
                  <p className="feed-card-title">{post.title}</p>
                  <button
                    type="button"
                    className="feed-card-author"
                    disabled={!hasProfile}
                    onClick={() => hasProfile && openProfile((post as CommunityPost).authorId)}
                  >
                    by {author}
                  </button>
                  <div className="feed-card-actions">
                    <button
                      className={`ig-action-btn${hasProfile && likedIds.has((post as CommunityPost).id) ? ' ig-action-btn-active' : ''}`}
                      onClick={() => hasProfile ? toggleLike(post as CommunityPost) : requireAuth(() => {})}
                    >
                      ♥ {likeCount}
                    </button>
                    <button
                      className="ig-action-btn"
                      onClick={() => hasProfile ? openPostRoute((post as CommunityPost).id) : requireAuth(() => {})}
                    >
                      💬 {commentCount}
                    </button>
                    {hasProfile && <PostPresetChip post={post as CommunityPost} className="feed-card-preset-chip" />}
                  </div>
                </div>
              </article>
            )
          })}
        </div>
      </div>

      <StatusBar />

      {publishOpen && user && (
        <PublishModal
          onClose={() => setPublishOpen(false)}
          onPublish={async (title, image) => {
            await createPost(user.id, title, image)
            setPublishOpen(false)
            loadFeed()
            showToast(t('toastPostPublished'))
          }}
        />
      )}

      {openPost && (
        <PostModal
          post={openPost}
          liked={likedIds.has(openPost.id)}
          currentUserId={user?.id ?? null}
          currentUserName={currentProfile?.displayName ?? null}
          currentUserAvatarUrl={currentProfile?.avatarUrl ?? null}
          onClose={closePostRoute}
          onToggleLike={() => toggleLike(openPost)}
          onRequireAuth={openAuthModal}
          onOpenProfile={(userId) => openProfile(userId)}
          onCommentAdded={() => handleCommentAdded(openPost.id)}
        />
      )}
    </div>
  )
}

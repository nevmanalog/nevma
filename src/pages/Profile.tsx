import { useEffect, useState } from 'react'
import { WinTitleBar } from '@/app/panels/WinTitleBar'
import { StatusBar } from '@/app/panels/StatusBar'
import { useT } from '@/i18n'
import { useRoute } from '@/state/route'
import { useAuth } from '@/state/auth'
import { isSupabaseConfigured } from '@/lib/supabase'
import {
  fetchProfile, fetchFollowCounts, fetchUserPosts, isFollowing as checkIsFollowing,
  follow, unfollow, deletePost, updatePostTitle, fetchLikedPostIds, likePost, unlikePost,
  isPostLiked, fetchLikeCount, type CommunityProfile, type CommunityPost,
} from '@/lib/community'
import { ProfileForm } from './community/ProfileForm'
import { EditPostModal } from './community/EditPostModal'
import { PostModal } from './community/PostModal'
import { useToast } from '@/state/toast'

type ProfileTab = 'posts' | 'presets' | 'collections' | 'liked'

export function Profile() {
  const t = useT()
  const navigate = useRoute((s) => s.navigate)
  const openProfile = useRoute((s) => s.openProfile)
  const profileId = useRoute((s) => s.profileId)
  const currentUser = useAuth((s) => s.user)
  const currentProfile = useAuth((s) => s.profile)
  const saveProfile = useAuth((s) => s.saveProfile)
  const openAuthModal = useAuth((s) => s.openAuthModal)
  const showToast = useToast((s) => s.show)

  const [profile, setProfile] = useState<CommunityProfile | null>(null)
  const [posts, setPosts] = useState<CommunityPost[]>([])
  const [counts, setCounts] = useState({ followers: 0, following: 0 })
  const [following, setFollowing] = useState(false)
  const [loading, setLoading] = useState(true)
  const [followBusy, setFollowBusy] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editingPost, setEditingPost] = useState<CommunityPost | null>(null)
  const [deletingPostId, setDeletingPostId] = useState<string | null>(null)
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set())
  const [openPostId, setOpenPostId] = useState<string | null>(null)
  const [tab, setTab] = useState<ProfileTab>('posts')

  const isOwnProfile = Boolean(currentUser && profileId && currentUser.id === profileId)

  useEffect(() => {
    if (!profileId) return
    let cancelled = false
    setLoading(true)
    setEditing(false)
    setTab('posts')
    Promise.all([
      fetchProfile(profileId),
      fetchFollowCounts(profileId),
      fetchUserPosts(profileId),
      currentUser && currentUser.id !== profileId ? checkIsFollowing(currentUser.id, profileId) : Promise.resolve(false),
    ]).then(([p, c, userPosts, isFollow]) => {
      if (cancelled) return
      setProfile(p)
      setCounts(c)
      setPosts(userPosts)
      setFollowing(isFollow)
      setLoading(false)
    })
    return () => { cancelled = true }
  }, [profileId, currentUser])

  useEffect(() => {
    if (!currentUser || posts.length === 0) { setLikedIds(new Set()); return }
    let cancelled = false
    fetchLikedPostIds(currentUser.id, posts.map((p) => p.id)).then((ids) => { if (!cancelled) setLikedIds(ids) })
    return () => { cancelled = true }
  }, [currentUser, posts])

  const toggleLike = async (post: CommunityPost) => {
    if (!currentUser) { openAuthModal(); return }
    const wasLiked = likedIds.has(post.id)
    setLikedIds((s) => {
      const next = new Set(s)
      if (wasLiked) next.delete(post.id); else next.add(post.id)
      return next
    })
    setPosts((ps) => ps.map((p) => (p.id === post.id ? { ...p, likeCount: p.likeCount + (wasLiked ? -1 : 1) } : p)))
    try {
      if (wasLiked) await unlikePost(post.id, currentUser.id)
      else await likePost(post.id, currentUser.id, post.authorId)
    } catch (err) {
      console.error('[community] toggleLike failed:', err)
    }
    const [liked, count] = await Promise.all([isPostLiked(post.id, currentUser.id), fetchLikeCount(post.id)])
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

  const openPost = posts.find((p) => p.id === openPostId) ?? null

  const handleDeletePost = async (post: CommunityPost) => {
    if (!currentUser || deletingPostId) return
    if (!window.confirm(t('postDeleteConfirm'))) return
    setDeletingPostId(post.id)
    try {
      await deletePost(post.id, currentUser.id)
      setPosts((p) => p.filter((x) => x.id !== post.id))
    } finally {
      setDeletingPostId(null)
    }
  }

  const toggleFollow = async () => {
    if (!currentUser) { openAuthModal(); return }
    if (!profileId || followBusy) return
    setFollowBusy(true)
    try {
      if (following) {
        await unfollow(currentUser.id, profileId)
        setFollowing(false)
        setCounts((c) => ({ ...c, followers: Math.max(0, c.followers - 1) }))
        showToast(t('toastUnfollowed').replace('{name}', profile?.displayName ?? ''))
      } else {
        await follow(currentUser.id, profileId)
        setFollowing(true)
        setCounts((c) => ({ ...c, followers: c.followers + 1 }))
        showToast(t('toastFollowed').replace('{name}', profile?.displayName ?? ''))
      }
    } finally {
      setFollowBusy(false)
    }
  }

  return (
    <div className="landing-window">
      <WinTitleBar />
      <div className="community-topbar">
        <button className="community-back" onClick={() => navigate('community')}>← {t('back')}</button>
        <h1 className="community-title">{t('profileTitle')}</h1>
        <button className="community-open-editor" onClick={() => navigate('editor')}>✂ {t('openEditor')}</button>
      </div>

      <div className="community-scroll">
        {!isSupabaseConfigured && (
          <p className="profile-empty-hint">{t('authNotConfiguredHint')}</p>
        )}

        {isSupabaseConfigured && loading && <p className="profile-empty-hint">{t('loading')}</p>}

        {isSupabaseConfigured && !loading && !profile && (
          <p className="profile-empty-hint">{t('profileNotFound')}</p>
        )}

        {isSupabaseConfigured && !loading && profile && (
          <div className="profile-page">
            <div className="profile-header raised-out">
              {profile.avatarUrl
                ? <img className="profile-avatar" crossOrigin="anonymous" src={profile.avatarUrl} alt="" />
                : <div className="profile-avatar sunk-in profile-avatar-fallback">{profile.displayName[0]?.toUpperCase()}</div>}

              <div className="profile-header-main">
                <h2 className="profile-name">{profile.displayName}</h2>
                <p className="profile-handle">@{profile.displayName}</p>

                <div className="profile-counts">
                  <span><b>{posts.length}</b> {t('profilePosts')}</span>
                  <span><b>{counts.followers}</b> {t('profileFollowers')}</span>
                  <span><b>{counts.following}</b> {t('profileFollowing')}</span>
                </div>

                {isOwnProfile ? (
                  <button className="profile-edit-btn" onClick={() => setEditing((v) => !v)}>
                    {editing ? t('cancel') : t('profileEdit')}
                  </button>
                ) : (
                  <button
                    className={`profile-follow-btn${following ? ' is-following' : ''}`}
                    disabled={followBusy}
                    onClick={toggleFollow}
                  >
                    {following ? t('profileUnfollow') : t('profileFollow')}
                  </button>
                )}
              </div>
            </div>

            {isOwnProfile && editing && (
              <div className="profile-edit-form raised-out">
                <ProfileForm
                  userId={currentUser?.id ?? ''}
                  initialName={currentProfile?.displayName ?? ''}
                  initialAvatarUrl={currentProfile?.avatarUrl ?? null}
                  submitLabel={t('save')}
                  onCancel={() => setEditing(false)}
                  onSubmit={async (input) => {
                    await saveProfile(input)
                    setProfile((p) => (p ? { ...p, displayName: input.displayName, avatarUrl: input.avatarUrl } : p))
                    setEditing(false)
                  }}
                />
              </div>
            )}

            <div className="profile-tabs">
              {(['posts', 'presets', 'collections', 'liked'] as ProfileTab[]).map((id) => (
                <button
                  key={id}
                  className={`profile-tab${tab === id ? ' profile-tab-active' : ''}${id === 'posts' ? '' : ' profile-tab-locked'}`}
                  title={id === 'posts' ? undefined : t('navComingSoon')}
                  onClick={() => setTab(id)}
                >
                  {t(id === 'posts' ? 'profileTabPosts' : id === 'presets' ? 'profileTabPresets' : id === 'collections' ? 'profileTabCollections' : 'profileTabLiked')}
                  {id !== 'posts' && <span className="profile-tab-lock">🔒</span>}
                </button>
              ))}
            </div>

            {tab === 'posts' && (
              <div className="profile-posts-grid">
                {posts.length === 0 && <p className="profile-empty-hint">{t('profileNoPosts')}</p>}
                {posts.map((post) => (
                  <div key={post.id} className="profile-post-card raised-out">
                    <div
                      className="profile-post-tile sunk-in"
                      title={post.title}
                      onClick={() => setOpenPostId(post.id)}
                    >
                      {post.previewUrl
                        ? <img className="profile-post-tile-img" crossOrigin="anonymous" src={post.previewUrl} alt="" />
                        : '🖼'}
                      {isOwnProfile && (
                        <div className="profile-post-tile-actions" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            className="profile-post-tile-action"
                            title={t('postEditTitle')}
                            onClick={() => setEditingPost(post)}
                          >✎</button>
                          <button
                            type="button"
                            className="profile-post-tile-action"
                            disabled={deletingPostId === post.id}
                            title={t('postDelete')}
                            onClick={() => handleDeletePost(post)}
                          >✕</button>
                        </div>
                      )}
                    </div>
                    <p className="profile-post-title">{post.title}</p>
                    <div className="feed-card-actions">
                      <span className="ig-action-btn">♥ {post.likeCount}</span>
                      <span className="ig-action-btn">💬 {post.commentCount}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {tab !== 'posts' && (
              <p className="profile-empty-hint">{t('navComingSoon')}</p>
            )}
          </div>
        )}
      </div>

      <StatusBar />

      {editingPost && currentUser && (
        <EditPostModal
          initialTitle={editingPost.title}
          onClose={() => setEditingPost(null)}
          onSave={async (title) => {
            await updatePostTitle(editingPost.id, currentUser.id, title)
            setPosts((p) => p.map((x) => (x.id === editingPost.id ? { ...x, title } : x)))
            setEditingPost(null)
          }}
        />
      )}

      {openPost && (
        <PostModal
          post={openPost}
          liked={likedIds.has(openPost.id)}
          currentUserId={currentUser?.id ?? null}
          currentUserName={currentProfile?.displayName ?? null}
          currentUserAvatarUrl={currentProfile?.avatarUrl ?? null}
          onClose={() => setOpenPostId(null)}
          onToggleLike={() => toggleLike(openPost)}
          onRequireAuth={openAuthModal}
          onOpenProfile={(userId) => { setOpenPostId(null); openProfile(userId) }}
          onCommentAdded={() => handleCommentAdded(openPost.id)}
        />
      )}
    </div>
  )
}

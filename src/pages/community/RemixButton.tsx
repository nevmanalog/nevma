import { useState, type MouseEvent } from 'react'
import { useT } from '@/i18n'
import { useToast } from '@/state/toast'
import { remixPost } from './remix'
import type { CommunityPost } from '@/lib/community'

/** "Сделать свою версию" — loads this post's image into a fresh layer in
 *  the editor so the viewer can rework it themselves, the way a duet/stitch
 *  works for video. Sits next to PostPresetChip in both the feed card and
 *  the post modal; unlike the preset chip (which copies settings onto the
 *  viewer's own photo) this brings in the photo itself. Renders nothing for
 *  posts with no image at all (caption-only posts published without a
 *  picture) since there'd be nothing to remix. */
export function RemixButton({ post, className }: { post: CommunityPost; className?: string }) {
  const t = useT()
  const showToast = useToast((s) => s.show)
  const [loading, setLoading] = useState(false)
  if (!post.previewUrl && !post.fullUrl) return null

  const onClick = (e: MouseEvent) => {
    e.stopPropagation()
    if (loading) return
    setLoading(true)
    remixPost(
      post,
      () => setLoading(false),
      (err) => {
        console.error(err)
        setLoading(false)
        showToast(t('remixFailed'))
      },
    )
  }

  return (
    <button
      type="button"
      className={`ig-action-btn${className ? ` ${className}` : ''}`}
      title={t('remixHint')}
      disabled={loading}
      onClick={onClick}
    >
      🎛 {loading ? t('remixLoading') : t('remix')}
    </button>
  )
}

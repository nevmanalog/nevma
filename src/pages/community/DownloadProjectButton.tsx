import { useState, type MouseEvent } from 'react'
import { useT } from '@/i18n'
import { useToast } from '@/state/toast'
import { triggerDownload } from '@/shared/zip'
import type { CommunityPost } from '@/lib/community'

/** Turns a post title into a safe-ish filename fragment — same idea as the
 *  editor's own project-save naming, just inlined since it's one line. */
function safeFilename(title: string): string {
  const trimmed = title.trim().replace(/[\\/:*?"<>|]+/g, '_')
  return trimmed || 'project'
}

/** "Скачать проект" — downloads the exact project file this post was
 *  published with (see engine/project.ts's serializePostProjectSnapshot),
 *  which anyone can then load back with the editor's own "Открыть проект"
 *  button to get an editable copy laid out exactly like the author's
 *  original. Sits next to PostPresetChip in both the feed card and the post
 *  modal; unlike the preset chip (which copies processing settings onto the
 *  viewer's own photo) this hands over the actual project.
 *
 *  Renders nothing for posts with no saved project — published before this
 *  existed, or from the Community page's caption-only flow, which has no
 *  editor state to capture — since there'd be nothing to download. */
export function DownloadProjectButton({ post, className }: { post: CommunityPost; className?: string }) {
  const t = useT()
  const showToast = useToast((s) => s.show)
  const [loading, setLoading] = useState(false)
  if (!post.projectUrl) return null

  const onClick = async (e: MouseEvent) => {
    e.stopPropagation()
    if (loading) return
    setLoading(true)
    try {
      const res = await fetch(post.projectUrl!)
      if (!res.ok) throw new Error(`Fetch failed: ${res.status}`)
      const blob = await res.blob()
      triggerDownload(blob, `${safeFilename(post.title)}.nevma`)
    } catch (err) {
      console.error(err)
      showToast(t('downloadProjectFailed'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      type="button"
      className={`ig-action-btn${className ? ` ${className}` : ''}`}
      title={t('downloadProjectHint')}
      disabled={loading}
      onClick={onClick}
    >
      💾 <span className="action-btn-label">{loading ? t('downloadingProject') : t('downloadProject')}</span>
    </button>
  )
}

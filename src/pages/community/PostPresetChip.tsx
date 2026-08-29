import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useT } from '@/i18n'
import { importPostPreset, goToPresetInEditor } from './presetImport'
import type { CommunityPost } from '@/lib/community'

/** The "id обработки" badge: a short code under a post that carries a
 *  reusable processing preset (paper/printer/damage/scanner settings, not
 *  just the pixels). Clicking it saves that exact processing into the
 *  viewer's own editor, named after the work and its author, then shows a
 *  confirmation with a "Go to editor" button — which lands directly on the
 *  Final tab, where the preset is ready to apply. Renders nothing for posts
 *  published without a preset attached (e.g. from the Community page's
 *  caption-only flow). */
export function PostPresetChip({ post, className }: { post: CommunityPost; className?: string }) {
  const t = useT()
  const [saved, setSaved] = useState(false)
  if (!post.presetData) return null
  const shortId = post.id.replace(/-/g, '').slice(0, 6).toUpperCase()

  return (
    <>
      <button
        type="button"
        className={`post-preset-chip${className ? ` ${className}` : ''}`}
        title={t('presetChipHint')}
        onClick={(e) => { e.stopPropagation(); importPostPreset(post); setSaved(true) }}
      >
        ⚙ #{shortId}
      </button>

      {saved && createPortal(
        <div className="welcome-overlay" onClick={() => setSaved(false)}>
          <div className="np-card onboarding-card" onClick={(e) => e.stopPropagation()}>
            <h2>{t('presetSavedTitle')}</h2>
            <p className="onboarding-body">{t('presetSavedBody')}</p>
            <div className="onboarding-actions">
              <button className="onboarding-cancel" onClick={() => setSaved(false)}>{t('cancel')}</button>
              <button className="onboarding-submit" onClick={goToPresetInEditor}>{t('presetSavedGo')}</button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  )
}

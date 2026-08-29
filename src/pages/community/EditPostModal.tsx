import { useState } from 'react'
import { useT } from '@/i18n'

interface Props {
  initialTitle: string
  onClose: () => void
  onSave: (title: string) => Promise<void>
}

/** Caption-only editor for an already-published post. Mirrors PublishModal's
 *  shape (same overlay/card chrome) but has nothing to say about the image —
 *  posts don't support re-attaching a different picture after the fact. */
export function EditPostModal({ initialTitle, onClose, onSave }: Props) {
  const t = useT()
  const [title, setTitle] = useState(initialTitle)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async () => {
    const trimmed = title.trim()
    if (!trimmed) { setError(t('publishTitleRequired')); return }
    setSaving(true)
    setError(null)
    try {
      await onSave(trimmed)
    } catch {
      setError(t('onboardingSaveFailed'))
      setSaving(false)
    }
  }

  return (
    <div className="welcome-overlay">
      <div className="np-card onboarding-card">
        <h2>{t('postEditTitle')}</h2>
        <input
          className="onboarding-input publish-input"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={t('publishPlaceholder')}
          maxLength={80}
          autoFocus
        />
        {error && <p className="onboarding-error">{error}</p>}
        <div className="onboarding-actions">
          <button className="onboarding-cancel" disabled={saving} onClick={onClose}>{t('cancel')}</button>
          <button className="onboarding-submit" disabled={saving} onClick={submit}>
            {saving ? t('saving') : t('save')}
          </button>
        </div>
      </div>
    </div>
  )
}

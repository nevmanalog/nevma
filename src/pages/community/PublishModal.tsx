import { useState } from 'react'
import { useT } from '@/i18n'

interface Props {
  onClose: () => void
  onPublish: (title: string, image: Blob | null) => Promise<void>
  /** Rendered composition from the editor's Final tab, shown as a preview
   *  and used as-is. Omitted when publishing from the Community page,
   *  which has no canvas to render from — there the person picks a file
   *  themselves via the picker below instead. */
  previewBlob?: Blob | null
}

/** Caption + image. When opened with a `previewBlob` (from the editor's
 *  Final tab) the image is already decided and just shown as a preview;
 *  otherwise (opened from the Community feed) a file picker lets the
 *  person choose an image from their device before publishing. */
export function PublishModal({ onClose, onPublish, previewBlob }: Props) {
  const t = useT()
  const [title, setTitle] = useState('')
  const [pickedFile, setPickedFile] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(() => (previewBlob ? URL.createObjectURL(previewBlob) : null))
  const canPickImage = !previewBlob

  const onPickFile = (file: File | null) => {
    setPickedFile(file)
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev)
      return file ? URL.createObjectURL(file) : null
    })
  }

  const submit = async () => {
    const trimmed = title.trim()
    if (!trimmed) { setError(t('publishTitleRequired')); return }
    setSaving(true)
    setError(null)
    try {
      await onPublish(trimmed, previewBlob ?? pickedFile ?? null)
    } catch {
      setError(t('onboardingSaveFailed'))
      setSaving(false)
    }
  }

  return (
    <div className="welcome-overlay">
      <div className="np-card onboarding-card">
        <h2>{t('publishTitle')}</h2>

        {canPickImage ? (
          <label className="publish-preview-wrap publish-preview-picker">
            {previewUrl
              ? <img className="publish-preview-thumb" src={previewUrl} alt="" />
              : <span className="publish-preview-picker-hint">🖼 {t('publishPickImage')}</span>}
            <input
              type="file"
              accept="image/*"
              className="publish-file-input"
              onChange={(e) => onPickFile(e.target.files?.[0] ?? null)}
            />
          </label>
        ) : previewUrl && (
          <div className="publish-preview-wrap">
            <img className="publish-preview-thumb" src={previewUrl} alt="" />
          </div>
        )}

        <p className="onboarding-body">{previewUrl ? t('publishBody') : t('publishBodyNoImage')}</p>
        <input
          className="onboarding-input publish-input"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={t('publishPlaceholder')}
          maxLength={80}
        />
        {error && <p className="onboarding-error">{error}</p>}
        <div className="onboarding-actions">
          <button className="onboarding-cancel" disabled={saving} onClick={onClose}>{t('cancel')}</button>
          <button className="onboarding-submit" disabled={saving} onClick={submit}>
            {saving ? t('saving') : t('publishSubmit')}
          </button>
        </div>
      </div>
    </div>
  )
}

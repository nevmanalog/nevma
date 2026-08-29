import { useRef, useState } from 'react'
import { useT } from '@/i18n'
import { uploadCroppedAvatar, AvatarImageError } from '@/lib/avatar'
import { validateAvatarFile } from '@/shared/avatarImage'
import { AvatarCropModal } from './AvatarCropModal'

interface Props {
  userId: string
  initialName: string
  initialAvatarUrl: string | null
  submitLabel: string
  onSubmit: (input: { displayName: string; avatarUrl: string | null }) => Promise<void>
  onCancel?: () => void
}

/** The nickname + avatar editor itself, with no opinion on the title/body
 *  text or overlay around it — the onboarding modal and the "edit profile"
 *  modal each wrap this with their own copy.
 *
 *  Avatar picking uploads immediately on file selection (not deferred to
 *  submit): the preview swaps from the local blob URL to the real Storage
 *  URL as soon as the upload finishes, so what's shown while editing always
 *  matches what submit will actually save. */
export function ProfileForm({ userId, initialName, initialAvatarUrl, submitLabel, onSubmit, onCancel }: Props) {
  const t = useT()
  const [displayName, setDisplayName] = useState(initialName)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(initialAvatarUrl)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(initialAvatarUrl)
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pickedFile, setPickedFile] = useState<File | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  // Tracks the blob: URL from the local preview so it can be revoked once
  // the real upload finishes — otherwise each picked file leaks a URL.
  const localPreviewUrl = useRef<string | null>(null)

  const pickAvatar = () => fileInput.current?.click()

  const onFileChosen = (file: File | undefined) => {
    if (!file) return
    setError(null)
    try {
      validateAvatarFile(file)
      setPickedFile(file) // opens AvatarCropModal below
    } catch (err) {
      if (err instanceof AvatarImageError) {
        setError(err.message === 'too-large' ? t('onboardingAvatarTooLarge') : t('onboardingAvatarInvalidType'))
      } else {
        setError(t('onboardingAvatarUploadFailed'))
      }
    } finally {
      if (fileInput.current) fileInput.current.value = ''
    }
  }

  const onCropConfirm = async (croppedBlob: Blob) => {
    setPickedFile(null)

    // Show it immediately — the upload can take a second or two, and
    // nothing here should feel like it stalled.
    const preview = URL.createObjectURL(croppedBlob)
    if (localPreviewUrl.current) URL.revokeObjectURL(localPreviewUrl.current)
    localPreviewUrl.current = preview
    setAvatarPreview(preview)
    setUploading(true)

    try {
      const url = await uploadCroppedAvatar(userId, croppedBlob)
      setAvatarUrl(url)
      setAvatarPreview(url)
    } catch {
      // Fall back to whatever avatar was set before this attempt — don't
      // leave the preview pointing at a blob: URL that stops working the
      // moment the tab reloads.
      setAvatarPreview(avatarUrl)
      setError(t('onboardingAvatarUploadFailed'))
    } finally {
      setUploading(false)
    }
  }

  const removeAvatar = () => {
    if (localPreviewUrl.current) { URL.revokeObjectURL(localPreviewUrl.current); localPreviewUrl.current = null }
    setAvatarUrl(null)
    setAvatarPreview(null)
  }

  const submit = async () => {
    const trimmed = displayName.trim()
    if (!trimmed) { setError(t('onboardingNicknameRequired')); return }
    if (uploading) return // avatar upload still in flight — avatarUrl isn't final yet
    setSaving(true)
    setError(null)
    try {
      await onSubmit({ displayName: trimmed, avatarUrl })
    } catch {
      setError(t('onboardingSaveFailed'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <div className="onboarding-avatar-row">
        <div className="onboarding-avatar-pick">
          <button
            type="button"
            className="onboarding-avatar-btn"
            onClick={pickAvatar}
            disabled={uploading}
            title={t('onboardingAvatarChange')}
          >
            {avatarPreview
              ? <img className="onboarding-avatar" crossOrigin="anonymous" src={avatarPreview} alt="" />
              : <span className="onboarding-avatar onboarding-avatar-fallback sunk-in">{displayName[0]?.toUpperCase() ?? '?'}</span>}
            <span className="onboarding-avatar-overlay">{uploading ? '…' : t('onboardingAvatarChange')}</span>
          </button>
          {avatarUrl && !uploading && (
            <button type="button" className="onboarding-avatar-remove" onClick={removeAvatar} title={t('onboardingAvatarRemove')}>×</button>
          )}
          <input
            ref={fileInput}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="onboarding-avatar-file-input"
            onChange={(e) => onFileChosen(e.target.files?.[0])}
          />
        </div>
        <input
          className="onboarding-input"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder={t('onboardingNicknamePlaceholder')}
          maxLength={32}
        />
      </div>
      {error && <p className="onboarding-error">{error}</p>}
      <div className="onboarding-actions">
        {onCancel && <button className="onboarding-cancel" disabled={saving} onClick={onCancel}>{t('cancel')}</button>}
        <button className="onboarding-submit" disabled={saving || uploading} onClick={submit}>
          {saving ? t('saving') : submitLabel}
        </button>
      </div>

      {pickedFile && (
        <AvatarCropModal
          file={pickedFile}
          onCancel={() => setPickedFile(null)}
          onConfirm={onCropConfirm}
        />
      )}
    </>
  )
}

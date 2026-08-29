import { useEffect, useMemo, useRef, useState } from 'react'
import { useT } from '@/i18n'
import { loadAvatarImage, cropAvatarToBlob, AvatarImageError } from '@/shared/avatarImage'

interface Props {
  file: File
  onCancel: () => void
  onConfirm: (blob: Blob) => void
}

const VIEWPORT = 260 // px, the circular crop window on screen
const MIN_ZOOM = 1
const MAX_ZOOM = 3

/**
 * Drag-to-reposition + zoom avatar cropper, the same interaction pattern as
 * Instagram/Twitter/etc's avatar picker: a fixed circular window, the photo
 * underneath pannable and zoomable, framing decided before anything uploads.
 *
 * All position/zoom math works in two coordinate spaces: "display" px (CSS
 * pixels inside the VIEWPORT-sized window) and "natural" px (the source
 * image's own pixel grid, what cropAvatarToBlob needs). `coverScale` is the
 * display-px-per-natural-px factor at zoom = 1, i.e. the scale at which the
 * image's shorter side exactly fills the viewport (like `object-fit: cover`).
 */
export function AvatarCropModal({ file, onCancel, onConfirm }: Props) {
  const t = useT()
  const [img, setImg] = useState<HTMLImageElement | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [zoom, setZoom] = useState(MIN_ZOOM)
  const [offset, setOffset] = useState({ x: 0, y: 0 }) // display px, image top-left relative to viewport top-left
  const [saving, setSaving] = useState(false)
  const objectUrl = useRef<string | null>(null)
  const dragState = useRef<{ startX: number; startY: number; startOffset: { x: number; y: number } } | null>(null)

  useEffect(() => {
    let cancelled = false
    loadAvatarImage(file).then(
      ({ img, url }) => {
        if (cancelled) { URL.revokeObjectURL(url); return }
        objectUrl.current = url
        setImg(img)
      },
      (err) => {
        if (cancelled) return
        setError(err instanceof AvatarImageError && err.message === 'too-large' ? t('onboardingAvatarTooLarge') : t('onboardingAvatarInvalidType'))
      },
    )
    return () => {
      cancelled = true
      if (objectUrl.current) URL.revokeObjectURL(objectUrl.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file])

  const coverScale = useMemo(() => (img ? VIEWPORT / Math.min(img.naturalWidth, img.naturalHeight) : 1), [img])

  const clamp = (o: { x: number; y: number }, z: number) => {
    if (!img) return o
    const dispW = img.naturalWidth * coverScale * z
    const dispH = img.naturalHeight * coverScale * z
    return {
      x: Math.min(0, Math.max(VIEWPORT - dispW, o.x)),
      y: Math.min(0, Math.max(VIEWPORT - dispH, o.y)),
    }
  }

  // Initial centering, once the image is decoded and coverScale is known.
  useEffect(() => {
    if (!img) return
    const dispW = img.naturalWidth * coverScale
    const dispH = img.naturalHeight * coverScale
    setOffset({ x: (VIEWPORT - dispW) / 2, y: (VIEWPORT - dispH) / 2 })
  }, [img, coverScale])

  const onZoomChange = (nextZoom: number) => {
    // Keep whatever image point is currently at the viewport's center still
    // at the center after the zoom changes, instead of re-centering the
    // whole image and losing the person's framing.
    const scaleBefore = coverScale * zoom
    const scaleAfter = coverScale * nextZoom
    const cx = (VIEWPORT / 2 - offset.x) / scaleBefore
    const cy = (VIEWPORT / 2 - offset.y) / scaleBefore
    const next = { x: VIEWPORT / 2 - cx * scaleAfter, y: VIEWPORT / 2 - cy * scaleAfter }
    setZoom(nextZoom)
    setOffset(clamp(next, nextZoom))
  }

  const onPointerDown = (e: React.PointerEvent) => {
    if (!img) return
    e.currentTarget.setPointerCapture(e.pointerId)
    dragState.current = { startX: e.clientX, startY: e.clientY, startOffset: offset }
  }
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragState.current) return
    const dx = e.clientX - dragState.current.startX
    const dy = e.clientY - dragState.current.startY
    setOffset(clamp({ x: dragState.current.startOffset.x + dx, y: dragState.current.startOffset.y + dy }, zoom))
  }
  const onPointerUp = () => { dragState.current = null }

  const confirm = async () => {
    if (!img || saving) return
    setSaving(true)
    const scale = coverScale * zoom
    const sourceSize = VIEWPORT / scale
    const sx = -offset.x / scale
    const sy = -offset.y / scale
    try {
      const blob = await cropAvatarToBlob(img, sx, sy, sourceSize)
      onConfirm(blob)
    } catch {
      setError(t('onboardingAvatarUploadFailed'))
      setSaving(false)
    }
  }

  return (
    <div className="welcome-overlay">
      <div className="np-card onboarding-card avatar-crop-card">
        <h2>{t('avatarCropTitle')}</h2>
        <p className="onboarding-body">{t('avatarCropBody')}</p>

        {error && <p className="onboarding-error">{error}</p>}

        {img && (
          <>
            <div
              className="avatar-crop-viewport"
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
            >
              <img
                className="avatar-crop-img"
                src={objectUrl.current ?? ''}
                alt=""
                draggable={false}
                style={{
                  width: img.naturalWidth * coverScale * zoom,
                  height: img.naturalHeight * coverScale * zoom,
                  transform: `translate(${offset.x}px, ${offset.y}px)`,
                }}
              />
            </div>

            <div className="avatar-crop-zoom-row">
              <span className="avatar-crop-zoom-icon">－</span>
              <input
                type="range"
                min={MIN_ZOOM}
                max={MAX_ZOOM}
                step={0.01}
                value={zoom}
                onChange={(e) => onZoomChange(Number(e.target.value))}
                className="avatar-crop-zoom-slider"
              />
              <span className="avatar-crop-zoom-icon">＋</span>
            </div>
          </>
        )}

        <div className="onboarding-actions">
          <button className="onboarding-cancel" disabled={saving} onClick={onCancel}>{t('cancel')}</button>
          <button className="onboarding-submit" disabled={!img || saving} onClick={confirm}>
            {saving ? t('saving') : t('avatarCropConfirm')}
          </button>
        </div>
      </div>
    </div>
  )
}

// Turns a raw picked file into something reasonable to use as an avatar:
// center-cropped to a square (so it always renders correctly in the round
// avatar frames used throughout the app) and capped to a sane pixel size and
// file size before it ever reaches the network. Phone photos routinely come
// in at 12+ MP — uploading that straight through would waste the person's
// upload bandwidth and Supabase Storage quota for a picture that only ever
// renders at a few dozen pixels across.

const AVATAR_SIZE = 480 // output is always AVATAR_SIZE x AVATAR_SIZE
const JPEG_QUALITY = 0.87

export const MAX_SOURCE_FILE_BYTES = 15 * 1024 * 1024 // 15MB, before cropping/compression

export class AvatarImageError extends Error {}

/** Type/size checks shared by both the auto-crop path below and the
 *  user-driven cropper (AvatarCropModal) — run this before ever decoding
 *  the file so a bad pick fails fast with the same errors either way. */
export function validateAvatarFile(file: File): void {
  if (!file.type.startsWith('image/')) throw new AvatarImageError('not-an-image')
  if (file.size > MAX_SOURCE_FILE_BYTES) throw new AvatarImageError('too-large')
}

/** Decodes `file` into an <img>, already loaded — used by the cropper to
 *  get natural dimensions for its drag/zoom math before the person has
 *  picked a crop at all. Caller owns revoking the object URL (attached as
 *  `.dataset.objectUrl` isn't reliable across browsers, so it's returned
 *  alongside the element instead). */
export function loadAvatarImage(file: File): Promise<{ img: HTMLImageElement; url: string }> {
  validateAvatarFile(file)
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => resolve({ img, url })
    img.onerror = () => { URL.revokeObjectURL(url); reject(new AvatarImageError('decode-failed')) }
    img.src = url
  })
}

/** Crops `img` to the given square region (in the image's own natural
 *  pixel coordinates — same units as naturalWidth/naturalHeight) and
 *  encodes it exactly like fileToAvatarBlob does: AVATAR_SIZE JPEG. This is
 *  what AvatarCropModal calls once the person has dragged/zoomed to the
 *  framing they want; `sourceSize` is the crop square's side length,
 *  `sx`/`sy` its top-left corner. */
export function cropAvatarToBlob(img: HTMLImageElement, sx: number, sy: number, sourceSize: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas')
    canvas.width = AVATAR_SIZE
    canvas.height = AVATAR_SIZE
    const ctx = canvas.getContext('2d')
    if (!ctx) { reject(new AvatarImageError('no-canvas-context')); return }
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(img, sx, sy, sourceSize, sourceSize, 0, 0, AVATAR_SIZE, AVATAR_SIZE)
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new AvatarImageError('encode-failed'))),
      'image/jpeg', JPEG_QUALITY,
    )
  })
}

/**
 * Decode `file`, center-crop to a square, downscale to AVATAR_SIZE, and
 * encode as JPEG. Rejects with AvatarImageError for anything that isn't a
 * readable image (wrong type, corrupt file, etc).
 *
 * Kept around as the non-interactive fallback (used nowhere in the app UI
 * right now — avatar picking goes through AvatarCropModal instead — but
 * handy for anything scripted/automated that needs "just give me a square
 * avatar" without a person to drag a crop box).
 */
export function fileToAvatarBlob(file: File): Promise<Blob> {
  if (!file.type.startsWith('image/')) {
    return Promise.reject(new AvatarImageError('not-an-image'))
  }
  if (file.size > MAX_SOURCE_FILE_BYTES) {
    return Promise.reject(new AvatarImageError('too-large'))
  }

  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()

    img.onload = () => {
      URL.revokeObjectURL(url)
      const side = Math.min(img.naturalWidth, img.naturalHeight)
      if (side <= 0) { reject(new AvatarImageError('empty-image')); return }
      const sx = (img.naturalWidth - side) / 2
      const sy = (img.naturalHeight - side) / 2
      cropAvatarToBlob(img, sx, sy, side).then(resolve, reject)
    }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new AvatarImageError('decode-failed')) }
    img.src = url
  })
}

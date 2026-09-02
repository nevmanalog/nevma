// Every "pick an image" entry point in the app funnels through here.
//
// Modern phone cameras hand over 12-48MP photos (4000x3000px and up). Fed
// straight into the pipeline, that single source image gets re-decoded into a
// WebGL texture, cached at multiple stages, and kept around for undo/redo —
// several copies of tens of megabytes each. Desktops shrug that off; mobile
// Safari/Chrome do not, and when a phone runs out of memory the browser just
// silently reloads the tab, which looks exactly like "the site refreshes
// itself when I upload a photo". Capping the longest side here removes that
// failure mode without the person needing to pre-resize anything themselves.
const MAX_DIMENSION = 3000

export type ImageSource = HTMLImageElement | HTMLCanvasElement

/** Decodes an already-fetched Blob/File into an image source, downscaling
 *  first if it exceeds MAX_DIMENSION on its longest side. Always releases
 *  the temporary object URL it creates. Shared by loadImageFile (local
 *  picker) and loadImageFromUrl (remixing a community post's image) so
 *  the size cap and downscaling logic can't drift between the two. */
function decodeImageBlob(
  blob: Blob,
  onImage: (source: ImageSource, width: number, height: number) => void,
  onError?: (err: unknown) => void,
) {
  const url = URL.createObjectURL(blob)
  const img = new Image()
  img.onload = () => {
    const w = img.naturalWidth
    const h = img.naturalHeight
    const longest = Math.max(w, h)
    if (longest <= MAX_DIMENSION || longest === 0) {
      onImage(img, w, h)
      URL.revokeObjectURL(url)
      return
    }
    const scale = MAX_DIMENSION / longest
    const dw = Math.max(1, Math.round(w * scale))
    const dh = Math.max(1, Math.round(h * scale))
    const canvas = document.createElement('canvas')
    canvas.width = dw
    canvas.height = dh
    const ctx = canvas.getContext('2d')
    if (!ctx) { onImage(img, w, h); URL.revokeObjectURL(url); return }
    ctx.drawImage(img, 0, 0, dw, dh)
    onImage(canvas, dw, dh)
    URL.revokeObjectURL(url)
  }
  img.onerror = (err) => { URL.revokeObjectURL(url); onError?.(err) }
  img.src = url
}

/**
 * Decode `file` and hand back an image source ready to hand to
 * `addImageLayer`, downscaling first if it exceeds MAX_DIMENSION on its
 * longest side. Always releases the temporary object URL it creates.
 */
export function loadImageFile(
  file: File,
  onImage: (source: ImageSource, width: number, height: number) => void,
  onError?: (err: unknown) => void,
) {
  decodeImageBlob(file, onImage, onError)
}

/**
 * Same as `loadImageFile`, but starting from a URL instead of a local File —
 * used to remix a community post's image (see pages/community/remix.ts).
 * Fetches the bytes first rather than pointing an <img> straight at the
 * (cross-origin, Supabase Storage) URL: an <img> loaded cross-origin
 * without the right CORS headers taints any <canvas> it's later drawn
 * into, which breaks everything downstream that reads pixels back out
 * (the whole physical-tool pipeline). Decoding from a same-origin blob: URL
 * instead, after fetching the bytes ourselves, avoids that regardless of
 * how the origin's CORS is configured.
 */
export function loadImageFromUrl(
  url: string,
  onImage: (source: ImageSource, width: number, height: number) => void,
  onError?: (err: unknown) => void,
) {
  fetch(url)
    .then((res) => {
      if (!res.ok) throw new Error(`Fetch failed: ${res.status}`)
      return res.blob()
    })
    .then((blob) => decodeImageBlob(blob, onImage, onError))
    .catch((err) => onError?.(err))
}

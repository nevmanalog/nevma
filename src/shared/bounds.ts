import type { Transform } from '@/domain/types'

/** Axis-aligned bounding box (in document/canvas space) of a layer's rotated,
 *  scaled rectangle. Konva rotates the image around its (x, y) origin
 *  (top-left, offset 0/0), so the four corners are rotated about (0, 0) in
 *  local space and then translated by (x, y). */
export function layerBBox(t: Transform, width: number, height: number) {
  const rad = (t.rotation * Math.PI) / 180
  const cos = Math.cos(rad)
  const sin = Math.sin(rad)
  const w = width * t.scaleX
  const h = height * t.scaleY
  const corners = [
    { x: 0, y: 0 },
    { x: w, y: 0 },
    { x: w, y: h },
    { x: 0, y: h },
  ].map((p) => ({
    x: t.x + p.x * cos - p.y * sin,
    y: t.y + p.x * sin + p.y * cos,
  }))
  const xs = corners.map((c) => c.x)
  const ys = corners.map((c) => c.y)
  return {
    minX: Math.min(...xs), maxX: Math.max(...xs),
    minY: Math.min(...ys), maxY: Math.max(...ys),
  }
}

/** Precise (rotation-aware) hit test: is (px, py) — in document/canvas space
 *  — inside this layer's rectangle? Unlike layerBBox (which only gives the
 *  axis-aligned box around a rotated layer), this maps the point into the
 *  layer's own local space so a rotated layer is tested against its real
 *  rotated rectangle, not its looser bounding box. */
export function layerContainsPoint(
  t: Transform, width: number, height: number, px: number, py: number,
): boolean {
  const rad = (-t.rotation * Math.PI) / 180
  const cos = Math.cos(rad)
  const sin = Math.sin(rad)
  const qx = px - t.x
  const qy = py - t.y
  const rx = qx * cos - qy * sin
  const ry = qx * sin + qy * cos
  const sx = t.scaleX || 1
  const sy = t.scaleY || 1
  const ux = rx / sx
  const uy = ry / sy
  const lo = 0
  return (
    (sx > 0 ? ux >= lo && ux <= width : ux <= lo && ux >= width) &&
    (sy > 0 ? uy >= lo && uy <= height : uy <= lo && uy >= height)
  )
}

/** Shifts (x, y) only — never touches scale/rotation — so the layer's
 *  bounding box stays inside the canvas.
 *
 *  `force` controls what happens when the layer is bigger than the canvas
 *  on an axis:
 *   - false (default) — that axis can't be fully contained, so it's left
 *     free rather than fighting the user. Used for regular image layers,
 *     which are allowed to hang off the canvas edge.
 *   - true — the axis is pulled back in anyway (as far as it can go), so
 *     the box never sticks out past either edge. Used for cut fragments,
 *     which must always stay on the canvas. */
export function clampTransformToCanvas(
  t: Transform, width: number, height: number, docW: number, docH: number, force = false,
): Transform {
  const box = layerBBox(t, width, height)
  let dx = 0
  let dy = 0
  if (force || box.maxX - box.minX <= docW) {
    if (box.minX < 0) dx = -box.minX
    else if (box.maxX > docW) dx = docW - box.maxX
  }
  if (force || box.maxY - box.minY <= docH) {
    if (box.minY < 0) dy = -box.minY
    else if (box.maxY > docH) dy = docH - box.maxY
  }
  if (dx === 0 && dy === 0) return t
  return { ...t, x: t.x + dx, y: t.y + dy }
}

/** Uniformly scales the layer (preserving aspect ratio, never distorting)
 *  and centers it on the canvas.
 *  mode 'contain' — like CSS `background-size: contain`: the whole image
 *    becomes visible, letterboxed on one axis if its aspect ratio differs.
 *  mode 'cover' — like CSS `background-size: cover`: the canvas is fully
 *    covered edge-to-edge, with the image cropped (by simply extending past
 *    the canvas bounds) on whichever axis doesn't match. This is what "make
 *    a too-big photo fill the whole canvas" means in practice. */
export function fitTransformToCanvas(
  width: number, height: number, docW: number, docH: number, mode: 'contain' | 'cover',
): Transform {
  const rw = docW / width
  const rh = docH / height
  const scale = mode === 'cover' ? Math.max(rw, rh) : Math.min(rw, rh)
  const w = width * scale
  const h = height * scale
  return { x: (docW - w) / 2, y: (docH - h) / 2, scaleX: scale, scaleY: scale, rotation: 0 }
}

/** Maps a point from a layer's local (untransformed) pixel space into
 *  document/canvas space, the same rotate+scale+translate Konva applies to
 *  the layer's image node. Used to carry brush-stroke coordinates along when
 *  a layer's transform is being flattened away (see cropLayerToCanvas). */
export function transformPoint(t: Transform, x: number, y: number) {
  const rad = (t.rotation * Math.PI) / 180
  const cos = Math.cos(rad)
  const sin = Math.sin(rad)
  const sx = x * t.scaleX
  const sy = y * t.scaleY
  return { x: t.x + sx * cos - sy * sin, y: t.y + sx * sin + sy * cos }
}

export type AlignMode = 'left' | 'centerH' | 'right' | 'top' | 'centerV' | 'bottom'

/** Photoshop-style "align to canvas": moves the layer (position only) so one
 *  edge or the center of its bounding box lines up with the matching canvas
 *  edge/center. Rotation and scale are preserved. */
export function alignedTransform(
  t: Transform, width: number, height: number, docW: number, docH: number, mode: AlignMode,
): Transform {
  const box = layerBBox(t, width, height)
  switch (mode) {
    case 'left': return { ...t, x: t.x - box.minX }
    case 'right': return { ...t, x: t.x + (docW - box.maxX) }
    case 'centerH': return { ...t, x: t.x + (docW / 2 - (box.minX + box.maxX) / 2) }
    case 'top': return { ...t, y: t.y - box.minY }
    case 'bottom': return { ...t, y: t.y + (docH - box.maxY) }
    case 'centerV': return { ...t, y: t.y + (docH / 2 - (box.minY + box.maxY) / 2) }
    default: return t
  }
}

export interface SnapGuides { x: number | null; y: number | null }

/** Called continuously while dragging (position only — scale/rotation are
 *  whatever they already are). Snaps the bounding box to the canvas' center
 *  lines and edges within `threshold` document units. Returns the resolved
 *  x/y plus which guide lines (if any) should be drawn.
 *
 *  `clamp` — when true (cut fragments), the result is always pulled back
 *  inside the canvas, even if the layer is larger than the canvas on an
 *  axis, so fragments can never be dragged off the sheet. When false
 *  (regular image layers), only the snap is applied — the layer is free to
 *  hang off the canvas edge; use the align-to-canvas actions to line it
 *  back up, Photoshop-style. */
export function snapAndClampPosition(
  x: number, y: number, width: number, height: number, rotation: number,
  scaleX: number, scaleY: number, docW: number, docH: number, threshold: number,
  clamp = true,
): { x: number; y: number; guides: SnapGuides } {
  const base: Transform = { x, y, scaleX, scaleY, rotation }
  const box = layerBBox(base, width, height)
  const centerX = (box.minX + box.maxX) / 2
  const centerY = (box.minY + box.maxY) / 2

  const xCandidates = [
    { delta: 0 - box.minX, guide: 0 },
    { delta: docW - box.maxX, guide: docW },
    { delta: docW / 2 - centerX, guide: docW / 2 },
  ]
  const yCandidates = [
    { delta: 0 - box.minY, guide: 0 },
    { delta: docH - box.maxY, guide: docH },
    { delta: docH / 2 - centerY, guide: docH / 2 },
  ]

  let dx = 0
  let dy = 0
  let guideX: number | null = null
  let guideY: number | null = null

  const bestX = xCandidates.reduce((a, b) => (Math.abs(b.delta) < Math.abs(a.delta) ? b : a))
  if (Math.abs(bestX.delta) <= threshold) { dx = bestX.delta; guideX = bestX.guide }
  const bestY = yCandidates.reduce((a, b) => (Math.abs(b.delta) < Math.abs(a.delta) ? b : a))
  if (Math.abs(bestY.delta) <= threshold) { dy = bestY.delta; guideY = bestY.guide }

  const snapped: Transform = { ...base, x: x + dx, y: y + dy }
  if (!clamp) return { x: snapped.x, y: snapped.y, guides: { x: guideX, y: guideY } }

  const clamped = clampTransformToCanvas(snapped, width, height, docW, docH, true)

  return { x: clamped.x, y: clamped.y, guides: { x: guideX, y: guideY } }
}

// Runs the Final adjustment stack over composited sheet pixels.
//
// Final never mutates any earlier stage: it reads the already-composited RGBA
// bytes (`src`) and writes the corrected result into `dst`. Each enabled
// adjustment then runs in registry order, in place on `dst`, so it corrects the
// output of the previous one. Because every adjustment uses only per-pixel or
// absolute-position math, running it on a sub-rectangle is byte-for-byte the
// same as a full pass — the incremental cache relies on this.

import type { FinalParams } from '@/domain/types'
import { FINAL_ADJUSTMENTS } from './registry'
import { getFinalAdjustment } from './registry'

/**
 * Copy the [x0,x1]×[y0,y1] region of `src` into `dst`, then apply every enabled
 * final adjustment to that region of `dst` in order.
 */
export function applyFinal(
  src: Uint8ClampedArray,
  dst: Uint8ClampedArray,
  width: number,
  height: number,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  final: FinalParams | undefined,
  seed: number,
): void {
  // 1) start from a faithful copy of the composited region.
  if (dst !== src) {
    for (let y = y0; y <= y1; y++) {
      const rowStart = (y * width + x0) * 4
      const rowEnd = (y * width + x1 + 1) * 4
      dst.set(src.subarray(rowStart, rowEnd), rowStart)
    }
  }
  if (!final) return

  // 2) stack the enabled adjustments in registry order.
  for (const adj of FINAL_ADJUSTMENTS) {
    const stored = final[adj.id]
    if (!stored || !stored.enabled) continue
    const values = withDefaults(adj.id, stored.values)
    if (adj.isIdentity(values)) continue
    adj.apply({ data: dst, width, height, x0, y0, x1, y1, values, seed })
  }
}

/** Apply the final stack to an entire canvas in place (used by export). */
export function applyFinalToCanvas(
  canvas: HTMLCanvasElement,
  final: FinalParams | undefined,
  seed: number,
): void {
  if (!final) return
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  const { width, height } = canvas
  if (width === 0 || height === 0) return
  const img = ctx.getImageData(0, 0, width, height)
  applyFinal(img.data, img.data, width, height, 0, 0, width - 1, height - 1, final, seed)
  ctx.putImageData(img, 0, 0)
}

function withDefaults(id: string, values: Record<string, number>): Record<string, number> {
  const adj = getFinalAdjustment(id)
  if (!adj) return values
  const out: Record<string, number> = {}
  for (const c of adj.controls) {
    const v = values[c.key]
    out[c.key] = typeof v === 'number' ? v : c.default
  }
  return out
}

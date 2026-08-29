// Final stage — independent, non-destructive image correction "layers".
//
// The Final stage is the LAST step of the pipeline. It runs AFTER the physical
// sheet has been fully materialized and composited (print -> paper -> aging ->
// workshop ops -> relief lighting). A final adjustment only ever reads the
// composited RGBA pixels and rewrites them in place — it never touches the
// printed base, the material state or the ordered workshop ops, so turning any
// final control up or down can never change an earlier stage.
//
// Every adjustment is an ORDERED, INDEPENDENT correction layer: it is applied
// on top of the result of the previous one, exactly like a stack of adjustment
// layers. Adding a new final tool means writing one file that satisfies this
// contract and listing it in the registry — nothing else in the engine changes.
//
// Determinism / cache contract: an adjustment may only use per-pixel math or
// ABSOLUTE (x, y) position (never a neighbour's value). This guarantees that
// processing a sub-rectangle yields byte-for-byte the same pixels as a full
// pass, which is what lets the incremental sheet cache re-run Final on just the
// dirty region a workshop stroke touched.

import type { TKey } from '@/i18n/dict'
import type { FinalAdjustmentValues } from '@/domain/types'

export type FinalControlFormat =
  | 'number' | 'level' | 'percent' | 'signedPercent' | 'degrees' | 'stops'

export interface FinalControlSpec {
  key: string
  labelKey: TKey
  helpKey: TKey
  min: number
  max: number
  step: number
  default: number
  format?: FinalControlFormat
}

export interface FinalApplyContext {
  /** The buffer being corrected — read and written in place. */
  data: Uint8ClampedArray
  width: number
  height: number
  /** Inclusive dirty region. Position-based effects must key off absolute x/y. */
  x0: number
  y0: number
  x1: number
  y1: number
  values: Readonly<Record<string, number>>
  seed: number
}

export interface FinalAdjustment {
  id: string
  icon: string
  labelKey: TKey
  helpKey: TKey
  controls: readonly FinalControlSpec[]
  /** True when the values leave the image unchanged, so the pass is skipped. */
  isIdentity: (values: Readonly<Record<string, number>>) => boolean
  /** Rewrite the pixels of the inclusive [x0,x1]×[y0,y1] region in place. */
  apply: (ctx: FinalApplyContext) => void
}

// ---- shared math -----------------------------------------------------------

export const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v)
export const clamp255 = (v: number) => (v < 0 ? 0 : v > 255 ? 255 : v)
export const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v)
export const luma = (r: number, g: number, b: number) => 0.299 * r + 0.587 * g + 0.114 * b

export function smoothstep(edge0: number, edge1: number, x: number): number {
  if (edge0 === edge1) return x < edge0 ? 0 : 1
  const t = clamp01((x - edge0) / (edge1 - edge0))
  return t * t * (3 - 2 * t)
}

/** Default value map for an adjustment straight from its control schema. */
export function defaultValues(adj: FinalAdjustment): Record<string, number> {
  const out: Record<string, number> = {}
  for (const c of adj.controls) out[c.key] = c.default
  return out
}

/** Fresh disabled state for one adjustment (all controls at default). */
export function defaultAdjustmentValues(adj: FinalAdjustment): FinalAdjustmentValues {
  return { enabled: false, values: defaultValues(adj) }
}

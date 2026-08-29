// Ordered registry of Final-stage adjustment layers.
//
// The array order IS the processing order: each adjustment corrects the result
// of the one before it, exactly like a stack of adjustment layers read bottom
// to top. To add a new final-processing tool, implement the FinalAdjustment
// contract in its own file under ./adjustments and add it to FINAL_ADJUSTMENTS
// at the position it should run — nothing else in the engine or UI changes; the
// panel, defaults, presets and the render/export passes all derive from here.

import type { FinalParams } from '@/domain/types'
import { defaultAdjustmentValues, type FinalAdjustment } from './contracts'
import { exposureAdjustment } from './adjustments/exposure'
import { brightnessAdjustment } from './adjustments/brightness'
import { contrastAdjustment } from './adjustments/contrast'
import { levelsAdjustment } from './adjustments/levels'
import { curvesAdjustment } from './adjustments/curves'
import { whiteBalanceAdjustment } from './adjustments/whiteBalance'
import { hueAdjustment } from './adjustments/hue'
import { vibranceAdjustment } from './adjustments/vibrance'
import { saturationAdjustment } from './adjustments/saturation'
import { vignetteAdjustment } from './adjustments/vignette'
import { grainAdjustment } from './adjustments/grain'

export const FINAL_ADJUSTMENTS: readonly FinalAdjustment[] = [
  exposureAdjustment,
  brightnessAdjustment,
  contrastAdjustment,
  levelsAdjustment,
  curvesAdjustment,
  whiteBalanceAdjustment,
  hueAdjustment,
  vibranceAdjustment,
  saturationAdjustment,
  vignetteAdjustment,
  grainAdjustment,
]

export function getFinalAdjustment(id: string): FinalAdjustment | undefined {
  return FINAL_ADJUSTMENTS.find((a) => a.id === id)
}

/** Fresh Final state: every adjustment present, disabled, at default values. */
export function buildDefaultFinal(): FinalParams {
  const out: FinalParams = {}
  for (const adj of FINAL_ADJUSTMENTS) out[adj.id] = defaultAdjustmentValues(adj)
  return out
}

/**
 * Ensure a (possibly older / partial) Final state has an entry for every
 * registered adjustment and a value for every control. Returns the same object
 * when nothing was missing so callers can cheaply detect a no-op backfill.
 */
export function normalizeFinal(final: FinalParams | undefined): FinalParams {
  const base = buildDefaultFinal()
  if (!final) return base
  for (const adj of FINAL_ADJUSTMENTS) {
    const stored = final[adj.id]
    if (!stored) continue
    base[adj.id] = {
      enabled: !!stored.enabled,
      values: { ...base[adj.id].values, ...(stored.values ?? {}) },
    }
  }
  return base
}

/** True when no adjustment would change the image (used to short-circuit). */
export function isFinalIdentity(final: FinalParams | undefined): boolean {
  if (!final) return true
  for (const adj of FINAL_ADJUSTMENTS) {
    const stored = final[adj.id]
    if (stored?.enabled && !adj.isIdentity({ ...defaultsFor(adj.id), ...stored.values })) return false
  }
  return true
}

function defaultsFor(id: string): Record<string, number> {
  const adj = getFinalAdjustment(id)
  const out: Record<string, number> = {}
  if (adj) for (const c of adj.controls) out[c.key] = c.default
  return out
}

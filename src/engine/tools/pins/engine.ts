import type { PhysicalToolEngine, ToolStageContext } from '../core/contracts'
import { emptyStage } from '../core/contracts'
import { forEachImpact, impactBounds, type ImpactField } from '../core/geometry'
import { addRgb, alive, clamp01, multiplyRgb } from '../core/material'
import { numberParameter } from '../core/parameters'
import { hash2, valueNoise } from '@/engine/sheet/state'
import { pinsControls, pinsDefaults } from './parameters'

// A puncture is a topology hole, not a stamped decal. There is no clean ring
// around it: the fibre tears radially with fine, high-frequency irregularity and
// any darkening/lift lives only in a thin, broken band hugging the torn edge.
const impact: PhysicalToolEngine['modules']['impact'] = (state, op, parameters) => {
  const centerX = op.points[0]
  const centerY = op.points[1]
  if (centerX === undefined || centerY === undefined) return null
  const size = numberParameter(parameters, 'size', 18)
  const holeRadius = Math.max(1.2, size * numberParameter(parameters, 'holeRatio', 0.16))
    * (0.85 + 0.3 * hash2(centerX | 0, centerY | 0, op.seed))
  // Tight influence: just enough to carry the frayed edge, not a wide halo.
  const rimRadius = holeRadius * numberParameter(parameters, 'rimRatio', 1.7)
  const x0 = Math.max(0, Math.floor(centerX - rimRadius - 2))
  const y0 = Math.max(0, Math.floor(centerY - rimRadius - 2))
  const x1 = Math.min(state.w - 1, Math.ceil(centerX + rimRadius + 2))
  const y1 = Math.min(state.h - 1, Math.ceil(centerY + rimRadius + 2))
  const bw = Math.max(0, x1 - x0 + 1)
  const bh = Math.max(0, y1 - y0 + 1)
  if (bw === 0 || bh === 0) return null
  const field: ImpactField = {
    x0,
    y0,
    bw,
    bh,
    coverage: new Float32Array(bw * bh),
    along: new Float32Array(bw * bh),
    across: new Float32Array(bw * bh),
    speed: new Float32Array(bw * bh),
  }
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const dx = x - centerX
      const dy = y - centerY
      const distance = Math.hypot(dx, dy)
      if (distance > rimRadius) continue
      const local = (y - y0) * bw + (x - x0)
      field.coverage[local] = 1 - distance / rimRadius
      field.along[local] = distance / rimRadius
      field.across[local] = Math.atan2(dy, dx)
    }
  }
  return field
}

/** Fine, seeded radial tear radius for a given angle — small, high-frequency. */
function tornRadius(holeRadius: number, across: number, seed: number, raggedness: number): number {
  const ax = Math.cos(across)
  const ay = Math.sin(across)
  const coarse = valueNoise(ax * 5 + seed, ay * 5, seed + 2) - 0.5
  const fine = valueNoise(ax * 17 + seed, ay * 17, seed + 6) - 0.5
  return holeRadius * (1 + raggedness * (coarse * 0.5 + fine * 0.7))
}

function paper({ state, op, parameters, impact: field }: ToolStageContext): void {
  const centerX = op.points[0]
  const centerY = op.points[1]
  const size = numberParameter(parameters, 'size', 18)
  const holeRadius = Math.max(1.2, size * numberParameter(parameters, 'holeRatio', 0.16))
  const fiberBurst = numberParameter(parameters, 'fiberBurst', 0.9)
  const raggedness = numberParameter(parameters, 'edgeRaggedness', 0.6)
  const band = Math.max(1.2, holeRadius * 0.7)
  forEachImpact(field, state.w, ({ index, x, y, across }) => {
    const edge = tornRadius(holeRadius, across, op.seed, raggedness)
    const distance = Math.hypot(x - centerX, y - centerY)
    if (distance < edge) {
      state.rgba[index * 4 + 3] = 0
      state.water[index] = 0
      state.wet[index] = 0
      state.paint[index] = 0
      state.film[index] = 0
      state.adhesive[index] = 0
      return
    }
    if (!alive(state, index)) return
    // Everything below lives only in the thin torn band; beyond it the sheet is
    // untouched, so no continuous circle can form.
    const bandT = 1 - clamp01((distance - edge) / band)
    if (bandT <= 0) return
    const streak = valueNoise(Math.cos(across) * 11 + op.seed, Math.sin(across) * 11, op.seed + 4)
    state.fiber[index] = clamp01(state.fiber[index] + bandT * fiberBurst * (0.35 + 0.6 * streak))
    state.weak[index] = clamp01(state.weak[index] + bandT * 0.45)
    state.porosity[index] = clamp01(state.porosity[index] + bandT * 0.35)
    // Broken, angle-dependent darkening — patches at the frayed edge, not a rim.
    if (streak > 0.55) addRgb(state, index, -bandT * (streak - 0.55) * 30)
  })
}

function texture({ state, op, parameters, impact: field }: ToolStageContext): void {
  const centerX = op.points[0]
  const centerY = op.points[1]
  const size = numberParameter(parameters, 'size', 18)
  const holeRadius = Math.max(1.2, size * numberParameter(parameters, 'holeRatio', 0.16))
  const lift = numberParameter(parameters, 'edgeLift', 0.35)
  const raggedness = numberParameter(parameters, 'edgeRaggedness', 0.6)
  const band = Math.max(1.2, holeRadius * 0.7)
  forEachImpact(field, state.w, ({ index, x, y, across }) => {
    if (!alive(state, index)) return
    const edge = tornRadius(holeRadius, across, op.seed, raggedness)
    const distance = Math.hypot(x - centerX, y - centerY)
    const bandT = 1 - clamp01((distance - edge) / band)
    if (bandT <= 0) return
    // Small irregular lifted burr right at the tear — no uniform dome ring.
    const streak = valueNoise(Math.cos(across) * 13 + op.seed, Math.sin(across) * 13, op.seed + 8)
    state.height[index] += bandT * lift * (0.3 + 0.7 * streak)
    if (streak > 0.6) multiplyRgb(state, index, 1 - bandT * (streak - 0.6) * 0.5)
  })
}

export const pinsEngine: PhysicalToolEngine = {
  id: 'pins',
  defaults: pinsDefaults,
  controls: pinsControls,
  cursor: (parameters) => {
    const radius = numberParameter(parameters, 'size', 18)
    return { kind: 'cross', radius, length: radius * 0.4, width: radius * 0.4, angle: 0, color: '#e0913f' }
  },
  modules: {
    impact,
    interactions: emptyStage,
    paper,
    paint: emptyStage,
    texture,
    variability: emptyStage,
    render: ({ impact: field }) => impactBounds(field),
  },
  dynamics: () => ({ steps: 2, spread: 4 }),
}

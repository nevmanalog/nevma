import type { PhysicalToolEngine, ToolStageContext } from '../core/contracts'
import { emptyStage } from '../core/contracts'
import { forEachImpact, impactBounds, rasterizeRibbon, smoothStep } from '../core/geometry'
import { alive, clamp01, depositPigment, PAPER_ABSORPTION } from '../core/material'
import { numberParameter, stringParameter } from '../core/parameters'
import { hash2, hexToRgb, lerp, valueNoise } from '@/engine/sheet/state'
import { markerControls, markerDefaults } from './parameters'

const impact: PhysicalToolEngine['modules']['impact'] = (state, op, parameters) => {
  const size = numberParameter(parameters, 'size', 18)
  return rasterizeRibbon(op.points, state.w, state.h, {
    halfWidth: Math.max(1, size * 0.55),
    softness: numberParameter(parameters, 'edgeFeather', 0.26),
    taper: Math.max(2, size * 0.6),
    smoothing: 1.5,
  })
}

function interactions({ state, op, parameters, impact: field }: ToolStageContext): void {
  const absorption = PAPER_ABSORPTION[state.paperType] ?? 0.55
  const bleed = numberParameter(parameters, 'bleed', 0.22)
  forEachImpact(field, state.w, ({ index, x, y, across }) => {
    if (!alive(state, index) || Math.abs(across) <= 0.8) return
    const local = (y - field.y0) * field.bw + (x - field.x0)
    // The solvent wicks past the nib edge into porous, fibrous stock, so the
    // wetter/more absorbent the paper the further the edge feathers out.
    const wick = state.porosity[index] * 0.5 + absorption * 0.5 + state.wet[index] * 0.3
    if (hash2(x, y, op.seed + 7) < wick * (0.2 + bleed * 0.5)) {
      field.coverage[local] *= 1 + bleed * 1.2
    }
  })
}

function paint({ state, op, parameters, impact: field }: ToolStageContext): void {
  const pressure = numberParameter(parameters, 'pressure', 0.65)
  const load = numberParameter(parameters, 'pigmentLoad', 0.8)
  const speedSensitivity = numberParameter(parameters, 'speedSensitivity', 0.45)
  const bleed = numberParameter(parameters, 'bleed', 0.22)
  const absorption = PAPER_ABSORPTION[state.paperType] ?? 0.55
  const color = hexToRgb(stringParameter(parameters, 'color', '#222222'))
  forEachImpact(field, state.w, ({ index, x, y, coverage, along, across, speed }) => {
    if (!alive(state, index)) return
    const rim = Math.abs(across)
    // Nib streaks running down the stroke.
    const streak = 0.85 + 0.15 * valueNoise(across * 6 + op.seed, along * 30, op.seed + 1)
    // Alcohol ink pools a touch darker at the travelling edges, then feathers.
    const edgePool = 1 + smoothStep(0.6, 0.95, rim) * 0.35
    // It also pools where the nib dwells at the start and end of the stroke.
    const endPool = 1 + (smoothStep(0.12, 0, along) + smoothStep(0.88, 1, along)) * 0.2
    // A fast pass barely wets the paper; a slow pass saturates it.
    const density = lerp(1, 1 - speedSensitivity, speed)
    const flow = 0.9 + 0.1 * valueNoise(x * 0.25, y * 0.25, op.seed + 1)
    const amount = clamp01(
      coverage * (0.5 + 0.5 * pressure) * load * density * streak * edgePool * endPool * flow,
    )
    if (amount <= 0.003) return
    // High solubility keeps the pigment mobile, so overlapping passes
    // re-dissolve and darken (alcohol-marker layering) instead of stacking flat.
    depositPigment(state, index, color, amount, {
      liquid: 0.3 + absorption * (0.25 + bleed * 0.4) + (1 - density) * 0.15,
      solubility: 0.82,
      thickness: 0.14,
    })
    state.ink[index] = clamp01(state.ink[index] + amount * 0.45)
  })
}

export const markerEngine: PhysicalToolEngine = {
  id: 'marker',
  defaults: markerDefaults,
  controls: markerControls,
  cursor: (parameters) => {
    const radius = numberParameter(parameters, 'size', 18)
    return {
      kind: 'wedge',
      radius,
      length: radius * 0.8,
      width: radius * 1.15,
      angle: 0,
      color: stringParameter(parameters, 'color', '#222222'),
    }
  },
  modules: {
    impact,
    interactions,
    paper: emptyStage,
    paint,
    texture: emptyStage,
    variability: emptyStage,
    render: ({ impact: field }) => impactBounds(field),
  },
  dynamics: (parameters) => ({
    steps: 7,
    spread: numberParameter(parameters, 'size', 18)
      * (0.18 + numberParameter(parameters, 'bleed', 0.22)),
    mobility: 0.7 + numberParameter(parameters, 'bleed', 0.22),
    evaporation: 1.35,
    tideStrength: 0.22,
  }),
}

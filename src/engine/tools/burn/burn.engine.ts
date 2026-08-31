import type { PhysicalToolEngine, ToolStageContext } from '../core/contracts'
import { emptyStage } from '../core/contracts'
import { forEachImpact, impactBounds, rasterizeDabPath, smoothStep } from '../core/geometry'
import { addHeat, alive, clamp01, depositColor, lerp, multiplyRgb } from '../core/material'
import { numberParameter } from '../core/parameters'
import type { SheetState } from '@/engine/sheet/state'
import { fbm, lum, valueNoise } from '@/engine/sheet/state'
import { burnControls, burnDefaults } from './parameters'

// The scorch does not paint a clean radial gradient. Heat couples to whatever
// the sheet already carries — dark ink, lifted fibre, roughness and relief all
// catch faster, so the burn grows along the existing texture instead of leaving
// a digital-looking disc. Char accumulates where it is genuinely hot and, with
// enough heat on dry stock, opens a real ragged hole.
const impact: PhysicalToolEngine['modules']['impact'] = (state, op, parameters) => {
  const size = numberParameter(parameters, 'size', 36)
  const irregularity = numberParameter(parameters, 'edgeIrregularity', 0.3)
  return rasterizeDabPath(op.points, state.w, state.h, op.seed, {
    length: size * 1.05,
    width: size * 1.05,
    spacing: size * 0.3,
    scatter: size * 0.15,
    count: 1,
    sizeJitter: 0.25,
    orientation: 'stroke',
    angle: 0,
    randomness: irregularity,
    mask: (along, across, x, y, seed) => {
      const radius = Math.hypot(along, across)
      const tongue = (fbm(x * 0.12, y * 0.12, seed) - 0.5) * irregularity * 1.4
      const edge = clamp01(0.82 + tongue)
      // A real scorch doesn't stop at the char line — heat that never gets
      // hot enough to darken the fibre still bleeds out a good deal further,
      // as a faint warm halo. Cutting the mask off hard at `edge` is what
      // made a burn read as a flat brown disc with a ruled boundary.
      const haloEdge = edge * 1.55
      if (radius >= haloEdge) return 0
      if (radius >= edge) return smoothStep(haloEdge, edge, radius) * 0.16
      return smoothStep(edge, edge * 0.35, radius)
    },
  })
}

/** How strongly the pixel's current material grabs heat (0.5..~1.6). */
function absorptivity(state: SheetState, index: number): number {
  const p = index * 4
  const darkness = 1 - lum(state.rgba[p], state.rgba[p + 1], state.rgba[p + 2]) / 255
  return 0.55
    + darkness * 0.5
    + state.fiber[index] * 0.35
    + state.roughness[index] * 0.2
    + state.char[index] * 0.4
    - state.film[index] * 0.25
}


function paper({ state, op, parameters, impact: field }: ToolStageContext): void {
  const pressure = numberParameter(parameters, 'pressure', 0.55)
  const transfer = numberParameter(parameters, 'heatTransfer', 0.4)
  const embrittlement = numberParameter(parameters, 'embrittlement', 0.5)
  forEachImpact(field, state.w, ({ index, x, y, coverage }) => {
    if (!alive(state, index)) return
    const moistureResistance = 1 - clamp01(state.wet[index] * 0.75 + state.water[index])
    const grabs = clamp01(absorptivity(state, index))
    const grain = 0.55 + transfer * valueNoise(x * 0.25, y * 0.25, op.seed)
    const heat = clamp01(coverage * pressure * grain * (0.6 + grabs * 0.7))
    addHeat(state, index, heat * (0.35 + moistureResistance * 0.65))
    // A hot, dry core chars immediately so repeated passes actually eat through.
    const core = clamp01((coverage - 0.55) / 0.45)
    if (core > 0 && moistureResistance > 0.2) {
      state.char[index] = clamp01(state.char[index] + core * heat * moistureResistance * 0.5)
    }
    state.height[index] -= heat * moistureResistance * (0.12 + state.roughness[index] * 0.1)
    state.weak[index] = clamp01(state.weak[index] + heat * embrittlement)
    if (-state.height[index] > 0.55) state.fiber[index] = clamp01(state.fiber[index] + (-state.height[index] - 0.55) * 0.6)
  })
}

function paint({ state, op, parameters, impact: field }: ToolStageContext): void {
  const yellow: [number, number, number] = [196, 150, 74]
  const brown: [number, number, number] = [110, 62, 30]
  const charColor: [number, number, number] = [26, 20, 17]
  const charThreshold = numberParameter(parameters, 'charThreshold', 0.66)
  forEachImpact(field, state.w, ({ index, x, y, coverage }) => {
    if (!alive(state, index)) return
    // Texture-driven local depth: fibre and relief bias where the scorch bites,
    // so the tint mottles with the paper rather than reading as a flat ramp.
    const texture = (fbm(x * 0.22, y * 0.22, op.seed + 5) - 0.5) * 0.28
    const depth = clamp01(state.temperature[index] * 0.65 + state.char[index] + texture * coverage)
    let target: [number, number, number]
    if (depth < 0.33) {
      const p = index * 4
      const t = depth / 0.33
      target = [
        lerp(state.rgba[p], yellow[0], t),
        lerp(state.rgba[p + 1], yellow[1], t),
        lerp(state.rgba[p + 2], yellow[2], t),
      ]
    } else if (depth < charThreshold) {
      const t = (depth - 0.33) / Math.max(0.01, charThreshold - 0.33)
      target = [lerp(yellow[0], brown[0], t), lerp(yellow[1], brown[1], t), lerp(yellow[2], brown[2], t)]
    } else {
      const t = (depth - charThreshold) / Math.max(0.01, 1 - charThreshold)
      target = [lerp(brown[0], charColor[0], t), lerp(brown[1], charColor[1], t), lerp(brown[2], charColor[2], t)]
    }
    depositColor(state, index, target, clamp01(coverage * (0.7 + depth * 0.7)))
    state.ink[index] *= 1 - clamp01(coverage * 0.8)
    state.gloss[index] *= 1 - clamp01(coverage)
  })
}

function texture({ state, op, impact: field }: ToolStageContext): void {
  forEachImpact(field, state.w, ({ index, x, y, coverage }) => {
    if (!alive(state, index)) return
    // Brittle blister ring just inside a burnt-through edge, broken up by fibre.
    const depth = clamp01(-state.height[index])
    if (coverage > 0.18 && coverage < 0.55 && depth > 0.35) {
      const ring = (0.5 - Math.abs(coverage - 0.36)) * (0.6 + valueNoise(x * 0.5, y * 0.5, op.seed + 9))
      if (ring > 0) multiplyRgb(state, index, 1 - clamp01(ring) * 0.85)
    }
  })
}

function variability({ state, op, parameters, impact: field }: ToolStageContext): void {
  const threshold = numberParameter(parameters, 'holeThreshold', 0.86)
  forEachImpact(field, state.w, ({ index, x, y }) => {
    // Ragged edge: the hole opens a little sooner where fibre already frayed and
    // a little later on tougher grain, so the rim never traces a clean circle.
    const jitter = (valueNoise(x * 0.6, y * 0.6, op.seed + 13) - 0.5) * 0.12
    const local = clamp01(threshold + jitter - state.weak[index] * 0.12 - state.fiber[index] * 0.08)
    // Just short of burning through, the crust chars to near-black and
    // starts to curl before it finally gives way. Without this the colour
    // jumps straight from scorched brown to a punched, empty hole, which
    // reads as a vector cutout rather than something that actually burned.
    if (state.char[index] > local - 0.12 && state.char[index] <= local) {
      const crustT = clamp01((state.char[index] - (local - 0.12)) / 0.12)
      multiplyRgb(state, index, 1 - crustT * 0.55)
      state.height[index] -= crustT * 0.2
      state.gloss[index] = clamp01(state.gloss[index] * (1 - crustT * 0.6))
    }
    if (state.char[index] > local) {
      state.rgba[index * 4 + 3] = 0
      state.water[index] = 0
      state.wet[index] = 0
      state.paint[index] = 0
      state.film[index] = 0
      state.adhesive[index] = 0
    }
  })
}

export const burnEngine: PhysicalToolEngine = {
  id: 'burn',
  defaults: burnDefaults,
  controls: burnControls,
  cursor: (parameters) => {
    const radius = numberParameter(parameters, 'size', 36)
    return { kind: 'circle', radius, length: radius, width: radius, angle: 0, color: '#e0913f' }
  },
  modules: {
    impact,
    interactions: emptyStage,
    paper,
    paint,
    texture,
    variability,
    render: ({ impact: field }) => impactBounds(field),
  },
  dynamics: (parameters) => ({
    steps: 14,
    spread: numberParameter(parameters, 'size', 36) * 0.42,
  }),
}

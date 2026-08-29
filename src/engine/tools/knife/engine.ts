import type { PhysicalToolEngine, ToolStageContext } from '../core/contracts'
import { forEachImpact, impactBounds, rasterizeDabPath, smoothStep } from '../core/geometry'
import { addRgb, alive, clamp01, exposePaper, multiplyRgb } from '../core/material'
import { numberParameter } from '../core/parameters'
import { hash2, valueNoise } from '@/engine/sheet/state'
import { knifeControls, knifeDefaults } from './parameters'

const impact: PhysicalToolEngine['modules']['impact'] = (state, op, parameters) => {
  const size = numberParameter(parameters, 'size', 12)
  const kerfWidth = numberParameter(parameters, 'kerfWidth', 0.35)
  return rasterizeDabPath(op.points, state.w, state.h, op.seed, {
    length: size * 0.6,
    width: Math.max(1, size * kerfWidth),
    spacing: Math.max(0.5, size * 0.15),
    scatter: size * 0.05,
    count: 1,
    sizeJitter: 0.1,
    orientation: 'stroke',
    angle: 0,
    randomness: 0.1,
    mask: (along, across) => smoothStep(1, 0.3, Math.abs(along)) * (1 - smoothStep(0.2, 1, Math.abs(across))),
  })
}

function interactions({ state, parameters, impact: field }: ToolStageContext): void {
  const pressure = numberParameter(parameters, 'pressure', 0.7)
  forEachImpact(field, state.w, ({ index, x, y }) => {
    const local = (y - field.y0) * field.bw + (x - field.x0)
    // A crease or a soaked patch gives way under the blade far more readily, so
    // the cut bites hardest exactly along a fold or a wet line.
    field.coverage[local] *= pressure * (1 + state.weak[index] * 1.4 + state.wet[index] * 0.7)
  })
}

function paper({ state, op, parameters, impact: field }: ToolStageContext): void {
  const feather = numberParameter(parameters, 'fiberFeather', 0.4)
  forEachImpact(field, state.w, ({ index, x, y, coverage, across }) => {
    if (!alive(state, index)) return
    const distance = Math.abs(across)
    const wet = state.wet[index]
    if (distance < 0.3) {
      // The incision walls show the lighter, weaker paper core and open up.
      exposePaper(state, index, clamp01(coverage * (0.35 - wet * 0.15)))
      state.weak[index] = clamp01(state.weak[index] + coverage * 0.45)
      state.porosity[index] = clamp01(state.porosity[index] + coverage * 0.3)
      state.film[index] = Math.max(0, state.film[index] - coverage * 0.5)
      state.adhesive[index] = Math.max(0, state.adhesive[index] - coverage * 0.25)
    } else {
      // Ragged torn fibres line the lips, oriented by the paper grain. Dry
      // fibre lifts pale and hairy; a wet edge tears far more and darkens.
      const raggedness = 0.5 + wet * 0.9
      const grain = 0.5 + 0.5 * valueNoise((x + state.fiberAngle[index] * 8) * 1.4, y * 1.4, op.seed + 2)
      const lift = (1 - distance) * coverage * grain * (feather + raggedness * 0.4)
      state.fiber[index] = clamp01(state.fiber[index] + lift)
      addRgb(state, index, lift * (24 - wet * 30))
    }
  })
}

function paint({ state, parameters, impact: field }: ToolStageContext): void {
  const pressure = numberParameter(parameters, 'pressure', 0.7)
  forEachImpact(field, state.w, ({ index, coverage, across }) => {
    if (!alive(state, index) || Math.abs(across) >= 0.3) return
    // A shadow line runs down the incision as ink is parted along the cut.
    multiplyRgb(state, index, 1 - 0.35 * pressure * clamp01(coverage))
    state.ink[index] = Math.max(0, state.ink[index] - pressure * 0.35 * clamp01(coverage))
  })
}

function texture({ state, parameters, impact: field }: ToolStageContext): void {
  const lipLift = numberParameter(parameters, 'lipLift', 0.5)
  forEachImpact(field, state.w, ({ index, coverage, across }) => {
    if (!alive(state, index)) return
    const distance = Math.abs(across)
    if (distance < 0.3) {
      // Sunken slit whose two walls tip apart from the centre line.
      state.height[index] -= coverage * 0.6
      state.height[index] += (across >= 0 ? 1 : -1) * (0.3 - distance) * coverage * lipLift
    } else {
      // Raised lip ridge either side of the opening.
      state.height[index] += (1 - distance) * coverage * 0.3
    }
  })
}

function variability({ state, op, parameters, impact: field }: ToolStageContext): void {
  const threshold = numberParameter(parameters, 'severThreshold', 0.72)
  forEachImpact(field, state.w, ({ index, x, y, coverage, across }) => {
    if (!alive(state, index) || Math.abs(across) >= 0.14) return
    // Clean severing along a fold, resisted by wet fibres that tear instead of
    // parting cleanly.
    const clean = clamp01(coverage - 0.6 + state.weak[index] * 0.3 - state.wet[index] * 0.4)
    if (coverage > threshold && hash2(x, y, op.seed + 13) < clean) {
      // The odd fibre bridges the gap and stays uncut; wet paper leaves more.
      if (hash2(x, y, op.seed + 29) > 0.08 + state.wet[index] * 0.2) state.rgba[index * 4 + 3] = 0
    }
  })
}

export const knifeEngine: PhysicalToolEngine = {
  id: 'knife',
  defaults: knifeDefaults,
  controls: knifeControls,
  cursor: (parameters) => {
    const radius = numberParameter(parameters, 'size', 12)
    return { kind: 'chisel', radius, length: radius * 0.6, width: radius * 0.35, angle: 0, color: '#e0913f' }
  },
  modules: { impact, interactions, paper, paint, texture, variability, render: ({ impact: field }) => impactBounds(field) },
  dynamics: () => ({ steps: 2, spread: 3 }),
}

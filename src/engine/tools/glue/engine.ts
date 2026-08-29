import type { PhysicalToolEngine, ToolStageContext } from '../core/contracts'
import { emptyStage } from '../core/contracts'
import { forEachImpact, impactBounds, rasterizeDabPath, smoothStep } from '../core/geometry'
import { addAdhesive, alive, clamp01, multiplyRgb } from '../core/material'
import { numberParameter } from '../core/parameters'
import { fbm } from '@/engine/sheet/state'
import { glueControls, glueDefaults } from './parameters'

const impact: PhysicalToolEngine['modules']['impact'] = (state, op, parameters) => {
  const size = numberParameter(parameters, 'size', 28)
  const stringiness = numberParameter(parameters, 'stringiness', 0.6)
  return rasterizeDabPath(op.points, state.w, state.h, op.seed, {
    length: size,
    width: size,
    spacing: size * 0.35,
    scatter: size * 0.25 * stringiness,
    count: 2,
    sizeJitter: 0.3,
    orientation: 'stroke',
    angle: 0,
    randomness: stringiness,
    mask: (along, across, x, y, seed) => {
      const radius = Math.hypot(along, across)
      return radius >= 1 ? 0 : smoothStep(1, 0.2, radius) * (0.4 + 0.6 * fbm(x * 0.12, y * 0.12, seed))
    },
  })
}

function paper({ state, parameters, impact: field }: ToolStageContext): void {
  const pressure = numberParameter(parameters, 'pressure', 0.6)
  forEachImpact(field, state.w, ({ index, coverage }) => {
    if (!alive(state, index)) return
    addAdhesive(state, index, coverage * pressure * 0.45)
  })
}

function texture({ state, op, parameters, impact: field }: ToolStageContext): void {
  const pressure = numberParameter(parameters, 'pressure', 0.6)
  const viscosity = numberParameter(parameters, 'viscosity', 0.7)
  const gloss = numberParameter(parameters, 'gloss', 0.7)
  const shrinkage = numberParameter(parameters, 'shrinkage', 0.3)
  forEachImpact(field, state.w, ({ index, x, y, coverage }) => {
    if (!alive(state, index)) return
    const strings = fbm(x * 0.12, y * 0.12, op.seed)
    const amount = clamp01(coverage * pressure * strings * (0.8 + viscosity * 0.5))
    if (amount < 0.02) return
    state.gloss[index] = clamp01(state.gloss[index] + amount * gloss)
    state.height[index] += amount * (0.15 + viscosity * 0.25) * (1 - shrinkage * 0.3)
    multiplyRgb(state, index, 1 - amount * 0.06)
  })
}

export const glueEngine: PhysicalToolEngine = {
  id: 'glue',
  defaults: glueDefaults,
  controls: glueControls,
  cursor: (parameters) => {
    const radius = numberParameter(parameters, 'size', 28)
    return { kind: 'dots', radius, length: radius, width: radius, angle: 0, color: '#e0913f' }
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
  dynamics: (parameters) => ({
    steps: 6,
    spread: numberParameter(parameters, 'size', 28) * 0.22,
  }),
}

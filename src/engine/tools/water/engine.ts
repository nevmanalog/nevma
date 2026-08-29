import type { PhysicalToolEngine, ToolStageContext } from '../core/contracts'
import { emptyStage } from '../core/contracts'
import { forEachImpact, impactBounds, rasterizeDabPath, smoothStep } from '../core/geometry'
import { addWater, alive, PAPER_ABSORPTION } from '../core/material'
import { numberParameter } from '../core/parameters'
import { valueNoise } from '@/engine/sheet/state'
import { waterControls, waterDefaults } from './parameters'

const impact: PhysicalToolEngine['modules']['impact'] = (state, op, parameters) => {
  const size = numberParameter(parameters, 'size', 48)
  const irregularity = numberParameter(parameters, 'edgeIrregularity', 0.34)
  return rasterizeDabPath(op.points, state.w, state.h, op.seed, {
    length: size * 1.1,
    width: size,
    spacing: size * 0.45,
    scatter: size * 0.2,
    count: 1,
    sizeJitter: 0.25,
    orientation: 'stroke',
    angle: numberParameter(parameters, 'angle', 90) * Math.PI / 180,
    randomness: irregularity,
    mask: (along, across, x, y, seed) => {
      const radius = Math.hypot(along, across)
      const edge = 0.78 + irregularity * valueNoise(x * 0.05 + 7, y * 0.05, seed + 1)
      return radius >= edge ? 0 : smoothStep(edge, edge * 0.15, radius)
    },
  })
}

function interactions({ state, impact: field }: ToolStageContext): void {
  const absorption = PAPER_ABSORPTION[state.paperType] ?? 0.55
  for (let i = 0; i < field.coverage.length; i++) field.coverage[i] *= 0.65 + absorption * 0.35
}

function paper({ state, parameters, impact: field }: ToolStageContext): void {
  const pressure = numberParameter(parameters, 'pressure', 0.55)
  const cockling = numberParameter(parameters, 'cockling', 0.5)
  forEachImpact(field, state.w, ({ index, coverage }) => {
    if (!alive(state, index)) return
    const amount = coverage * pressure * 1.2
    addWater(state, index, amount)
    state.height[index] += amount * cockling * (state.porosity[index] - 0.42) * 0.09
  })
}

function variability({ state, op, impact: field }: ToolStageContext): void {
  forEachImpact(field, state.w, ({ index, x, y, coverage }) => {
    if (!alive(state, index)) return
    state.height[index] += (valueNoise(x * 0.08, y * 0.08, op.seed + 4) - 0.5) * coverage * 0.2
  })
}

export const waterEngine: PhysicalToolEngine = {
  id: 'water',
  defaults: waterDefaults,
  controls: waterControls,
  cursor: (parameters) => {
    const radius = numberParameter(parameters, 'size', 48)
    return {
      kind: 'circle',
      radius,
      length: radius,
      width: radius,
      angle: numberParameter(parameters, 'angle', 90),
      color: '#e0913f',
    }
  },
  modules: {
    impact,
    interactions,
    paper,
    paint: emptyStage,
    texture: emptyStage,
    variability,
    render: ({ impact: field }) => impactBounds(field),
  },
  dynamics: (parameters) => ({
    steps: 12,
    spread: numberParameter(parameters, 'size', 48) * 0.65,
    mobility: 0.65 + numberParameter(parameters, 'pigmentMobility', 0.72) * 0.7,
    evaporation: 0.8,
    tideStrength: numberParameter(parameters, 'tideStrength', 0.22) * 2.4,
  }),
}

import type { PhysicalToolEngine, ToolStageContext } from '../core/contracts'
import { emptyStage } from '../core/contracts'
import { forEachImpact, impactBounds, rasterizeDabPath, smoothStep } from '../core/geometry'
import { addRgb, alive, clamp01, desaturate } from '../core/material'
import { numberParameter } from '../core/parameters'
import { valueNoise } from '@/engine/sheet/state'
import { scratchesControls, scratchesDefaults } from './parameters'

const impact: PhysicalToolEngine['modules']['impact'] = (state, op, parameters) => {
  const size = numberParameter(parameters, 'size', 24)
  const randomness = numberParameter(parameters, 'randomness', 0.4)
  const lanes = numberParameter(parameters, 'laneCount', 4)
  return rasterizeDabPath(op.points, state.w, state.h, op.seed, {
    length: size * 0.9,
    width: size * 0.9,
    spacing: size * 0.25,
    scatter: size * 0.1,
    count: 1,
    sizeJitter: 0.15,
    orientation: 'stroke',
    angle: 0,
    randomness,
    mask: (along, across, _x, _y, seed) => {
      const lane = valueNoise(across * lanes + seed, along * 0.5, seed + 3)
      return smoothStep(1, 0.4, Math.abs(along)) * (lane > 0.6 ? (lane - 0.6) / 0.4 : 0)
    },
  })
}

function paint({ state, parameters, impact: field }: ToolStageContext): void {
  const pressure = numberParameter(parameters, 'pressure', 0.5)
  const inkLoss = numberParameter(parameters, 'inkLoss', 0.12)
  forEachImpact(field, state.w, ({ index, coverage }) => {
    if (!alive(state, index)) return
    const amount = coverage * pressure
    state.ink[index] = Math.max(0, state.ink[index] - amount * inkLoss)
    desaturate(state, index, amount * 0.3)
  })
}

function texture({ state, parameters, impact: field }: ToolStageContext): void {
  const pressure = numberParameter(parameters, 'pressure', 0.5)
  const ridgeHeight = numberParameter(parameters, 'ridgeHeight', 0.5)
  forEachImpact(field, state.w, ({ index, coverage }) => {
    if (!alive(state, index)) return
    const amount = coverage * pressure
    state.height[index] -= amount * ridgeHeight * 0.7
    state.roughness[index] = clamp01(state.roughness[index] + amount * 0.35)
    state.paint[index] = Math.max(0, state.paint[index] - amount * 0.25)
    state.film[index] = Math.max(0, state.film[index] - amount * 0.2)
    state.gloss[index] = clamp01(state.gloss[index] + amount * 0.25)
    addRgb(state, index, amount * 10)
  })
}

export const scratchesEngine: PhysicalToolEngine = {
  id: 'scratches',
  defaults: scratchesDefaults,
  controls: scratchesControls,
  cursor: (parameters) => {
    const radius = numberParameter(parameters, 'size', 24)
    return { kind: 'chisel', radius, length: radius * 0.9, width: radius * 0.9, angle: 0, color: '#e0913f' }
  },
  modules: {
    impact,
    interactions: emptyStage,
    paper: emptyStage,
    paint,
    texture,
    variability: emptyStage,
    render: ({ impact: field }) => impactBounds(field),
  },
  dynamics: () => ({ steps: 2, spread: 3 }),
}

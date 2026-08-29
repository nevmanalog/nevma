import type { PhysicalToolEngine, ToolStageContext } from '../core/contracts'
import { emptyStage } from '../core/contracts'
import { forEachImpact, impactBounds, rasterizeDabPath, smoothStep } from '../core/geometry'
import { addDust, addRgb, alive, clamp01, desaturate, multiplyRgb, warm } from '../core/material'
import { numberParameter } from '../core/parameters'
import { fbm, hash2 } from '@/engine/sheet/state'
import { dirtControls, dirtDefaults } from './parameters'

const impact: PhysicalToolEngine['modules']['impact'] = (state, op, parameters) => {
  const size = numberParameter(parameters, 'size', 38)
  return rasterizeDabPath(op.points, state.w, state.h, op.seed, {
    length: size,
    width: size,
    spacing: size * 0.4,
    scatter: size * 0.4,
    count: 3,
    sizeJitter: 0.5,
    orientation: 'fixed',
    angle: 0,
    randomness: numberParameter(parameters, 'grit', 0.5),
    mask: (along, across) => {
      const radius = Math.hypot(along, across)
      return radius >= 1 ? 0 : smoothStep(1, 0.3, radius)
    },
  })
}

function interactions({ state, parameters, impact: field }: ToolStageContext): void {
  const affinity = numberParameter(parameters, 'creviceAffinity', 1.3)
  forEachImpact(field, state.w, ({ index, x, y }) => {
    const local = (y - field.y0) * field.bw + (x - field.x0)
    const crevice = clamp01(-state.height[index] * 0.6 + state.weak[index] * 0.5 + state.fiber[index] * 0.3)
    field.coverage[local] *= 1 + crevice * affinity
  })
}

function paint({ state, op, parameters, impact: field }: ToolStageContext): void {
  const pressure = numberParameter(parameters, 'pressure', 0.5)
  const greaseAmount = numberParameter(parameters, 'grease', 0.35)
  forEachImpact(field, state.w, ({ index, x, y, coverage }) => {
    if (!alive(state, index)) return
    const amount = clamp01(coverage * pressure)
    addDust(state, index, amount * (0.45 + greaseAmount * 0.25))
    const grease = fbm(x * 0.04, y * 0.04, op.seed)
    multiplyRgb(state, index, 1 - grease * amount * greaseAmount)
    desaturate(state, index, grease * amount * 0.3)
    state.gloss[index] = clamp01(state.gloss[index] + grease * amount * 0.12)
    warm(state, index, amount * 0.4)
  })
}

function texture({ state, op, parameters, impact: field }: ToolStageContext): void {
  const pressure = numberParameter(parameters, 'pressure', 0.5)
  const frequency = numberParameter(parameters, 'fingerprintFrequency', 0.35)
  forEachImpact(field, state.w, ({ index, x, y, coverage }) => {
    if (!alive(state, index)) return
    const amount = clamp01(coverage * pressure)
    const ridge = Math.sin((x + y) * frequency + fbm(x * 0.1, y * 0.1, op.seed + 2) * 8)
    if (ridge > 0.7) multiplyRgb(state, index, 1 - amount * 0.12)
  })
}

function variability({ state, op, parameters, impact: field }: ToolStageContext): void {
  const pressure = numberParameter(parameters, 'pressure', 0.5)
  const grit = numberParameter(parameters, 'grit', 0.5)
  const dustRate = numberParameter(parameters, 'dustRate', 0.05)
  forEachImpact(field, state.w, ({ index, x, y, coverage }) => {
    if (!alive(state, index)) return
    const amount = clamp01(coverage * pressure)
    if (hash2(x, y, op.seed + 5) > 1 - dustRate * (0.5 + grit) * amount) addRgb(state, index, 30)
  })
}

export const dirtEngine: PhysicalToolEngine = {
  id: 'dirt',
  defaults: dirtDefaults,
  controls: dirtControls,
  cursor: (parameters) => {
    const radius = numberParameter(parameters, 'size', 38)
    return { kind: 'dots', radius, length: radius, width: radius, angle: 0, color: '#e0913f' }
  },
  modules: {
    impact,
    interactions,
    paper: emptyStage,
    paint,
    texture,
    variability,
    render: ({ impact: field }) => impactBounds(field),
  },
  dynamics: () => ({ steps: 4, spread: 5 }),
}

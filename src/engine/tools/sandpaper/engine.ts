import type { PhysicalToolEngine, ToolStageContext } from '../core/contracts'
import { forEachImpact, impactBounds, rasterizeDabPath, smoothStep } from '../core/geometry'
import { addRgb, alive, clamp01, desaturate, exposePaper } from '../core/material'
import { numberParameter } from '../core/parameters'
import { hash2, valueNoise } from '@/engine/sheet/state'
import { sandpaperControls, sandpaperDefaults } from './parameters'

const impact: PhysicalToolEngine['modules']['impact'] = (state, op, parameters) => {
  const size = numberParameter(parameters, 'size', 42)
  const angle = numberParameter(parameters, 'angle', 90) * Math.PI / 180
  const randomness = numberParameter(parameters, 'randomness', 0.4)
  const aspect = numberParameter(parameters, 'padAspect', 0.85)
  return rasterizeDabPath(op.points, state.w, state.h, op.seed, {
    length: size,
    width: size * aspect,
    spacing: size * 0.4,
    scatter: size * 0.15,
    count: 1,
    sizeJitter: 0.2,
    orientation: 'stroke',
    angle,
    randomness,
    mask: (along, across, x, y, seed) => {
      const rectangle = smoothStep(1, 0.6, Math.abs(along)) * smoothStep(1, 0.5, Math.abs(across))
      const grain = 0.5 + 0.5 * valueNoise(x * 0.5, y * 0.5, seed + 2)
      return rectangle * grain
    },
  })
}

function interactions({ state, op, parameters, impact: field }: ToolStageContext): void {
  const randomness = numberParameter(parameters, 'randomness', 0.4)
  forEachImpact(field, state.w, ({ index, x, y }) => {
    const local = (y - field.y0) * field.bw + (x - field.x0)
    const softness = 1 + state.wet[index] * 0.9 + state.weak[index] * 0.7
    field.coverage[local] *= softness * (1 - randomness * hash2(x, y, op.seed + 11))
  })
}

function paper({ state, parameters, impact: field }: ToolStageContext): void {
  const pressure = numberParameter(parameters, 'pressure', 0.6)
  const fiberLift = numberParameter(parameters, 'fiberLift', 0.55)
  forEachImpact(field, state.w, ({ index, coverage }) => {
    if (!alive(state, index)) return
    const wear = coverage * pressure * 0.5
    const priorWear = clamp01(state.fiber[index] + (1 - state.ink[index]) * 0.5)
    exposePaper(state, index, clamp01(wear * (0.5 + 0.9 * priorWear)))
    state.fiber[index] = clamp01(state.fiber[index] + wear * fiberLift * (1.4 - state.ink[index]))
    state.weak[index] = clamp01(state.weak[index] + wear * 0.2)
    state.roughness[index] = clamp01(state.roughness[index] + wear * 0.45)
    state.paint[index] = Math.max(0, state.paint[index] - wear * 0.7)
    state.film[index] = Math.max(0, state.film[index] - wear * 0.55)
    state.adhesive[index] = Math.max(0, state.adhesive[index] - wear * 0.35)
    state.dust[index] = clamp01(state.dust[index] + wear * 0.18)
  })
}

function paint({ state, parameters, impact: field }: ToolStageContext): void {
  const pressure = numberParameter(parameters, 'pressure', 0.6)
  const inkRemoval = numberParameter(parameters, 'inkRemoval', 0.9)
  forEachImpact(field, state.w, ({ index, coverage }) => {
    if (!alive(state, index)) return
    const wear = coverage * pressure * 0.5
    state.ink[index] = Math.max(0, state.ink[index] - wear * inkRemoval)
    desaturate(state, index, wear * 0.2)
  })
}

function texture({ state, op, parameters, impact: field }: ToolStageContext): void {
  const pressure = numberParameter(parameters, 'pressure', 0.6)
  forEachImpact(field, state.w, ({ index, x, y, coverage }) => {
    if (!alive(state, index)) return
    const wear = coverage * pressure * 0.5
    addRgb(state, index, (valueNoise(x * 1.7, y * 1.7, op.seed + 5) - 0.4) * state.fiber[index] * 22)
    state.height[index] -= wear * 0.14
  })
}

function variability({ state, parameters, impact: field }: ToolStageContext): void {
  const threshold = numberParameter(parameters, 'cutThreshold', 0.92)
  forEachImpact(field, state.w, ({ index }) => {
    if (!alive(state, index)) return
    if (state.height[index] < -threshold + state.weak[index] * 0.35) state.rgba[index * 4 + 3] = 0
  })
}

export const sandpaperEngine: PhysicalToolEngine = {
  id: 'sandpaper',
  defaults: sandpaperDefaults,
  controls: sandpaperControls,
  cursor: (parameters) => {
    const radius = numberParameter(parameters, 'size', 42)
    return {
      kind: 'pad',
      radius,
      length: radius,
      width: radius * numberParameter(parameters, 'padAspect', 0.85),
      angle: numberParameter(parameters, 'angle', 90),
      color: '#e0913f',
    }
  },
  modules: { impact, interactions, paper, paint, texture, variability, render: ({ impact: field }) => impactBounds(field) },
  dynamics: () => ({ steps: 2, spread: 2 }),
}

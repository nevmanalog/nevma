import type { PhysicalToolEngine, ToolStageContext } from '../core/contracts'
import { emptyStage } from '../core/contracts'
import { forEachImpact, impactBounds, rasterizeRibbon } from '../core/geometry'
import { alive, clamp01, depositPigment } from '../core/material'
import { numberParameter, stringParameter } from '../core/parameters'
import { hash2, hexToRgb, lerp, valueNoise } from '@/engine/sheet/state'
import { pencilControls, pencilDefaults } from './parameters'

const impact: PhysicalToolEngine['modules']['impact'] = (state, op, parameters) => {
  const size = numberParameter(parameters, 'size', 5)
  return rasterizeRibbon(op.points, state.w, state.h, {
    halfWidth: Math.max(0.8, size * 0.5),
    softness: 0.18,
    taper: size * 0.3,
    smoothing: 1.5,
  })
}

function interactions({ state, impact: field }: ToolStageContext): void {
  forEachImpact(field, state.w, ({ index, x, y }) => {
    const local = (y - field.y0) * field.bw + (x - field.x0)
    // Graphite slides off wet paper.
    field.coverage[local] *= 1 - state.wet[index] * 0.7
  })
}

function paint({ state, op, parameters, impact: field }: ToolStageContext): void {
  const pressure = clamp01(numberParameter(parameters, 'pressure', 0.55))
  const grit = numberParameter(parameters, 'grit', 0.55)
  const toothScale = numberParameter(parameters, 'toothScale', 1.7)
  const hardness = clamp01(numberParameter(parameters, 'hardness', 0.4))
  const speedSensitivity = numberParameter(parameters, 'speedSensitivity', 0.28)
  const color = hexToRgb(stringParameter(parameters, 'color', '#2b2927'))
  forEachImpact(field, state.w, ({ index, x, y, coverage, speed }) => {
    if (!alive(state, index)) return
    // Multi-scale paper tooth: graphite is scraped off onto the raised fibres
    // and skips the valleys, which is where the grain of a pencil line comes from.
    const tooth = 0.5 * valueNoise(x * toothScale, y * toothScale, op.seed)
      + 0.3 * valueNoise(x * toothScale * 2.3, y * toothScale * 2.3, op.seed + 9)
      + 0.2 * state.roughness[index]
    // A harder lead, and lighter pressure, only reach the highest peaks.
    const effPressure = pressure * (1 - hardness * 0.4)
    const threshold = 0.62 - effPressure * (0.45 + grit * 0.2)
    const reveal = clamp01((tooth - threshold) / (0.34 - hardness * 0.12))
    const grain = 0.55 + 0.45 * hash2(x, y, op.seed + 5)
    const density = lerp(1, 1 - speedSensitivity, speed)
    // Graphite can only darken so far, and a harder lead tops out lighter; once
    // the tooth is full extra passes add little (a natural light-to-dark range).
    const buildRoom = 1 - clamp01(state.paint[index] / (0.55 - hardness * 0.2)) * 0.7
    const amount = clamp01(
      coverage * reveal * grain * (0.2 + 0.9 * pressure) * density * buildRoom,
    )
    if (amount <= 0.004) return
    depositPigment(state, index, color, amount, {
      liquid: 0,
      solubility: 0.02,
      thickness: 0.06 + pressure * 0.05,
    })
    state.ink[index] = clamp01(state.ink[index] + amount * 0.5)
    // Pressing hard burnishes the tooth flat and presses a faint groove into the
    // sheet.
    const burnish = clamp01(pressure - 0.6) * coverage
    state.roughness[index] = clamp01(state.roughness[index] * (1 - burnish * 0.25))
    state.height[index] -= coverage * pressure * (0.03 + (1 - hardness) * 0.02)
  })
}

function texture({ state, parameters, impact: field }: ToolStageContext): void {
  const sheen = numberParameter(parameters, 'graphiteSheen', 0.18)
  const hardness = clamp01(numberParameter(parameters, 'hardness', 0.4))
  const pressure = numberParameter(parameters, 'pressure', 0.55)
  forEachImpact(field, state.w, ({ index, coverage }) => {
    if (!alive(state, index)) return
    // Dense, hard graphite takes on the characteristic metallic sheen.
    const shine = coverage * sheen * (0.6 + hardness * 0.6) * pressure * clamp01(state.paint[index] * 3)
    state.gloss[index] = clamp01(state.gloss[index] + shine)
  })
}

export const pencilEngine: PhysicalToolEngine = {
  id: 'pencil',
  defaults: pencilDefaults,
  controls: pencilControls,
  cursor: (parameters) => {
    const radius = numberParameter(parameters, 'size', 5)
    return {
      kind: 'pencil',
      radius,
      length: radius,
      width: radius,
      angle: 0,
      color: stringParameter(parameters, 'color', '#2b2927'),
    }
  },
  modules: {
    impact,
    interactions,
    paper: emptyStage,
    paint,
    texture,
    variability: emptyStage,
    render: ({ impact: field }) => impactBounds(field),
  },
  dynamics: () => ({ steps: 1, spread: 1 }),
}

import type { PhysicalToolEngine, ToolStageContext } from '../core/contracts'
import { emptyStage } from '../core/contracts'
import { forEachImpact, impactBounds, rasterizeDabPath, smoothStep } from '../core/geometry'
import { addAdhesive, addFilm, addRgb, alive, clamp01, depositColor, multiplyRgb } from '../core/material'
import { numberParameter, stringParameter } from '../core/parameters'
import { fbm, hexToRgb, valueNoise } from '@/engine/sheet/state'
import { tapeControls, tapeDefaults } from './parameters'

// Trapped-air pockets: low-frequency noise thresholded into rounded blobs so
// bubbles read as pockets rather than speckle. Shared by every stage so the
// optical, adhesive and relief responses of one bubble stay consistent.
function bubbleAt(x: number, y: number, seed: number, rate: number): number {
  if (rate <= 0) return 0
  const field = fbm(x * 0.06, y * 0.06, seed + 1)
  return clamp01((field - (1 - rate)) / Math.max(0.001, rate))
}

// Diagonal creases where the tape did not lay flat.
function creaseAt(x: number, y: number, seed: number, rate: number): number {
  if (rate <= 0) return 0
  const w = valueNoise(x * 0.05 + y * 0.22, y * 0.06, seed + 5)
  return w > 1 - rate ? (w - (1 - rate)) / rate : 0
}

const impact: PhysicalToolEngine['modules']['impact'] = (state, op, parameters) => {
  const size = numberParameter(parameters, 'size', 34)
  return rasterizeDabPath(op.points, state.w, state.h, op.seed, {
    length: size * 0.7,
    width: size,
    spacing: size * 0.2,
    scatter: 0,
    count: 1,
    sizeJitter: 0,
    orientation: 'stroke',
    angle: numberParameter(parameters, 'angle', 0) * Math.PI / 180,
    randomness: 0,
    mask: (along, across) => smoothStep(1, 0.82, Math.abs(along)) * smoothStep(1, 0.9, Math.abs(across)),
  })
}

function interactions({ state, op, parameters, impact: field }: ToolStageContext): void {
  const bubbleRate = numberParameter(parameters, 'bubbleRate', 0.34)
  const adhesiveDarkening = numberParameter(parameters, 'adhesiveDarkening', 0.05)
  const gloss = numberParameter(parameters, 'gloss', 0.4)
  forEachImpact(field, state.w, ({ index, x, y, coverage }) => {
    if (!alive(state, index)) return
    // The whole strip is an impermeable plastic film sitting on the surface.
    addFilm(state, index, coverage * 0.85)
    const bubble = bubbleAt(x, y, op.seed, bubbleRate)
    if (bubble > 0.15) {
      // Trapped air: the adhesive never wetted out here, so the print looks
      // slightly detached and the pocket flashes a silvery highlight.
      addRgb(state, index, 10 * bubble * coverage)
      state.gloss[index] = clamp01(state.gloss[index] + (gloss + 0.35) * bubble * coverage)
    } else {
      // Wetted-out adhesive contact: a faint darkening and a glossy bond that
      // holds relief and seals whatever is underneath.
      multiplyRgb(state, index, 1 - adhesiveDarkening * coverage)
      addAdhesive(state, index, coverage * 0.12)
      state.gloss[index] = clamp01(state.gloss[index] + gloss * coverage)
    }
  })
}

function paint({ state, parameters, impact: field }: ToolStageContext): void {
  const tint = hexToRgb(stringParameter(parameters, 'color', '#eadfbd'))
  forEachImpact(field, state.w, ({ index, coverage, across }) => {
    if (!alive(state, index)) return
    // A barely-there warm plastic tint, then a deepening of the sealed print.
    depositColor(state, index, tint, 0.018 * coverage)
    multiplyRgb(state, index, 1 - 0.02 * coverage)
    // A bright specular reflection running lengthwise down the glossy strip,
    // offset from the centre the way light glances off real tape.
    const band = smoothStep(0.5, 0.12, Math.abs(across + 0.35))
    if (band > 0) {
      addRgb(state, index, band * coverage * 22)
      state.gloss[index] = clamp01(state.gloss[index] + band * coverage * 0.4)
    }
  })
}

function texture({ state, op, parameters, impact: field }: ToolStageContext): void {
  const thickness = numberParameter(parameters, 'filmThickness', 0.16)
  const wrinkleRate = numberParameter(parameters, 'wrinkleRate', 0.22)
  const bubbleRate = numberParameter(parameters, 'bubbleRate', 0.34)
  forEachImpact(field, state.w, ({ index, x, y, coverage, across }) => {
    if (!alive(state, index)) return
    const distance = Math.abs(across)
    // Base film thickness lifts the whole strip; the rolled edges stand higher.
    let h = thickness * 0.5 * coverage
    const rolled = smoothStep(0.82, 1, distance)
    h += rolled * thickness * 0.9 * coverage
    const crease = creaseAt(x, y, op.seed, wrinkleRate)
    h += crease * thickness * 1.4 * coverage
    const bubble = bubbleAt(x, y, op.seed, bubbleRate)
    h += bubble * thickness * 1.1 * coverage
    state.height[index] += h
    state.gloss[index] = clamp01(state.gloss[index] + (crease * 0.4 + rolled * 0.3) * coverage)
  })
}

function variability({ op, impact: field }: ToolStageContext): void {
  for (let localY = 0; localY < field.bh; localY++) {
    for (let localX = 0; localX < field.bw; localX++) {
      const index = localY * field.bw + localX
      const x = field.x0 + localX
      const y = field.y0 + localY
      const edgeNoise = valueNoise(x * 0.4, y * 0.4, op.seed + 3)
      field.coverage[index] *= clamp01(0.9 + (edgeNoise - 0.5) * 0.2)
    }
  }
}

export const tapeEngine: PhysicalToolEngine = {
  id: 'tape',
  defaults: tapeDefaults,
  controls: tapeControls,
  cursor: (parameters) => {
    const radius = numberParameter(parameters, 'size', 34)
    return {
      kind: 'band',
      radius,
      length: radius * 0.7,
      width: radius,
      angle: numberParameter(parameters, 'angle', 0),
      color: stringParameter(parameters, 'color', '#eadfbd'),
    }
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
  dynamics: () => ({ steps: 3, spread: 3 }),
}

import type { PhysicalToolEngine, ToolStageContext } from '../core/contracts'
import { emptyStage } from '../core/contracts'
import { forEachImpact, impactBounds, rasterizeRibbon, smoothStep } from '../core/geometry'
import { alive, clamp01, depositPigment, PAPER_ABSORPTION } from '../core/material'
import { numberParameter, stringParameter } from '../core/parameters'
import { fbm, hash2, hexToRgb, lerp, valueNoise } from '@/engine/sheet/state'
import { paintbrushControls, paintbrushDefaults } from './parameters'

const impact: PhysicalToolEngine['modules']['impact'] = (state, op, parameters) => {
  const size = numberParameter(parameters, 'size', 28)
  return rasterizeRibbon(op.points, state.w, state.h, {
    halfWidth: Math.max(1.2, size * 0.7),
    softness: 0.42,
    taper: size * 1.1,
    smoothing: 1.5,
  })
}

function interactions({ state, impact: field }: ToolStageContext): void {
  const absorption = PAPER_ABSORPTION[state.paperType] ?? 0.55
  forEachImpact(field, state.w, ({ index, x, y }) => {
    const local = (y - field.y0) * field.bw + (x - field.x0)
    // a wet or filmed surface repels a fresh loaded stroke; bare porous stock
    // grabs more of the bristle contact.
    field.coverage[local] *= 0.82 + absorption * 0.18 * (1 - state.gloss[index] * 0.4)
  })
}

function paint({ state, op, parameters, impact: field }: ToolStageContext): void {
  const pressure = numberParameter(parameters, 'pressure', 0.65)
  const paintLoad = numberParameter(parameters, 'paintLoad', 0.8)
  const bristles = Math.max(3, numberParameter(parameters, 'bristleCount', 9))
  const randomness = numberParameter(parameters, 'randomness', 0.35)
  const wet = numberParameter(parameters, 'wetSheen', 0.35)
  const blend = numberParameter(parameters, 'blend', 0.4)
  const impasto = numberParameter(parameters, 'impasto', 0.7)
  const absorption = PAPER_ABSORPTION[state.paperType] ?? 0.55
  const color = hexToRgb(stringParameter(parameters, 'color', '#3d2418'))
  forEachImpact(field, state.w, ({ index, x, y, coverage, along, across, speed }) => {
    if (!alive(state, index)) return
    const p = index * 4
    const rim = Math.abs(across)
    // Separate bristles running lengthwise down the stroke. Each bristle carries
    // a different amount of paint and some are splayed away, leaving the streaky
    // channels of a real loaded brush instead of a flat band.
    const bristleId = Math.floor((across * 0.5 + 0.5) * bristles)
    const bristleLoad = 0.35 + 0.65 * hash2(bristleId, 3, op.seed + 11)
    const missing = hash2(bristleId, 17, op.seed + 5) < randomness * 0.35 ? 0.12 : 1
    // Paint runs out along the stroke: heavy at the start, dry-brushing at the
    // tail. A faster pass lays down less.
    const dry = (1 - paintLoad) * 0.8 + 0.15
    const carry = clamp01(paintLoad * 1.2 - along * dry - speed * 0.25)
    // When nearly dry the brush only catches on the raised paper tooth.
    const tooth = 0.5 * valueNoise(x * 0.7, y * 0.7, op.seed) + 0.5 * state.roughness[index]
    const dryBrush = carry < 0.5 ? clamp01((tooth - (0.5 - carry)) / 0.4) : 1
    const body = 0.82 + 0.18 * fbm(x * 0.15, y * 0.15, op.seed + 2)
    // Pigment piles up along the bristle edges (a coffee-ring rim).
    const edgeBuild = 1 + smoothStep(0.75, 1, rim) * 0.5
    const amount = clamp01(
      coverage * (0.4 + 0.6 * pressure) * carry * bristleLoad * missing * dryBrush * body * edgeBuild,
    )
    if (amount <= 0.003) return
    const paperSink = clamp01(absorption * state.porosity[index] * (1 - state.film[index] * 0.95))
    // Wet-in-wet blending: while the surface is still wet or freshly painted the
    // stroke drags the colour beneath it into the new deposit.
    const wetness = clamp01(state.water[index] + state.wet[index] * 0.5 + state.paint[index] * 0.4)
    const mix = clamp01(blend * wetness)
    const mixColor: [number, number, number] = [
      lerp(color[0], state.rgba[p], mix),
      lerp(color[1], state.rgba[p + 1], mix),
      lerp(color[2], state.rgba[p + 2], mix),
    ]
    depositPigment(state, index, mixColor, amount, {
      liquid: 0.12 + paperSink * 0.28 + wet * 0.5,
      solubility: 0.32 + wet * 0.4,
      thickness: 0.08 + (1 - paperSink) * 0.28 + impasto * 0.14,
    })
    state.ink[index] = clamp01(state.ink[index] + amount * (0.5 + paperSink * 0.3))
  })
}

function texture({ state, parameters, impact: field }: ToolStageContext): void {
  const impasto = numberParameter(parameters, 'impasto', 0.7)
  const wet = numberParameter(parameters, 'wetSheen', 0.35)
  forEachImpact(field, state.w, ({ index, coverage, across, speed }) => {
    if (!alive(state, index)) return
    const load = lerp(1, 0.55, speed)
    const surfaceLayer = clamp01((state.paint[index] - 0.3) / 0.7)
    // Bristle furrows: the ridges left between strands stand slightly higher.
    const ridge = 1 + smoothStep(0.7, 1, Math.abs(across)) * 0.6
    state.height[index] += coverage * surfaceLayer * surfaceLayer * impasto * load * ridge * 0.16
    state.gloss[index] = clamp01(state.gloss[index] + coverage * wet * 0.4)
  })
}

export const paintbrushEngine: PhysicalToolEngine = {
  id: 'brush',
  defaults: paintbrushDefaults,
  controls: paintbrushControls,
  cursor: (parameters) => {
    const radius = numberParameter(parameters, 'size', 28)
    return {
      kind: 'bristle',
      radius,
      length: radius,
      width: radius * 0.7,
      angle: 0,
      color: stringParameter(parameters, 'color', '#3d2418'),
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
  dynamics: (parameters) => ({
    steps: 6,
    spread: numberParameter(parameters, 'size', 28)
      * (0.12 + numberParameter(parameters, 'wetSheen', 0.35) * 0.4),
    mobility: 0.4 + numberParameter(parameters, 'wetSheen', 0.35) * 0.6
      + numberParameter(parameters, 'blend', 0.4) * 0.3,
    evaporation: 0.7,
    tideStrength: 0.14,
  }),
}

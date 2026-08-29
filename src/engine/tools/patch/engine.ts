import type { PhysicalToolEngine, ToolStageContext } from '../core/contracts'
import { emptyStage } from '../core/contracts'
import { forEachImpact, impactBounds, rasterizeDabPath, smoothStep } from '../core/geometry'
import { addAdhesive, alive, clamp, clamp01, lerp, multiplyRgb } from '../core/material'
import { numberParameter } from '../core/parameters'
import { fbm, hash2, valueNoise } from '@/engine/sheet/state'
import { patchControls, patchDefaults } from './parameters'

function patchGesture(op: ToolStageContext['op'], size: number) {
  const startX = op.points[0] ?? 0
  const startY = op.points[1] ?? 0
  const endIndex = Math.max(0, op.points.length - 2)
  const endX = op.points[endIndex] ?? startX
  const endY = op.points[endIndex + 1] ?? startY
  const dx = endX - startX
  const dy = endY - startY
  const distance = Math.hypot(dx, dy)
  const angle = distance > 2 ? Math.atan2(dy, dx) : 0
  return {
    centerX: (startX + endX) * 0.5,
    centerY: (startY + endY) * 0.5,
    halfLength: distance > 2 ? Math.max(2, distance * 0.5) : size * 0.5,
    halfWidth: size * 0.36,
    angle,
  }
}

const impact: PhysicalToolEngine['modules']['impact'] = (state, op, parameters) => {
  const size = numberParameter(parameters, 'size', 52)
  const geometry = patchGesture(op, size)
  return rasterizeDabPath([geometry.centerX, geometry.centerY], state.w, state.h, op.seed, {
    length: geometry.halfLength,
    width: geometry.halfWidth,
    spacing: geometry.halfLength,
    scatter: 0,
    count: 1,
    sizeJitter: 0,
    orientation: 'fixed',
    angle: geometry.angle,
    randomness: 0,
    mask: (along, across, x, y, seed) => {
      const edgeDistance = Math.max(Math.abs(along), Math.abs(across))
      const edgeNoise = valueNoise(x * 0.34, y * 0.34, seed + 7)
      const notch = edgeNoise > 0.82 ? (edgeNoise - 0.82) * 0.3 : 0
      const edge = 0.96 - notch
      return smoothStep(edge + 0.075, edge - 0.075, edgeDistance)
    },
  })
}

function paper({ state, op, parameters, impact: field }: ToolStageContext): void {
  const size = numberParameter(parameters, 'size', 52)
  const geometry = patchGesture(op, size)
  const cos = Math.cos(geometry.angle)
  const sin = Math.sin(geometry.angle)
  const warmth = numberParameter(parameters, 'stockWarmth', 0.5)
  const fiberScale = numberParameter(parameters, 'fiberScale', 0.5)
  const edgeTear = numberParameter(parameters, 'edgeTear', 0.28)
  const originX = op.points[0] ?? 0
  const originY = op.points[1] ?? 0
  const variation = (hash2(originX | 0, originY | 0, op.seed) - 0.5) * 26
  const base: [number, number, number] = [
    238 + variation + warmth * 5,
    234 + variation + warmth * 2,
    224 + variation * 0.8 - warmth * 3,
  ]
  forEachImpact(field, state.w, ({ index, x, y, coverage }) => {
    const boundary = clamp01(coverage + (valueNoise(x * 0.35, y * 0.35, op.seed + 17) - 0.5) * edgeTear * 0.12)
    const paperCoverage = smoothStep(0.08, 0.62, boundary)
    if (paperCoverage <= 0.01) return
    const localX = (x - geometry.centerX) * cos + (y - geometry.centerY) * sin
    const localY = -(x - geometry.centerX) * sin + (y - geometry.centerY) * cos
    const grain = (valueNoise(localX * 0.5, localY * 0.5, op.seed) - 0.5) * 18
    const fiber = (valueNoise(localX * 0.12, localY * 2.4, op.seed + 4) - 0.5) * 12 * fiberScale
    const underlay = clamp01(Math.max(0, state.height[index]) * 0.45 + state.adhesive[index] * 0.5)
    const p = index * 4
    const paperR = clamp(base[0] + grain + fiber - underlay * 4, 0, 255)
    const paperG = clamp(base[1] + grain + fiber - underlay * 3, 0, 255)
    const paperB = clamp(base[2] + grain + fiber - underlay * 2, 0, 255)
    state.rgba[p] = lerp(state.rgba[p], paperR, paperCoverage)
    state.rgba[p + 1] = lerp(state.rgba[p + 1], paperG, paperCoverage)
    state.rgba[p + 2] = lerp(state.rgba[p + 2], paperB, paperCoverage)
    state.rgba[p + 3] = 255
    state.paper[p] = lerp(state.paper[p], paperR, paperCoverage)
    state.paper[p + 1] = lerp(state.paper[p + 1], paperG, paperCoverage)
    state.paper[p + 2] = lerp(state.paper[p + 2], paperB, paperCoverage)
    state.ink[index] *= 1 - paperCoverage
    state.water[index] *= 1 - paperCoverage
    state.wet[index] *= 1 - paperCoverage
    state.mobileR[index] *= 1 - paperCoverage
    state.mobileG[index] *= 1 - paperCoverage
    state.mobileB[index] *= 1 - paperCoverage
    state.paint[index] *= 1 - paperCoverage
    state.solubility[index] *= 1 - paperCoverage
    state.porosity[index] = lerp(state.porosity[index], clamp01(0.48 + fiberScale * 0.24), paperCoverage)
    state.fiberAngle[index] = lerp(state.fiberAngle[index], geometry.angle, paperCoverage)
    state.roughness[index] = lerp(state.roughness[index], clamp01(0.35 + fiberScale * 0.3), paperCoverage)
    state.fiber[index] = lerp(
      state.fiber[index],
      clamp01(0.2 + valueNoise(x * 0.2, y * 0.2, op.seed + 9) * 0.2),
      paperCoverage,
    )
    state.gloss[index] *= 1 - paperCoverage
    state.weak[index] *= 1 - paperCoverage
    state.film[index] *= 1 - paperCoverage
    state.adhesive[index] *= 1 - paperCoverage
    state.dust[index] *= 1 - paperCoverage
    state.temperature[index] *= 1 - paperCoverage
    state.char[index] *= 1 - paperCoverage
  })
}

function interactions({ state, parameters, impact: field }: ToolStageContext): void {
  const sheen = numberParameter(parameters, 'adhesiveSheen', 0.15)
  const shadowStrength = numberParameter(parameters, 'shadow', 0.22)
  if (shadowStrength > 0) {
    const reach = 4
    for (let localY = 0; localY < field.bh; localY++) {
      for (let localX = 0; localX < field.bw; localX++) {
        if (field.coverage[localY * field.bw + localX] > 0.05) continue
        let nearest = 0
        for (let dy = -reach; dy <= reach; dy++) {
          const sy = localY - 1 + dy
          if (sy < 0 || sy >= field.bh) continue
          for (let dx = -reach; dx <= reach; dx++) {
            const sx = localX - 1 + dx
            if (sx < 0 || sx >= field.bw) continue
            if (field.coverage[sy * field.bw + sx] <= 0.35) continue
            const falloff = 1 - Math.hypot(dx, dy) / (reach + 1)
            if (falloff > nearest) nearest = falloff
          }
        }
        if (nearest <= 0) continue
        const index = (field.y0 + localY) * state.w + (field.x0 + localX)
        if (!alive(state, index)) continue
        const support = clamp01(Math.max(0, state.height[index]) * 0.35 + state.adhesive[index] * 0.5)
        multiplyRgb(state, index, 1 - nearest * nearest * shadowStrength * (0.78 + support * 0.35))
      }
    }
  }
  forEachImpact(field, state.w, ({ index, coverage }) => {
    if (!alive(state, index)) return
    if (coverage > 0.2) state.gloss[index] = clamp01(state.gloss[index] + sheen * coverage)
  })
}

function texture({ state, parameters, impact: field }: ToolStageContext): void {
  const thickness = numberParameter(parameters, 'thickness', 0.6)
  const sheen = numberParameter(parameters, 'adhesiveSheen', 0.15)
  forEachImpact(field, state.w, ({ index, coverage }) => {
    const paperCoverage = smoothStep(0.08, 0.62, coverage)
    if (!alive(state, index) || paperCoverage <= 0.01) return
    const support = clamp01(Math.max(0, state.height[index]) * 0.4 + state.adhesive[index])
    addAdhesive(state, index, sheen * paperCoverage * 0.18)
    state.height[index] += thickness * paperCoverage * (1 + support * 0.18)
  })
}

function variability({ state, op, impact: field }: ToolStageContext): void {
  forEachImpact(field, state.w, ({ index, x, y, coverage }) => {
    if (coverage > 0.12 && coverage < 0.62) {
      const lifted = valueNoise(x * 0.6, y * 0.6, op.seed + 11)
      state.fiber[index] = clamp01(state.fiber[index] + lifted * coverage * 0.08)
      state.height[index] += lifted > 0.9 ? 0.025 : 0
    } else if (coverage >= 0.62 && fbm(x * 0.1, y * 0.1, op.seed + 13) > 0.6) {
      state.gloss[index] = clamp01(state.gloss[index] + 0.06)
    }
  })
}

export const patchEngine: PhysicalToolEngine = {
  id: 'patch',
  defaults: patchDefaults,
  controls: patchControls,
  cursor: (parameters) => {
    const size = numberParameter(parameters, 'size', 52)
    return {
      kind: 'sheet',
      radius: size * 0.5,
      length: size * 0.5,
      width: size * 0.36,
      angle: 0,
      color: '#e0913f',
    }
  },
  modules: {
    impact,
    interactions,
    paper,
    paint: emptyStage,
    texture,
    variability,
    render: ({ impact: field }) => impactBounds(field),
  },
  dynamics: () => ({ steps: 4, spread: 4 }),
}

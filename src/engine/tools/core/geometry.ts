import { clamp, hash2 } from '@/engine/sheet/state'
import type { BBox } from './contracts'

export interface ImpactField {
  x0: number
  y0: number
  bw: number
  bh: number
  coverage: Float32Array
  along: Float32Array
  across: Float32Array
  speed: Float32Array
}

export interface ImpactSample {
  index: number
  x: number
  y: number
  coverage: number
  along: number
  across: number
  speed: number
}

export interface DabGeometry {
  length: number
  width: number
  spacing: number
  scatter: number
  count: number
  sizeJitter: number
  orientation: 'stroke' | 'fixed'
  angle: number
  randomness: number
  mask: (along: number, across: number, x: number, y: number, seed: number) => number
}

interface Center {
  x: number
  y: number
  ux: number
  uy: number
}

const emptyField = (x0 = 0, y0 = 0): ImpactField => ({
  x0,
  y0,
  bw: 0,
  bh: 0,
  coverage: new Float32Array(),
  along: new Float32Array(),
  across: new Float32Array(),
  speed: new Float32Array(),
})

function pathCenters(points: number[], step: number, angle: number): Center[] {
  const fixedX = Math.cos(angle)
  const fixedY = Math.sin(angle)
  if (points.length < 2) return []
  if (points.length === 2) return [{ x: points[0], y: points[1], ux: fixedX, uy: fixedY }]
  const result: Center[] = []
  for (let i = 0; i < points.length - 2; i += 2) {
    const ax = points[i]
    const ay = points[i + 1]
    const bx = points[i + 2]
    const by = points[i + 3]
    const distance = Math.hypot(bx - ax, by - ay) || 1
    const ux = (bx - ax) / distance
    const uy = (by - ay) / distance
    const count = Math.max(1, Math.ceil(distance / step))
    for (let sample = 0; sample < count; sample++) {
      const t = sample / count
      result.push({ x: ax + (bx - ax) * t, y: ay + (by - ay) * t, ux, uy })
    }
  }
  const n = points.length
  const dx = points[n - 2] - points[n - 4]
  const dy = points[n - 1] - points[n - 3]
  const distance = Math.hypot(dx, dy) || 1
  result.push({ x: points[n - 2], y: points[n - 1], ux: dx / distance, uy: dy / distance })
  return result
}

export function rasterizeDabPath(points: number[], width: number, height: number, seed: number, geometry: DabGeometry): ImpactField {
  if (points.length < 2) return emptyField()
  const extent = Math.max(geometry.length, geometry.width) * (1 + geometry.sizeJitter)
    + geometry.scatter * (0.5 + geometry.randomness) + 2
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (let i = 0; i < points.length; i += 2) {
    minX = Math.min(minX, points[i])
    minY = Math.min(minY, points[i + 1])
    maxX = Math.max(maxX, points[i])
    maxY = Math.max(maxY, points[i + 1])
  }
  const x0 = Math.max(0, Math.floor(minX - extent))
  const y0 = Math.max(0, Math.floor(minY - extent))
  const x1 = Math.min(width - 1, Math.ceil(maxX + extent))
  const y1 = Math.min(height - 1, Math.ceil(maxY + extent))
  const bw = Math.max(0, x1 - x0 + 1)
  const bh = Math.max(0, y1 - y0 + 1)
  if (bw === 0 || bh === 0) return emptyField(x0, y0)

  const coverage = new Float32Array(bw * bh)
  const along = new Float32Array(bw * bh)
  const across = new Float32Array(bw * bh)
  const speed = new Float32Array(bw * bh)
  const centers = pathCenters(points, Math.max(1, geometry.spacing), geometry.angle)
  const fixedX = Math.cos(geometry.angle)
  const fixedY = Math.sin(geometry.angle)
  let dab = 0

  for (const center of centers) {
    const axisX = geometry.orientation === 'stroke' ? center.ux : fixedX
    const axisY = geometry.orientation === 'stroke' ? center.uy : fixedY
    const normalX = -axisY
    const normalY = axisX
    for (let repeat = 0; repeat < geometry.count; repeat++) {
      dab++
      const scatter = geometry.scatter * (0.5 + geometry.randomness)
      const cx = center.x + (hash2(dab, 7, seed) - 0.5) * 2 * scatter
      const cy = center.y + (hash2(dab, 13, seed) - 0.5) * 2 * scatter
      const scale = 1 + (hash2(dab, 29, seed) - 0.5) * 2 * geometry.sizeJitter * (0.5 + geometry.randomness)
      const lx = Math.max(0.5, geometry.length * scale)
      const ly = Math.max(0.5, geometry.width * scale)
      const localX0 = Math.max(x0, Math.floor(cx - extent))
      const localX1 = Math.min(x1, Math.ceil(cx + extent))
      const localY0 = Math.max(y0, Math.floor(cy - extent))
      const localY1 = Math.min(y1, Math.ceil(cy + extent))
      for (let y = localY0; y <= localY1; y++) {
        for (let x = localX0; x <= localX1; x++) {
          const rx = (x - cx) * axisX + (y - cy) * axisY
          const ry = (x - cx) * normalX + (y - cy) * normalY
          const localAlong = rx / lx
          const localAcross = ry / ly
          if (Math.abs(localAlong) >= 1 || Math.abs(localAcross) >= 1) continue
          const value = geometry.mask(localAlong, localAcross, x, y, seed)
          if (value <= 0) continue
          const index = (y - y0) * bw + (x - x0)
          if (value > coverage[index]) {
            coverage[index] = value
            along[index] = localAlong
            across[index] = localAcross
          }
        }
      }
    }
  }
  return { x0, y0, bw, bh, coverage, along, across, speed }
}

interface RibbonOptions {
  halfWidth: number
  softness: number
  taper: number
  smoothing: number
}

interface PathSample {
  x: number
  y: number
  distance: number
  speed: number
}

function smoothPath(points: number[], spacing: number): PathSample[] {
  if (points.length < 2) return []
  const result: PathSample[] = []
  let total = 0
  let previousX = points[0]
  let previousY = points[1]
  result.push({ x: previousX, y: previousY, distance: 0, speed: 0 })
  for (let i = 0; i < points.length - 2; i += 2) {
    const ax = points[i]
    const ay = points[i + 1]
    const bx = points[i + 2]
    const by = points[i + 3]
    const segment = Math.hypot(bx - ax, by - ay) || 1
    const count = Math.max(1, Math.ceil(segment / spacing))
    for (let sample = 1; sample <= count; sample++) {
      const t = sample / count
      const x = ax + (bx - ax) * t
      const y = ay + (by - ay) * t
      const step = Math.hypot(x - previousX, y - previousY)
      total += step
      result.push({ x, y, distance: total, speed: clamp(step / Math.max(1, spacing * 2), 0, 1) })
      previousX = x
      previousY = y
    }
  }
  return result
}

export function rasterizeRibbon(points: number[], width: number, height: number, options: RibbonOptions): ImpactField {
  const samples = smoothPath(points, Math.max(0.8, options.smoothing))
  if (samples.length === 0) return emptyField()
  const extent = options.halfWidth + 2
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const sample of samples) {
    minX = Math.min(minX, sample.x)
    minY = Math.min(minY, sample.y)
    maxX = Math.max(maxX, sample.x)
    maxY = Math.max(maxY, sample.y)
  }
  const x0 = Math.max(0, Math.floor(minX - extent))
  const y0 = Math.max(0, Math.floor(minY - extent))
  const x1 = Math.min(width - 1, Math.ceil(maxX + extent))
  const y1 = Math.min(height - 1, Math.ceil(maxY + extent))
  const bw = Math.max(0, x1 - x0 + 1)
  const bh = Math.max(0, y1 - y0 + 1)
  if (bw === 0 || bh === 0) return emptyField(x0, y0)

  const coverage = new Float32Array(bw * bh)
  const along = new Float32Array(bw * bh)
  const across = new Float32Array(bw * bh)
  const speed = new Float32Array(bw * bh)
  const total = samples[samples.length - 1].distance

  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      let best = Infinity
      let bestAcross = 0
      let bestDistance = 0
      let bestSpeed = 0
      for (let i = 0; i < samples.length - 1; i++) {
        const a = samples[i]
        const b = samples[i + 1]
        const dx = b.x - a.x
        const dy = b.y - a.y
        const lengthSquared = dx * dx + dy * dy || 1
        const t = clamp(((x - a.x) * dx + (y - a.y) * dy) / lengthSquared, 0, 1)
        const qx = a.x + dx * t
        const qy = a.y + dy * t
        const px = x - qx
        const py = y - qy
        const distance = Math.hypot(px, py)
        if (distance >= best) continue
        const length = Math.sqrt(lengthSquared)
        best = distance
        bestAcross = (dx * py - dy * px >= 0 ? 1 : -1) * distance / options.halfWidth
        bestDistance = a.distance + (b.distance - a.distance) * t
        bestSpeed = a.speed + (b.speed - a.speed) * t
        if (length === 0) bestAcross = 0
      }
      if (best > options.halfWidth) continue
      const edgeStart = options.halfWidth * (1 - options.softness)
      const edge = best <= edgeStart ? 1 : 1 - (best - edgeStart) / Math.max(0.001, options.halfWidth - edgeStart)
      const startTaper = clamp(bestDistance / Math.max(0.001, options.taper), 0, 1)
      const endTaper = clamp((total - bestDistance) / Math.max(0.001, options.taper), 0, 1)
      const index = (y - y0) * bw + (x - x0)
      coverage[index] = edge * Math.min(startTaper, endTaper)
      along[index] = total <= 0 ? 0 : bestDistance / total
      across[index] = bestAcross
      speed[index] = bestSpeed
    }
  }
  return { x0, y0, bw, bh, coverage, along, across, speed }
}

export function forEachImpact(field: ImpactField, sheetWidth: number, callback: (sample: ImpactSample) => void): void {
  for (let localY = 0; localY < field.bh; localY++) {
    for (let localX = 0; localX < field.bw; localX++) {
      const localIndex = localY * field.bw + localX
      const coverage = field.coverage[localIndex]
      if (coverage <= 0) continue
      const x = field.x0 + localX
      const y = field.y0 + localY
      callback({
        index: y * sheetWidth + x,
        x,
        y,
        coverage,
        along: field.along[localIndex],
        across: field.across[localIndex],
        speed: field.speed[localIndex],
      })
    }
  }
}

export function impactBounds(field: ImpactField): BBox | null {
  if (field.bw === 0 || field.bh === 0) return null
  return {
    x0: field.x0,
    y0: field.y0,
    x1: field.x0 + field.bw - 1,
    y1: field.y0 + field.bh - 1,
  }
}

export function smoothStep(edge0: number, edge1: number, value: number): number {
  let t = (value - edge0) / (edge1 - edge0)
  t = clamp(t, 0, 1)
  return t * t * (3 - 2 * t)
}

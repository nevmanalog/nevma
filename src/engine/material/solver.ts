import type { PhysicalToolId } from '@/domain/types'
import { clamp, clamp01, lerp, type SheetState } from '@/engine/sheet/state'
import type { ImpactField } from '@/engine/tools/core/geometry'

export interface MaterialRegion {
  x0: number
  y0: number
  x1: number
  y1: number
}

export interface RelaxationOptions {
  steps: number
  spread: number
  tool: PhysicalToolId
  mobility?: number
  evaporation?: number
  tideStrength?: number
  // The operation's impact footprint. Only cells the operation actually touches
  // (its coverage, plus wherever its liquid genuinely diffuses) are evolved; the
  // rest of the sheet's already-settled material (aged moisture, stains, gloss)
  // is left frozen. Without this the solver re-settles inert baseline material
  // inside its rectangular working region only, leaving a visible rectangle.
  impact?: ImpactField
}

function depositSuspendedPigment(state: SheetState, index: number, fraction: number): void {
  const total = state.mobileR[index] + state.mobileG[index] + state.mobileB[index]
  if (total <= 0.000001 || fraction <= 0) return
  const mass = total / 3
  const p = index * 4
  const colorR = clamp(state.mobileR[index] / Math.max(mass, 0.000001) * 85, 0, 255)
  const colorG = clamp(state.mobileG[index] / Math.max(mass, 0.000001) * 85, 0, 255)
  const colorB = clamp(state.mobileB[index] / Math.max(mass, 0.000001) * 85, 0, 255)
  const amount = clamp01(mass * fraction * 1.8)
  state.rgba[p] = lerp(state.rgba[p], colorR, amount)
  state.rgba[p + 1] = lerp(state.rgba[p + 1], colorG, amount)
  state.rgba[p + 2] = lerp(state.rgba[p + 2], colorB, amount)
  const retained = 1 - clamp01(fraction)
  state.mobileR[index] *= retained
  state.mobileG[index] *= retained
  state.mobileB[index] *= retained
  state.paint[index] = clamp01(state.paint[index] + amount * 0.08)
}

export function relaxMaterial(
  state: SheetState,
  region: MaterialRegion,
  options: RelaxationOptions,
): MaterialRegion {
  const margin = Math.max(2, Math.ceil(options.spread))
  const x0 = Math.max(0, Math.floor(region.x0) - margin)
  const y0 = Math.max(0, Math.floor(region.y0) - margin)
  const x1 = Math.min(state.w - 1, Math.ceil(region.x1) + margin)
  const y1 = Math.min(state.h - 1, Math.ceil(region.y1) + margin)
  const bw = x1 - x0 + 1
  const bh = y1 - y0 + 1
  const count = bw * bh
  // Active mask: which region cells the operation is allowed to evolve. Seeded
  // from the impact coverage and grown only where the operation's own liquid
  // actually flows (see `transfer`/`connect`). Cells that stay inactive keep
  // their baseline material byte-for-byte, so no boundary rectangle can form.
  const active = new Uint8Array(count)
  // Bounds (global coords) of the initially-active cells. The per-step working
  // window is grown from these so settled inert baseline material outside the
  // impact is never scanned.
  let ax0 = x1, ay0 = y1, ax1 = x0, ay1 = y0
  const impact = options.impact
  if (impact) {
    for (let ly = 0; ly < impact.bh; ly++) {
      for (let lx = 0; lx < impact.bw; lx++) {
        if (impact.coverage[ly * impact.bw + lx] <= 0) continue
        const x = impact.x0 + lx
        const y = impact.y0 + ly
        if (x < x0 || x > x1 || y < y0 || y > y1) continue
        active[(y - y0) * bw + (x - x0)] = 1
        if (x < ax0) ax0 = x
        if (x > ax1) ax1 = x
        if (y < ay0) ay0 = y
        if (y > ay1) ay1 = y
      }
    }
    // Nothing actually covered: every field stays byte-for-byte as it was.
    if (ax1 < ax0 || ay1 < ay0) return { x0, y0, x1, y1 }
  } else {
    active.fill(1)
    ax0 = x0; ay0 = y0; ax1 = x1; ay1 = y1
  }
  // Cells allowed to act as a spreading SOURCE this step. Snapshotting the
  // active set at the start of each step bounds the wet frontier to one cell ring
  // per step (a cell wetted this step may settle but only spreads next step),
  // preventing the runaway scan-order cascade that would refill the region.
  const spreadable = new Uint8Array(count)
  const waterDelta = new Float32Array(count)
  const redDelta = new Float32Array(count)
  const greenDelta = new Float32Array(count)
  const blueDelta = new Float32Array(count)
  const dustDelta = new Float32Array(count)

  const transfer = (
    source: number,
    _target: number,
    sourceLocal: number,
    targetLocal: number,
    requested: number,
  ) => {
    const amount = Math.min(state.water[source] * 0.24, Math.max(0, requested))
    if (amount <= 0.000001) return
    // Real liquid crossed this edge — both ends are now part of the operation.
    active[sourceLocal] = 1
    active[targetLocal] = 1
    const available = Math.max(state.water[source], 0.000001)
    const ratio = amount / available
    waterDelta[sourceLocal] -= amount
    waterDelta[targetLocal] += amount
    const red = state.mobileR[source] * ratio
    const green = state.mobileG[source] * ratio
    const blue = state.mobileB[source] * ratio
    redDelta[sourceLocal] -= red
    redDelta[targetLocal] += red
    greenDelta[sourceLocal] -= green
    greenDelta[targetLocal] += green
    blueDelta[sourceLocal] -= blue
    blueDelta[targetLocal] += blue
    const dust = state.dust[source] * ratio * 0.18
    dustDelta[sourceLocal] -= dust
    dustDelta[targetLocal] += dust
  }

  const steps = Math.max(1, options.steps)
  for (let step = 0; step < steps; step++) {
    // The wet/active frontier advances by at most one cell ring per step, so the
    // only cells that can change this step lie within `step + 1` rings of the
    // initial impact. Confining every pass to that window skips inert baseline
    // material entirely; the maths, scan order and iteration count are unchanged,
    // so the result is byte-for-byte identical to a full-bbox pass.
    const grow = step + 1
    const wx0 = Math.max(x0, ax0 - grow)
    const wy0 = Math.max(y0, ay0 - grow)
    const wx1 = Math.min(x1, ax1 + grow)
    const wy1 = Math.min(y1, ay1 + grow)

    for (let y = wy0; y <= wy1; y++) {
      const rowStart = (y - y0) * bw + (wx0 - x0)
      const rowEnd = (y - y0) * bw + (wx1 - x0) + 1
      spreadable.set(active.subarray(rowStart, rowEnd), rowStart)
      waterDelta.fill(0, rowStart, rowEnd)
      redDelta.fill(0, rowStart, rowEnd)
      greenDelta.fill(0, rowStart, rowEnd)
      blueDelta.fill(0, rowStart, rowEnd)
      dustDelta.fill(0, rowStart, rowEnd)
    }

    for (let y = wy0; y <= wy1; y++) {
      for (let x = wx0; x <= wx1; x++) {
        const i = y * state.w + x
        if (state.rgba[i * 4 + 3] === 0) continue
        const local = (y - y0) * bw + x - x0
        const connect = (j: number, targetLocal: number, dx: number, dy: number) => {
          if (state.rgba[j * 4 + 3] === 0) return
          // Never exchange between two inert baseline cells: only the operation's
          // own liquid may spread, so settled aged moisture stays put. Sourcing
          // is gated on the previous step's frontier so activation grows one ring
          // at a time instead of cascading across the region in a single pass.
          if (spreadable[local] === 0 && spreadable[targetLocal] === 0) return
          const barrier = 1 - Math.max(state.film[i], state.film[j]) * 0.94
          if (barrier <= 0.01) return
          const angle = (state.fiberAngle[i] + state.fiberAngle[j]) * 0.5
          const alongFiber = Math.abs(dx * Math.cos(angle) + dy * Math.sin(angle))
          const anisotropy = 0.48 + alongFiber * 0.52
          const porosity = (state.porosity[i] + state.porosity[j]) * 0.5
          const sourceSurface = state.water[i] + state.height[i] * 0.07
          const targetSurface = state.water[j] + state.height[j] * 0.07
          const pressure = (sourceSurface - targetSurface) * 0.13
          const capillary = (state.water[i] - state.water[j]) * (0.035 + porosity * 0.045)
          const flow = (pressure + capillary) * anisotropy * barrier * (options.mobility ?? 1)
          if (flow > 0) transfer(i, j, local, targetLocal, flow)
          else transfer(j, i, targetLocal, local, -flow)
        }
        if (x < wx1) connect(i + 1, local + 1, 1, 0)
        if (y < wy1) connect(i + state.w, local + bw, 0, 1)
      }
    }

    for (let y = wy0; y <= wy1; y++) {
      for (let x = wx0; x <= wx1; x++) {
        const i = y * state.w + x
        const local = (y - y0) * bw + x - x0
        if (active[local] === 0) continue
        state.water[i] = Math.max(0, state.water[i] + waterDelta[local])
        state.mobileR[i] = Math.max(0, state.mobileR[i] + redDelta[local])
        state.mobileG[i] = Math.max(0, state.mobileG[i] + greenDelta[local])
        state.mobileB[i] = Math.max(0, state.mobileB[i] + blueDelta[local])
        state.dust[i] = clamp01(state.dust[i] + dustDelta[local])
        if (state.rgba[i * 4 + 3] === 0) continue

        const exposed = 1 - state.film[i] * 0.96
        const capacity = Math.max(0, 1 - state.wet[i])
        const absorption = Math.min(
          state.water[i],
          capacity * state.porosity[i] * exposed * (0.045 + state.fiber[i] * 0.025),
        )
        if (absorption > 0) {
          state.water[i] -= absorption
          state.wet[i] = clamp01(state.wet[i] + absorption)
          state.weak[i] = clamp01(state.weak[i] + absorption * 0.065)
          state.height[i] += (state.porosity[i] - 0.5) * absorption * 0.018
          depositSuspendedPigment(state, i, absorption * 0.28)
        }

        const liquid = state.water[i] + state.wet[i] * 0.45
        const lifted = Math.min(
          state.ink[i] * state.solubility[i],
          liquid * state.solubility[i] * 0.004,
        )
        if (lifted > 0) {
          const p = i * 4
          state.mobileR[i] += state.rgba[p] / 255 * lifted
          state.mobileG[i] += state.rgba[p + 1] / 255 * lifted
          state.mobileB[i] += state.rgba[p + 2] / 255 * lifted
          state.ink[i] = Math.max(0, state.ink[i] - lifted)
          const reveal = clamp01(lifted * 0.12)
          state.rgba[p] = lerp(state.rgba[p], state.paper[p], reveal)
          state.rgba[p + 1] = lerp(state.rgba[p + 1], state.paper[p + 1], reveal)
          state.rgba[p + 2] = lerp(state.rgba[p + 2], state.paper[p + 2], reveal)
        }

        const heat = clamp01(state.temperature[i])
        const evaporation = Math.min(
          state.water[i],
          (0.0035 + heat * 0.026) * exposed * (options.evaporation ?? 1),
        )
        if (evaporation > 0) {
          const before = Math.max(state.water[i], 0.000001)
          state.water[i] -= evaporation
          let neighbourWater = 0
          let neighbours = 0
          if (x > 0) { neighbourWater += state.water[i - 1]; neighbours++ }
          if (x < state.w - 1) { neighbourWater += state.water[i + 1]; neighbours++ }
          if (y > 0) { neighbourWater += state.water[i - state.w]; neighbours++ }
          if (y < state.h - 1) { neighbourWater += state.water[i + state.w]; neighbours++ }
          const front = clamp01((before - neighbourWater / Math.max(1, neighbours)) * 3)
          const edge = 1 + front * (options.tideStrength ?? 0.25)
          depositSuspendedPigment(state, i, evaporation / before * edge)
        }
        state.wet[i] = Math.max(0, state.wet[i] - (0.0007 + heat * 0.009) * exposed)

        if (heat > 0.3) {
          const dryResistance = 1 - clamp01(state.wet[i] + state.water[i])
          state.char[i] = clamp01(state.char[i] + (heat - 0.3) * dryResistance * 0.018)
          state.weak[i] = clamp01(state.weak[i] + state.char[i] * 0.012)
          state.gloss[i] *= 1 - heat * 0.08
          state.adhesive[i] *= 1 - heat * 0.025
        }
        if (state.char[i] > 0.985) {
          state.rgba[i * 4 + 3] = 0
          state.water[i] = 0
          state.wet[i] = 0
          state.paint[i] = 0
          state.film[i] = 0
          state.adhesive[i] = 0
        }
        state.temperature[i] *= 0.82
        state.adhesive[i] *= 0.999
        state.gloss[i] = clamp01(state.gloss[i] + state.adhesive[i] * 0.002)
        state.dust[i] = clamp01(state.dust[i] * (1 - state.water[i] * 0.002))
      }
    }
  }

  return { x0, y0, x1, y1 }
}

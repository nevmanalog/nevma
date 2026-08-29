import type { PaperType } from '@/domain/params'
import {
  type SheetState, clamp, clamp01, lerp, lum,
} from '@/engine/sheet/state'

export const PAPER_ABSORPTION: Record<PaperType, number> = {
  newsprint: 0.85,
  oldAd: 0.55,
  cardboard: 0.5,
  glossy: 0.18,
  cheap: 0.8,
}

export const alive = (state: SheetState, index: number) => state.rgba[index * 4 + 3] !== 0

export function exposePaper(state: SheetState, index: number, amount: number): void {
  const p = index * 4
  state.rgba[p] = lerp(state.rgba[p], state.paper[p], amount)
  state.rgba[p + 1] = lerp(state.rgba[p + 1], state.paper[p + 1], amount)
  state.rgba[p + 2] = lerp(state.rgba[p + 2], state.paper[p + 2], amount)
}

export function depositColor(state: SheetState, index: number, color: [number, number, number], amount: number): void {
  const p = index * 4
  state.rgba[p] = lerp(state.rgba[p], color[0], amount)
  state.rgba[p + 1] = lerp(state.rgba[p + 1], color[1], amount)
  state.rgba[p + 2] = lerp(state.rgba[p + 2], color[2], amount)
}

export function addWater(state: SheetState, index: number, amount: number): void {
  if (!alive(state, index)) return
  const barrier = 1 - state.film[index] * 0.96
  state.water[index] += Math.max(0, amount) * barrier
  state.gloss[index] = clamp01(state.gloss[index] + amount * 0.08)
}

export function depositPigment(
  state: SheetState,
  index: number,
  color: [number, number, number],
  amount: number,
  options: { liquid: number; solubility: number; thickness: number },
): void {
  if (!alive(state, index)) return
  const mass = Math.max(0, amount)
  const liquid = Math.max(0, options.liquid)
  const fixed = mass * (1 - clamp01(options.solubility) * Math.min(1, liquid))
  depositColor(state, index, color, clamp01(fixed))
  state.mobileR[index] += color[0] / 255 * mass * liquid
  state.mobileG[index] += color[1] / 255 * mass * liquid
  state.mobileB[index] += color[2] / 255 * mass * liquid
  state.paint[index] = clamp01(state.paint[index] + mass * options.thickness)
  state.solubility[index] = Math.max(state.solubility[index], clamp01(options.solubility))
  addWater(state, index, mass * liquid)
}

export function addFilm(state: SheetState, index: number, amount: number): void {
  state.film[index] = clamp01(state.film[index] + amount)
  state.gloss[index] = clamp01(state.gloss[index] + amount * 0.55)
  state.roughness[index] = clamp01(state.roughness[index] * (1 - amount * 0.55))
}

export function addAdhesive(state: SheetState, index: number, amount: number): void {
  state.adhesive[index] = clamp01(state.adhesive[index] + amount)
  state.gloss[index] = clamp01(state.gloss[index] + amount * 0.45)
  state.height[index] += amount * 0.24
  addWater(state, index, amount * 0.16)
}

export function addDust(state: SheetState, index: number, amount: number): void {
  const retention = clamp01(
    0.18 + state.roughness[index] * 0.42 + state.fiber[index] * 0.25
    + state.adhesive[index] * 0.65 + state.water[index] * 0.35 - state.film[index] * 0.55,
  )
  state.dust[index] = clamp01(state.dust[index] + amount * retention)
}

export function addHeat(state: SheetState, index: number, amount: number): void {
  state.temperature[index] = clamp01(state.temperature[index] + amount)
}

export function addRgb(state: SheetState, index: number, value: number): void {
  const p = index * 4
  state.rgba[p] = clamp(state.rgba[p] + value, 0, 255)
  state.rgba[p + 1] = clamp(state.rgba[p + 1] + value, 0, 255)
  state.rgba[p + 2] = clamp(state.rgba[p + 2] + value, 0, 255)
}

export function multiplyRgb(state: SheetState, index: number, factor: number): void {
  const p = index * 4
  state.rgba[p] = clamp(state.rgba[p] * factor, 0, 255)
  state.rgba[p + 1] = clamp(state.rgba[p + 1] * factor, 0, 255)
  state.rgba[p + 2] = clamp(state.rgba[p + 2] * factor, 0, 255)
}

export function desaturate(state: SheetState, index: number, amount: number): void {
  const p = index * 4
  const value = lum(state.rgba[p], state.rgba[p + 1], state.rgba[p + 2])
  state.rgba[p] = lerp(state.rgba[p], value, amount)
  state.rgba[p + 1] = lerp(state.rgba[p + 1], value, amount)
  state.rgba[p + 2] = lerp(state.rgba[p + 2], value, amount)
}

export function warm(state: SheetState, index: number, amount: number): void {
  const p = index * 4
  state.rgba[p] = clamp(state.rgba[p] * (1 + 0.1 * amount), 0, 255)
  state.rgba[p + 2] = clamp(state.rgba[p + 2] * (1 - 0.14 * amount), 0, 255)
}

export function subtractiveColor(state: SheetState, index: number, color: [number, number, number], amount: number): void {
  const p = index * 4
  state.rgba[p] = clamp(lerp(state.rgba[p], Math.min(state.rgba[p], color[0]), amount), 0, 255)
  state.rgba[p + 1] = clamp(lerp(state.rgba[p + 1], Math.min(state.rgba[p + 1], color[1]), amount), 0, 255)
  state.rgba[p + 2] = clamp(lerp(state.rgba[p + 2], Math.min(state.rgba[p + 2], color[2]), amount), 0, 255)
}

export { clamp, clamp01, lerp }

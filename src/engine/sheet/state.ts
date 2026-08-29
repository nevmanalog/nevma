// Physical sheet state — the heart of the "effect = physical process" model.
//
// A SheetState is the current physical condition of one printed sheet, held as
// a set of per-pixel fields. Tools do not draw an effect on top: they mutate
// these fields in place, reading whatever the previous tool left behind. That
// is what makes the order of operations matter.
//
//   rgba   visible surface colour + alpha (alpha 0 = a real hole in the sheet)
//   paper  the paper substrate colour *underneath* the ink — revealed as ink
//          is worn / dissolved / burnt away (never pure white; it is stock)
//   ink    0..1 how much printed pigment still sits on the surface
//   height signed surface relief used for lighting (folds, pins, embossing)
//   water free surface liquid mass; neighbouring deposits merge and flow
//   wet    absorbed moisture held inside the paper fibres
//   fiber  0..1 exposed / lifted paper fibre (roughens & lightens the surface)
//   gloss  0..1 specular sheen (glue, tape, wet film)
//   weak   0..1 structural weakening of the stock (folds crease it, water soaks
//          it, burn embrittles it) — invisible on its own, but knife / sandpaper
//          / cut bite harder where it is high, so a fold makes the paper tear
//          more easily exactly along the crease
//   mobile* suspended pigment mass transported by liquid
//   paint  deposited paint / pigment thickness above the printed ink
//   film   impermeable transparent coverage such as tape
//   adhesive viscous glue mass that cures while retaining relief
//   dust   loose particulate mass that collects in wet or recessed areas

import type { PaperType } from '@/domain/params'

export interface MaterialWorld {
  w: number
  h: number
  paperType: PaperType
  rgba: Uint8ClampedArray
  paper: Uint8ClampedArray
  ink: Float32Array
  height: Float32Array
  water: Float32Array
  wet: Float32Array
  mobileR: Float32Array
  mobileG: Float32Array
  mobileB: Float32Array
  paint: Float32Array
  solubility: Float32Array
  porosity: Float32Array
  fiberAngle: Float32Array
  roughness: Float32Array
  fiber: Float32Array
  gloss: Float32Array
  weak: Float32Array
  film: Float32Array
  adhesive: Float32Array
  dust: Float32Array
  temperature: Float32Array
  char: Float32Array
}

export type SheetState = MaterialWorld

export function hexToRgb(hex: string): [number, number, number] {
  const c = hex.replace('#', '')
  const n = parseInt(c.length === 3 ? c.split('').map((x) => x + x).join('') : c, 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

export const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v)
export const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v)
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t
export const lum = (r: number, g: number, b: number) => 0.299 * r + 0.587 * g + 0.114 * b

/** Cheap deterministic hash -> 0..1. */
export function hash2(x: number, y: number, seed: number): number {
  let h = (x * 374761393 + y * 668265263 + seed * 2246822519) >>> 0
  h = (h ^ (h >>> 13)) * 1274126177
  h = (h ^ (h >>> 16)) >>> 0
  return h / 4294967295
}

/** Smooth value noise from the integer hash (bilinear). */
export function valueNoise(x: number, y: number, seed: number): number {
  const xi = Math.floor(x), yi = Math.floor(y)
  const xf = x - xi, yf = y - yi
  const u = xf * xf * (3 - 2 * xf)
  const v = yf * yf * (3 - 2 * yf)
  const a = hash2(xi, yi, seed), b = hash2(xi + 1, yi, seed)
  const c = hash2(xi, yi + 1, seed), d = hash2(xi + 1, yi + 1, seed)
  return lerp(lerp(a, b, u), lerp(c, d, u), v)
}

/** Fractal noise for organic grime / grain. */
export function fbm(x: number, y: number, seed: number, oct = 4): number {
  let sum = 0, amp = 0.5, freq = 1
  for (let i = 0; i < oct; i++) {
    sum += amp * valueNoise(x * freq, y * freq, seed + i * 101)
    amp *= 0.5
    freq *= 2
  }
  return sum
}

interface CreateInput {
  base: HTMLCanvasElement
  paperColor: string
  yellowing: number
  roughness: number
  paperType: PaperType
  seed: number
}

/** The subset of seeding inputs a worker needs to seed a band from raw bytes. */
export interface SeedParams {
  paperColor: string
  yellowing: number
  roughness: number
  seed: number
}

/** Allocator for a SheetState's typed arrays (lets callers back them by SAB). */
export interface FieldAllocator {
  bytes(n: number): Uint8ClampedArray
  floats(n: number): Float32Array
}

const defaultAllocator: FieldAllocator = {
  bytes: (n) => new Uint8ClampedArray(n),
  floats: (n) => new Float32Array(n),
}

/** Allocate every field of a SheetState (all-zero) at a given size. */
export function allocSheet(
  w: number, h: number, paperType: PaperType, alloc: FieldAllocator = defaultAllocator,
): SheetState {
  const n = w * h
  return {
    w, h, paperType,
    rgba: alloc.bytes(n * 4), paper: alloc.bytes(n * 4),
    ink: alloc.floats(n), height: alloc.floats(n), water: alloc.floats(n),
    wet: alloc.floats(n), mobileR: alloc.floats(n), mobileG: alloc.floats(n),
    mobileB: alloc.floats(n), paint: alloc.floats(n), solubility: alloc.floats(n),
    porosity: alloc.floats(n), fiberAngle: alloc.floats(n), roughness: alloc.floats(n),
    fiber: alloc.floats(n), gloss: alloc.floats(n), weak: alloc.floats(n),
    film: alloc.floats(n), adhesive: alloc.floats(n), dust: alloc.floats(n),
    temperature: alloc.floats(n), char: alloc.floats(n),
  }
}

/**
 * Seed rows [y0,y1] of a SheetState from the printed base bytes. This is the
 * per-pixel-independent heart of createSheet, factored out so it can run over a
 * horizontal band — in a worker or on the main thread — with byte-for-byte the
 * same result as a full pass (every pixel uses its own global (x,y)).
 *
 * When `resetProcess` is set, the process fields the seeding loop never writes
 * (height/water/…/char) are zeroed for the band; on a fresh (already-zero)
 * allocation this can be skipped.
 */
export function seedSheetBand(
  s: SheetState, src: Uint8ClampedArray, y0: number, y1: number,
  params: SeedParams, resetProcess: boolean,
): void {
  const { w, rgba, paper, ink, height, water, wet, mobileR, mobileG, mobileB,
    paint, solubility, porosity, fiberAngle, roughness: surfaceRoughness,
    fiber, gloss, weak, film, adhesive, dust, temperature, char } = s
  const { paperColor, yellowing, roughness, seed } = params

  const [pr, pg, pb] = hexToRgb(paperColor)
  // Warm ageing target for the stock beneath the ink.
  const wy0 = 0.93, wy1 = 0.86, wy2 = 0.66
  const baseR = lerp(pr, pr * wy0, yellowing)
  const baseG = lerp(pg, pg * wy1, yellowing)
  const baseB = lerp(pb, pb * wy2, yellowing)
  const grain = 0.12 + roughness * 0.5
  const stockL = lum(baseR, baseG, baseB) || 1

  const start = y0 * w
  const end = (y1 + 1) * w
  // visible surface = printed base (copy just this band's rows)
  rgba.set(src.subarray(start * 4, end * 4), start * 4)
  if (resetProcess) {
    // Process fields not written by the seeding loop must start clean.
    height.fill(0, start, end); water.fill(0, start, end); wet.fill(0, start, end)
    mobileR.fill(0, start, end); mobileG.fill(0, start, end); mobileB.fill(0, start, end)
    fiber.fill(0, start, end); gloss.fill(0, start, end); weak.fill(0, start, end)
    film.fill(0, start, end); adhesive.fill(0, start, end); dust.fill(0, start, end)
    temperature.fill(0, start, end); char.fill(0, start, end)
  }

  for (let i = start; i < end; i++) {
    const p = i * 4
    const x = i % w, y = (i / w) | 0
    // paper substrate: stock colour with a faint fibre grain
    const gN = (valueNoise(x * 0.6, y * 0.6, seed + 3) - 0.5) * 26 * grain
    const fibreN = (valueNoise(x * 0.15, y * 3.0, seed + 9) - 0.5) * 10 * grain
    paper[p] = clamp(baseR + gN + fibreN, 0, 255)
    paper[p + 1] = clamp(baseG + gN + fibreN, 0, 255)
    paper[p + 2] = clamp(baseB + gN + fibreN, 0, 255)
    paper[p + 3] = 255
    // estimate ink amount: how far the printed pixel is below the stock, plus
    // its colourfulness. Fully-paper pixels start with ~0 removable pigment.
    const r = src[p], g = src[p + 1], b = src[p + 2]
    const pixL = lum(r, g, b)
    const darkness = clamp01((stockL - pixL) / stockL)
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b)
    const sat = mx <= 0 ? 0 : (mx - mn) / mx
    ink[i] = clamp01(darkness * 0.9 + sat * 0.35)
    paint[i] = ink[i] * 0.08
    solubility[i] = ink[i] * 0.28
    porosity[i] = clamp01(0.35 + roughness * 0.35 + valueNoise(x * 0.08, y * 0.08, seed + 31) * 0.2)
    fiberAngle[i] = (valueNoise(x * 0.015, y * 0.015, seed + 37) - 0.5) * 0.8
    surfaceRoughness[i] = clamp01(0.2 + roughness * 0.55 + valueNoise(x * 0.2, y * 0.2, seed + 41) * 0.2)
  }
}

/**
 * Seed a fresh SheetState from the printed base image. The base is treated as
 * "ink already sitting on the paper stock"; we estimate how much pigment is at
 * each pixel and what colour the stock beneath would be.
 */
export function createSheet(input: CreateInput, into?: SheetState): SheetState {
  const { base, paperColor, yellowing, roughness, paperType, seed } = input
  const w = base.width, h = base.height
  const ctx = base.getContext('2d')!
  const img = ctx.getImageData(0, 0, w, h)
  const src = img.data

  // A full sheet is ~22 typed arrays; for a large image that is hundreds of MB
  // allocated per rebuild. When re-seeding a layer we already hold (same size),
  // reuse its buffers to avoid that allocation + GC churn.
  const reuse = !!into && into.w === w && into.h === h
  const s = reuse ? into! : allocSheet(w, h, paperType)
  s.paperType = paperType
  seedSheetBand(s, src, 0, h - 1, { paperColor, yellowing, roughness, seed }, reuse)
  return s
}

/**
 * Materialize the visible image for a rectangular region of the sheet into an
 * RGBA byte buffer. Relief lighting from the height field turns folds / pins /
 * embossing into real 3-D shading and gloss adds a specular film. Working on a
 * sub-rectangle lets the cached renderer recompute only the pixels a stroke
 * actually touched instead of the whole canvas. The maths is identical to a
 * full pass, so region and full-canvas output are byte-for-byte the same.
 */
export function compositeInto(
  state: SheetState, d: Uint8ClampedArray,
  X0: number, Y0: number, X1: number, Y1: number,
): void {
  const {
    w, h, rgba, height, gloss, water, wet, mobileR, mobileG, mobileB,
    roughness, film, adhesive, dust, temperature, char,
  } = state
  const Lx = -0.45, Ly = -0.5, Lz = 0.74
  const relief = 2.2

  for (let y = Y0; y <= Y1; y++) {
    for (let x = X0; x <= X1; x++) {
      const i = y * w + x
      const p = i * 4
      const a = rgba[p + 3]
      if (a === 0) { d[p + 3] = 0; continue }

      const xl = x > 0 ? i - 1 : i
      const xr = x < w - 1 ? i + 1 : i
      const yt = y > 0 ? i - w : i
      const yb = y < h - 1 ? i + w : i
      const hx = (height[xr] - height[xl]) * relief
      const hy = (height[yb] - height[yt]) * relief
      const nx = -hx, ny = -hy
      const inv = 1 / Math.sqrt(nx * nx + ny * ny + 1)
      const diff = (nx * Lx + ny * Ly + Lz) * inv
      const lightF = 1 + (diff - Lz) * 1.35
      const liquid = clamp01(water[i] * 0.8 + wet[i] * 0.35)
      const liquidMass = water[i] + 0.0001
      const suspended = clamp01((mobileR[i] + mobileG[i] + mobileB[i]) / (liquidMass * 3))
      const pigmentR = clamp(mobileR[i] / liquidMass * 255, 0, 255)
      const pigmentG = clamp(mobileG[i] / liquidMass * 255, 0, 255)
      const pigmentB = clamp(mobileB[i] / liquidMass * 255, 0, 255)
      const wetDarkening = 1 - liquid * 0.13
      const particulate = clamp01(dust[i])
      const charAmount = clamp01(char[i])
      const surfaceGloss = clamp01(
        gloss[i] + liquid * 0.62 + film[i] * 0.48 + adhesive[i] * 0.28
        - roughness[i] * 0.16 - charAmount * 0.5,
      )
      const heatHaze = clamp01(temperature[i]) * 0.03
      const spec = surfaceGloss * Math.pow(diff < 0 ? 0 : diff, 10) * 220
      let r = lerp(rgba[p], pigmentR, suspended * liquid)
      let g = lerp(rgba[p + 1], pigmentG, suspended * liquid)
      let b = lerp(rgba[p + 2], pigmentB, suspended * liquid)
      r = lerp(r * wetDarkening, 27, charAmount)
      g = lerp(g * wetDarkening, 20, charAmount)
      b = lerp(b * wetDarkening, 16, charAmount)
      const dirtFactor = 1 - particulate * 0.32

      d[p] = clamp(r * dirtFactor * lightF + spec + heatHaze * 18, 0, 255)
      d[p + 1] = clamp(g * dirtFactor * lightF + spec + heatHaze * 6, 0, 255)
      d[p + 2] = clamp(b * dirtFactor * lightF + spec, 0, 255)
      d[p + 3] = a
    }
  }
}

/** Flatten the whole SheetState to a fresh canvas (used by export). */
export function composite(state: SheetState): HTMLCanvasElement {
  const { w, h } = state
  const out = document.createElement('canvas')
  out.width = w; out.height = h
  const octx = out.getContext('2d')!
  const img = octx.createImageData(w, h)
  compositeInto(state, img.data, 0, 0, w - 1, h - 1)
  octx.putImageData(img, 0, 0)
  return out
}

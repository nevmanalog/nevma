// Material history.
//
// The legacy "paper / damage / scratches" panels used to be WebGL FILTERS
// blended over the printed image. That is exactly the "effect = filter" model
// we are moving away from. Here those same amounts are re-expressed as PHYSICAL
// changes to the sheet's material fields — the sheet is aged, creased, damped,
// scratched and worn as a real object before the user ever picks up a tool.
//
// This runs once, right after the print is seeded and BEFORE the ordered user
// ops, so a brush stroke, water run or sandpaper pass all build on top of an
// already-battered physical surface (and can dissolve/expose it further).

import type { LayerEffects } from '@/domain/types'
import {
  type SheetState, clamp, clamp01, lerp, lum, valueNoise, fbm, hash2,
} from './state'
import { getNoiseField } from './noiseFields'

const sstep = (a: number, b: number, x: number): number => {
  let t = (x - a) / (b - a)
  t = t < 0 ? 0 : t > 1 ? 1 : t
  return t * t * (3 - 2 * t)
}

// local material writers (kept private so history stays self-contained)
function toPaper(s: SheetState, i: number, t: number) {
  const p = i * 4
  s.rgba[p] = lerp(s.rgba[p], s.paper[p], t)
  s.rgba[p + 1] = lerp(s.rgba[p + 1], s.paper[p + 1], t)
  s.rgba[p + 2] = lerp(s.rgba[p + 2], s.paper[p + 2], t)
}
function mul(s: SheetState, i: number, f: number) {
  const p = i * 4
  s.rgba[p] = clamp(s.rgba[p] * f, 0, 255)
  s.rgba[p + 1] = clamp(s.rgba[p + 1] * f, 0, 255)
  s.rgba[p + 2] = clamp(s.rgba[p + 2] * f, 0, 255)
}
function tintMul(s: SheetState, i: number, r: number, g: number, b: number, t: number) {
  const p = i * 4
  s.rgba[p] = lerp(s.rgba[p], s.rgba[p] * r, t)
  s.rgba[p + 1] = lerp(s.rgba[p + 1], s.rgba[p + 1] * g, t)
  s.rgba[p + 2] = lerp(s.rgba[p + 2], s.rgba[p + 2] * b, t)
}
function desat(s: SheetState, i: number, t: number) {
  const p = i * 4
  const l = lum(s.rgba[p], s.rgba[p + 1], s.rgba[p + 2])
  s.rgba[p] = lerp(s.rgba[p], l, t)
  s.rgba[p + 1] = lerp(s.rgba[p + 1], l, t)
  s.rgba[p + 2] = lerp(s.rgba[p + 2], l, t)
}
function add(s: SheetState, i: number, v: number) {
  const p = i * 4
  s.rgba[p] = clamp(s.rgba[p] + v, 0, 255)
  s.rgba[p + 1] = clamp(s.rgba[p + 1] + v, 0, 255)
  s.rgba[p + 2] = clamp(s.rgba[p + 2] + v, 0, 255)
}

/**
 * Age & damage the whole sheet physically according to the legacy panel
 * amounts. Every stage writes into the material fields (ink / wet / fiber /
 * height / gloss) and mutates the existing pixels — nothing is drawn on top.
 */
export function applyHistory(
  state: SheetState, effects: LayerEffects, seed: number,
  y0 = 0, y1 = state.h - 1,
): void {
  const { w, h } = state
  const eng = effects.engines
  const paperOn = eng?.paper !== false
  const damageOn = eng?.damage !== false
  const P = effects.paper
  const D = effects.damage

  const creases = paperOn ? P.creases : 0
  const moisture = paperOn ? P.moisture : 0
  const stains = paperOn ? P.stains : 0
  const pScr = paperOn ? P.scratches : 0
  const dScr = damageOn ? D.scratches : 0
  const abras = damageOn ? D.abrasions : 0
  const worn = damageOn ? D.worn : 0
  const dmg = damageOn ? D.paperDamage : 0

  if (
    creases + moisture + stains + pScr + dScr + abras + worn + dmg <= 0.0005
  ) return

  // Every noise field below depends ONLY on (x, y, seed) — never on the
  // intensity values above, which just scale/threshold the sampled value.
  // Fetch (or compute-once-and-cache) each one that's actually needed before
  // the per-pixel loop, instead of resampling all 4 octaves of every field on
  // every single pixel of every single call. See noiseFields.ts.
  const creaseField = creases > 0.001 ? getNoiseField('crease', seed, w, h, (out) => {
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) out[y * w + x] = fbm(x * 0.004 + seed * 12, y * 0.03, 4)
  }) : null
  const moistureField = moisture > 0.001 ? getNoiseField('moisture', seed, w, h, (out) => {
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) out[y * w + x] = fbm(x * 0.01 + seed * 7, y * 0.01, 4)
  }) : null
  const moistureHeightField = moisture > 0.001 ? getNoiseField('moistureHeight', seed, w, h, (out) => {
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) out[y * w + x] = valueNoise(x * 0.05, y * 0.05, seed + 4)
  }) : null
  const stainsField = stains > 0.001 ? getNoiseField('stains', seed, w, h, (out) => {
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) out[y * w + x] = fbm(x * 0.008 + seed * 9, y * 0.008, 4)
  }) : null
  const pScrField = pScr > 0.001 ? getNoiseField('paperScratch', seed, w, h, (out) => {
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) out[y * w + x] = fbm(x * 0.09 + seed * 3, y * 0.01, 3)
  }) : null
  const dScrField = dScr > 0.001 ? getNoiseField('damageScratch', seed, w, h, (out) => {
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) out[y * w + x] = fbm(x * 0.02 + seed * 15, y * 0.06, 4)
  }) : null
  const abrasField = abras > 0.001 ? getNoiseField('abrasion', seed, w, h, (out) => {
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) out[y * w + x] = fbm(x * 0.03 + seed * 21, y * 0.03, 4)
  }) : null
  const wornField = worn > 0.001 ? getNoiseField('worn', seed, w, h, (out) => {
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) out[y * w + x] = fbm(x * 0.01 + seed * 27, y * 0.01, 4)
  }) : null
  const clustField = dmg > 0.001 ? getNoiseField('damageClust', seed, w, h, (out) => {
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) out[y * w + x] = fbm(x * 0.02 + seed * 31, y * 0.02, 3)
  }) : null
  const nickField = dmg > 0.001 ? getNoiseField('damageNick', seed, w, h, (out) => {
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) out[y * w + x] = fbm(x * 0.05 + seed * 37, y * 0.05, 3)
  }) : null

  for (let y = y0; y <= y1; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x
      if (state.rgba[i * 4 + 3] === 0) continue

      // ---- creases: real folded ridges (lit + shadowed) with cracked ink ----
      if (creases > 0.001) {
        const cr = creaseField![i]
        const dark = sstep(0.5, 0.507, cr) - sstep(0.507, 0.515, cr)
        const hi = sstep(0.5, 0.516, cr) - sstep(0.516, 0.532, cr)
        if (dark > 0) {
          mul(state, i, 1 - dark * creases * 0.32)
          state.ink[i] = Math.max(0, state.ink[i] - dark * creases * 0.4)
          if (dark > 0.5 && hash2(x, y, seed + 61) < creases * 0.4) toPaper(state, i, dark * creases * 0.5)
        }
        state.height[i] += (hi - dark) * creases * 0.9
        // a crease permanently weakens the stock along its spine
        state.weak[i] = clamp01(state.weak[i] + (dark + hi) * creases * 0.5)
        state.porosity[i] = clamp01(state.porosity[i] + (dark + hi) * creases * 0.12)
      }

      // ---- moisture: soaked, cockled, warm-browned zones with tide rings -----
      if (moisture > 0.001) {
        const mF = moistureField![i]
        const damp = sstep(0.4, 0.62, mF)
        const ring = sstep(0.46, 0.5, mF) - sstep(0.5, 0.56, mF)
        if (damp > 0) {
          tintMul(state, i, 0.86, 0.78, 0.62, damp * moisture * 0.5)
          state.wet[i] = clamp01(state.wet[i] + damp * moisture * 0.6)
          state.water[i] += damp * moisture * 0.08
          state.ink[i] = Math.max(0, state.ink[i] - damp * moisture * 0.2)
          state.height[i] += (moistureHeightField![i] - 0.5) * damp * moisture * 0.6
          // soaked fibres swell and lose strength
          state.weak[i] = clamp01(state.weak[i] + damp * moisture * 0.3)
        }
        if (ring > 0) tintMul(state, i, 0.7, 0.55, 0.38, ring * moisture * 0.6)
      }

      // ---- stains: diffuse greasy brown blooms -------------------------------
      if (stains > 0.001) {
        const sF = stainsField![i]
        const st = sstep(0.4, 0.72, sF)
        if (st > 0) {
          tintMul(state, i, 0.85, 0.75, 0.55, st * stains * 0.5)
          desat(state, i, st * stains * 0.2)
          state.dust[i] = clamp01(state.dust[i] + st * stains * 0.25)
        }
      }

      // ---- scratches: raised micro-ridges that catch light (never white) -----
      let scr = 0
      if (pScr > 0.001) scr += sstep(0.82, 0.9, pScrField![i]) * pScr
      if (dScr > 0.001) scr += sstep(0.84, 0.9, dScrField![i]) * dScr
      if (scr > 0.002) {
        state.height[i] += scr * 0.5
        state.roughness[i] = clamp01(state.roughness[i] + scr * 0.18)
        state.gloss[i] = clamp01(state.gloss[i] + scr * 0.2)
        state.ink[i] = Math.max(0, state.ink[i] - scr * 0.1)
        desat(state, i, scr * 0.25)
        add(state, i, scr * 8)
      }

      // ---- abrasions: scuffed patches that lift fibre & lighten --------------
      if (abras > 0.001) {
        const ab = sstep(0.58, 0.82, abrasField![i])
        const scuff = ab * (0.4 + 0.6 * hash2(x, y, seed + 21)) * abras
        if (scuff > 0.002) {
          state.fiber[i] = clamp01(state.fiber[i] + scuff * 0.4)
          state.roughness[i] = clamp01(state.roughness[i] + scuff * 0.3)
          state.ink[i] = Math.max(0, state.ink[i] - scuff * 0.4)
          toPaper(state, i, scuff * 0.4)
          desat(state, i, scuff * 0.3)
        }
      }

      // ---- worn: broad ink loss back toward the bare stock ------------------
      if (worn > 0.001) {
        const wF = wornField![i]
        const wt = sstep(0.55, 0.85, wF) * worn * 0.5
        if (wt > 0.002) {
          toPaper(state, i, wt)
          state.ink[i] = Math.max(0, state.ink[i] - wt)
        }
      }

      // ---- paper damage: dark nicks, bright pulp flecks, true holes ---------
      if (dmg > 0.001) {
        const clust = sstep(0.6, 0.8, clustField![i])
        const nick = sstep(0.86, 0.92, nickField![i]) * clust * dmg
        if (nick > 0.002) {
          mul(state, i, 1 - nick * 0.7)
          state.height[i] -= nick * 0.4
        }
        if (hash2(x, y, seed + 41) > 0.994 && clust * dmg > 0.35) {
          const p = i * 4
          state.rgba[p] = clamp(state.paper[p] * 1.05, 0, 255)
          state.rgba[p + 1] = clamp(state.paper[p + 1] * 1.05, 0, 255)
          state.rgba[p + 2] = clamp(state.paper[p + 2] * 1.05, 0, 255)
          state.ink[i] = 0
          state.fiber[i] = clamp01(state.fiber[i] + 0.5)
        }
        if (hash2(x, y, seed + 47) > 0.9985 && clust * dmg > 0.55) state.rgba[i * 4 + 3] = 0
      }
    }
  }
}

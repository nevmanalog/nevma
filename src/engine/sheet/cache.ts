// Incremental, cached materialization of a layer's physical sheet.
//
// The full pipeline (bakeMaterial -> createSheet -> applyHistory -> replay ops
// -> composite) is correct but expensive, and rebuilding all of it whenever any
// single setting changes is wasteful. The stages form a dependency CHAIN, so
// the cache is keyed by two independent signatures — each stage only rebuilds
// when the data it actually consumes changes:
//
//   printSig  — inputs to the WebGL print pass (bakeMaterial): prepress, printer,
//               paper STOCK, scanner, colour, intensity, seed, size. Changing a
//               print/scan/colour setting rebakes the printed base.
//   agingSig  — inputs to the material baseline (createSheet + applyHistory):
//               paper aging (creases/moisture/stains/paper.scratches) and damage.
//               Changing one of these reuses the already-baked printed image and
//               only re-ages the sheet — no WebGL rebake.
//   ops       — ordered workshop operations. A new stroke only replays the
//               appended op; nothing upstream is recomputed.
//
// Because the pipeline is a chain, changing a print input necessarily rebuilds
// the aging baseline on top of the new print (they are not independent), but a
// pure aging change never rebakes print, and a workshop change never touches
// either. The maths is identical to a full rebuild, so pixels are byte-for-byte
// the same; only redundant recomputation is removed.
//
// The expensive full-image passes (seed + age + composite, ~10s at 4K) are
// per-pixel independent, so they are run across a Web Worker pool over
// SharedArrayBuffer-backed fields (see pool.ts) when cross-origin isolation is
// available — keeping the main thread responsive and using every CPU core. When
// it is not available the identical synchronous path runs instead. Incremental
// stroke updates stay on the main thread: they are region-local and cheap.
//
// Per layer we keep: the printed base canvas, a snapshot of the material AFTER
// applyHistory but BEFORE any op (baseline), a live working SheetState with the
// current ops applied, and a persistent output canvas + ImageData buffer.

import type { SheetOp, LayerEffects } from '@/domain/types'
import {
  allocSheet, seedSheetBand, compositeInto, type SheetState, type SeedParams,
} from './state'
import { applyHistory } from './history'
import { applyToolOperation, resolveOpParameters } from '@/engine/tools/registry'
import type { BBox } from '@/engine/tools/core/contracts'
import { referenceDevelopment } from '@/engine/reference/development'
import { applyFinal } from '@/engine/final/apply'
import {
  parallelAvailable, sabAllocator, parallelSeedAge, parallelComposite,
  parallelApplyOps,
} from './pool'

type Src = HTMLCanvasElement | HTMLImageElement

interface Fields {
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

interface LayerCache {
  printSig: string
  agingSig: string
  finalSig: string
  src: Src
  printed: HTMLCanvasElement
  // Printed base pixels, shared with the worker pool. The seed pass reads these.
  srcBytes: Uint8ClampedArray
  baseline: Fields
  work: SheetState
  applied: SheetOp[]
  out: HTMLCanvasElement
  ctx: CanvasRenderingContext2D
  // Raw composited sheet (relief lighting etc.) BEFORE the Final stage. Kept so
  // a pure Final change re-runs only the final pass, reusing the composite, and
  // a workshop stroke recomposites just its region before Final is re-applied.
  composited: Uint8ClampedArray
  img: ImageData
  referenceVersion: number
  // Whether this layer's buffers are SharedArrayBuffer-backed and eligible for
  // the parallel worker path.
  parallel: boolean
  // A single rolling "replay from here" snapshot, taken periodically as ops
  // are appended (see CHECKPOINT_INTERVAL). When undo/reorder/remove makes
  // the target ops list diverge from what's applied, the diverged-rebuild
  // path can resume from this checkpoint instead of always replaying every
  // op from the material baseline — turning an O(all ops) undo back into
  // roughly O(ops since the last checkpoint). Deliberately just ONE slot,
  // reused in place: a full snapshot is large (every material field at full
  // resolution), so this trades "undo near a checkpoint is fast, undo far
  // from one falls back to the old full-replay behavior" for bounded memory
  // (~1 extra baseline's worth per layer) instead of unbounded growth.
  checkpoint: { opsPrefix: SheetOp[]; state: Fields } | null
}

const caches = new Map<string, LayerCache>()

// Per-layer serialization: a layer's async rebuilds mutate one shared work
// state, so they must not overlap. Each call chains after the previous one.
const locks = new Map<string, Promise<unknown>>()

const snapshot = (s: SheetState): Fields => ({
  rgba: new Uint8ClampedArray(s.rgba),
  paper: new Uint8ClampedArray(s.paper),
  ink: new Float32Array(s.ink),
  height: new Float32Array(s.height),
  water: new Float32Array(s.water),
  wet: new Float32Array(s.wet),
  mobileR: new Float32Array(s.mobileR),
  mobileG: new Float32Array(s.mobileG),
  mobileB: new Float32Array(s.mobileB),
  paint: new Float32Array(s.paint),
  solubility: new Float32Array(s.solubility),
  porosity: new Float32Array(s.porosity),
  fiberAngle: new Float32Array(s.fiberAngle),
  roughness: new Float32Array(s.roughness),
  fiber: new Float32Array(s.fiber),
  gloss: new Float32Array(s.gloss),
  weak: new Float32Array(s.weak),
  film: new Float32Array(s.film),
  adhesive: new Float32Array(s.adhesive),
  dust: new Float32Array(s.dust),
  temperature: new Float32Array(s.temperature),
  char: new Float32Array(s.char),
})

// Copy the live working state INTO an existing baseline (reusing its buffers)
// instead of allocating a fresh snapshot every rebuild.
const snapshotInto = (b: Fields, s: SheetState): void => {
  b.rgba.set(s.rgba); b.paper.set(s.paper); b.ink.set(s.ink)
  b.height.set(s.height); b.water.set(s.water); b.wet.set(s.wet)
  b.mobileR.set(s.mobileR); b.mobileG.set(s.mobileG); b.mobileB.set(s.mobileB)
  b.paint.set(s.paint); b.solubility.set(s.solubility); b.porosity.set(s.porosity)
  b.fiberAngle.set(s.fiberAngle); b.roughness.set(s.roughness)
  b.fiber.set(s.fiber); b.gloss.set(s.gloss); b.weak.set(s.weak)
  b.film.set(s.film); b.adhesive.set(s.adhesive); b.dust.set(s.dust)
  b.temperature.set(s.temperature); b.char.set(s.char)
}

const restore = (s: SheetState, b: Fields): void => {
  s.rgba.set(b.rgba); s.paper.set(b.paper); s.ink.set(b.ink)
  s.height.set(b.height); s.water.set(b.water); s.wet.set(b.wet)
  s.mobileR.set(b.mobileR); s.mobileG.set(b.mobileG); s.mobileB.set(b.mobileB)
  s.paint.set(b.paint); s.solubility.set(b.solubility); s.porosity.set(b.porosity)
  s.fiberAngle.set(b.fiberAngle); s.roughness.set(b.roughness)
  s.fiber.set(b.fiber); s.gloss.set(b.gloss); s.weak.set(b.weak)
  s.film.set(b.film); s.adhesive.set(b.adhesive); s.dust.set(b.dust)
  s.temperature.set(b.temperature); s.char.set(b.char)
}

// Signature of ONLY the fields the WebGL print pass (bakeMaterial) reads. A
// change here means the printed base must be rebaked from source.
const printSig = (e: LayerEffects, seed: number, w: number, h: number): string =>
  JSON.stringify([
    w, h, seed, e.intensity, e.prepress, e.colorMode, e.tint,
    e.paperColor, e.paperType, e.printerType, e.scannerMode,
    e.paper.yellowing, e.paper.fibers, e.paper.roughness, e.paper.thickness,
    e.printer, e.scanner, e.engines,
  ])

// Signature of ONLY the fields the material baseline (createSheet + applyHistory)
// reads on top of the printed base. A change here re-ages the sheet but reuses
// the already-baked printed image.
const agingSig = (e: LayerEffects, seed: number): string =>
  JSON.stringify([
    seed, e.paperColor, e.paperType,
    e.paper.yellowing, e.paper.roughness,
    e.paper.creases, e.paper.moisture, e.paper.stains, e.paper.scratches,
    e.damage.scratches, e.damage.abrasions, e.damage.worn, e.damage.paperDamage,
    e.engines.paper, e.engines.damage,
  ])

// Signature of ONLY the Final adjustment stack. A change here re-runs the Final
// pass over the cached composite — no rebake, no re-aging, no op replay.
const finalSig = (e: LayerEffects): string => JSON.stringify(e.final ?? null)

const seedParamsOf = (effects: LayerEffects, seed: number): SeedParams => ({
  paperColor: effects.paperColor ?? '#ffffff',
  yellowing: effects.paper?.yellowing ?? 0,
  roughness: effects.paper?.roughness ?? 0,
  seed,
})

// Copy the printed base canvas pixels into the shared src buffer that the seed
// pass reads (both the parallel and synchronous paths).
function copyPrinted(c: LayerCache, printed: HTMLCanvasElement): void {
  const img = printed.getContext('2d')!.getImageData(0, 0, printed.width, printed.height)
  c.srcBytes.set(img.data)
}

// Seed + age the whole sheet from the (already-copied) printed base. Runs on the
// worker pool when possible, otherwise synchronously — byte-for-byte identical.
async function seedAndAge(
  c: LayerCache, effects: LayerEffects, seed: number, resetProcess: boolean,
): Promise<void> {
  const sp = seedParamsOf(effects, seed)
  if (c.parallel) {
    try {
      await parallelSeedAge(
        c.work, c.srcBytes, c.composited, effects.paperType,
        sp, resetProcess, true, effects, seed,
      )
      return
    } catch { c.parallel = false }
  }
  seedSheetBand(c.work, c.srcBytes, 0, c.work.h - 1, sp, resetProcess)
  applyHistory(c.work, effects, seed)
}

const growBBox = (acc: BBox | null, b: BBox): BBox => (acc ? {
  x0: Math.min(acc.x0, b.x0), y0: Math.min(acc.y0, b.y0),
  x1: Math.max(acc.x1, b.x1), y1: Math.max(acc.y1, b.y1),
} : b)

// Replay ordered physical strokes onto the working state. Runs the engines +
// solver on the worker pool when the sheet is SAB-backed (keeping the UI thread
// free), otherwise synchronously on the main thread. Both paths call the exact
// same simulation with the same reference-resolved parameters, so the result is
// byte-for-byte identical; returns the union dirty-region bbox.
async function runOps(c: LayerCache, ops: SheetOp[]): Promise<BBox | null> {
  if (ops.length === 0) return null
  if (c.parallel) {
    try {
      const entries = ops.map((op) => ({ op, params: resolveOpParameters(op) }))
      return await parallelApplyOps(c.work, c.srcBytes, c.composited, c.work.paperType, entries)
    } catch { c.parallel = false }
  }
  let bbox: BBox | null = null
  for (const op of ops) {
    const b = applyToolOperation(c.work, op)
    if (b) bbox = growBBox(bbox, b)
  }
  return bbox
}

// Composite the whole sheet and run the Final stack over it, then blit.
async function compositeFull(c: LayerCache, effects: LayerEffects, seed: number): Promise<void> {
  const w = c.out.width, h = c.out.height
  if (c.parallel) {
    try {
      await parallelComposite(c.work, c.srcBytes, c.composited, effects.paperType)
    } catch { c.parallel = false; compositeInto(c.work, c.composited, 0, 0, w - 1, h - 1) }
  } else {
    compositeInto(c.work, c.composited, 0, 0, w - 1, h - 1)
  }
  applyFinal(c.composited, c.img.data, w, h, 0, 0, w - 1, h - 1, effects.final, seed)
  c.ctx.putImageData(c.img, 0, 0)
}

// Recomposite an inclusive region into `composited`, run the Final stack into
// the output ImageData, and blit that region to the canvas. Because both the
// composite and the Final stack are region-exact, this equals a full pass.
function paintRegion(
  c: LayerCache, w: number, h: number, effects: LayerEffects, seed: number,
  rx0: number, ry0: number, rx1: number, ry1: number,
): void {
  compositeInto(c.work, c.composited, rx0, ry0, rx1, ry1)
  applyFinal(c.composited, c.img.data, w, h, rx0, ry0, rx1, ry1, effects.final, seed)
  c.ctx.putImageData(c.img, 0, 0, rx0, ry0, rx1 - rx0 + 1, ry1 - ry0 + 1)
}

// Allocate a brand-new per-layer cache entry sized w×h.
function createCacheEntry(
  src: Src, w: number, h: number, paperType: LayerEffects['paperType'],
): LayerCache {
  const parallel = parallelAvailable()
  const alloc = parallel ? sabAllocator : undefined
  const work = allocSheet(w, h, paperType, alloc)
  const n = w * h
  const srcBytes = parallel
    ? new Uint8ClampedArray(new SharedArrayBuffer(n * 4))
    : new Uint8ClampedArray(n * 4)
  const composited = parallel
    ? new Uint8ClampedArray(new SharedArrayBuffer(n * 4))
    : new Uint8ClampedArray(n * 4)
  const out = document.createElement('canvas')
  out.width = w; out.height = h
  const ctx = out.getContext('2d')!
  const img = ctx.createImageData(w, h)
  return {
    printSig: '', agingSig: '', finalSig: '', src,
    printed: out, srcBytes, baseline: snapshot(work), work, applied: [],
    out, ctx, composited, img, referenceVersion: 0, parallel, checkpoint: null,
  }
}

// How often (in ops appended) to refresh the rolling checkpoint. Smaller =
// faster undo but more time spent snapshotting while the user is actively
// working; larger = cheaper while working but undo falls back to a full
// baseline replay more often. 6 is a middle ground: a workshop session of
// e.g. 20 strokes gets 3-4 checkpoints, so undoing near the end of a long
// history never has to replay more than ~5 ops from the nearest one.
const CHECKPOINT_INTERVAL = 6

// Unconditionally (re)point the rolling checkpoint at the layer's current
// state + applied-ops list, reusing its arrays in place when possible.
function setCheckpoint(c: LayerCache): void {
  if (c.checkpoint) {
    snapshotInto(c.checkpoint.state, c.work)
    c.checkpoint.opsPrefix = c.applied.slice()
  } else {
    c.checkpoint = { opsPrefix: c.applied.slice(), state: snapshot(c.work) }
  }
}

// After a successful pure-append, maybe refresh the rolling checkpoint to
// "current state, current ops list". Interval-gated (see CHECKPOINT_INTERVAL)
// so a fast sequence of strokes doesn't snapshot on every single one.
function maybeCheckpoint(c: LayerCache): void {
  const since = c.applied.length - (c.checkpoint?.opsPrefix.length ?? 0)
  if (since >= CHECKPOINT_INTERVAL) setCheckpoint(c)
}

// If the rolling checkpoint's ops are still an exact (reference-equal) prefix
// of the target `ops` list, restore from it and report how many ops still
// need replaying — letting the diverged-rebuild path skip straight to "just
// replay what changed" instead of always redoing everything from baseline.
// Returns null when there's no usable checkpoint (falls back to baseline).
function tryResumeFromCheckpoint(c: LayerCache, ops: SheetOp[]): SheetOp[] | null {
  const cp = c.checkpoint
  if (!cp || cp.opsPrefix.length > ops.length) return null
  for (let i = 0; i < cp.opsPrefix.length; i++) {
    if (cp.opsPrefix[i] !== ops[i]) return null
  }
  restore(c.work, cp.state)
  return ops.slice(cp.opsPrefix.length)
}

/**
 * Materialize a layer into its cached output canvas, reusing as much prior work
 * as possible. `bake` is a thunk that produces the printed base; it is only
 * invoked when the base actually needs regenerating, so the WebGL pass and the
 * per-pixel history pass are skipped for plain stroke additions.
 *
 * Returns the (stable) output canvas. Because the canvas reference is reused
 * across incremental updates, the caller must trigger its own redraw (Konva
 * batchDraw) rather than relying on a new reference.
 */
export function renderLayerCached(
  id: string,
  src: Src,
  effects: LayerEffects,
  seed: number,
  w: number,
  h: number,
  ops: SheetOp[],
  bake: () => HTMLCanvasElement | Promise<HTMLCanvasElement>,
): Promise<HTMLCanvasElement> {
  const prev = locks.get(id) ?? Promise.resolve()
  const next = prev
    .catch(() => {})
    .then(() => renderImpl(id, src, effects, seed, w, h, ops, bake))
  locks.set(id, next.catch(() => {}))
  return next
}

async function renderImpl(
  id: string,
  src: Src,
  effects: LayerEffects,
  seed: number,
  w: number,
  h: number,
  ops: SheetOp[],
  bake: () => HTMLCanvasElement | Promise<HTMLCanvasElement>,
): Promise<HTMLCanvasElement> {
  const pSig = printSig(effects, seed, w, h)
  const aSig = agingSig(effects, seed)
  const fSig = finalSig(effects)
  const c = caches.get(id)

  // ---- print (re)build: rebake the WebGL base, then re-age and replay -------
  if (!c || c.src !== src || c.printSig !== pSig || c.out.width !== w || c.out.height !== h) {
    const printed = await bake()
    const reusable = !!c && c.out.width === w && c.out.height === h
    const cache = reusable ? c! : createCacheEntry(src, w, h, effects.paperType)
    if (!reusable) caches.set(id, cache)
    cache.work.paperType = effects.paperType
    cache.printed = printed
    cache.src = src
    copyPrinted(cache, printed)
    // Fresh arrays are already zero; a reused sheet must reset its process fields.
    await seedAndAge(cache, effects, seed, reusable)
    snapshotInto(cache.baseline, cache.work)
    cache.checkpoint = null
    cache.printSig = pSig; cache.agingSig = aSig
    cache.referenceVersion = referenceDevelopment.version()
    await runOps(cache, ops)
    cache.applied = ops.slice()
    setCheckpoint(cache)
    cache.finalSig = fSig
    await compositeFull(cache, effects, seed)
    return cache.out
  }

  // ---- aging-only rebuild: reuse printed base, re-age and replay -----------
  if (c.agingSig !== aSig) {
    c.work.paperType = effects.paperType
    await seedAndAge(c, effects, seed, true)
    snapshotInto(c.baseline, c.work)
    c.checkpoint = null
    c.agingSig = aSig
    c.referenceVersion = referenceDevelopment.version()
    await runOps(c, ops)
    c.applied = ops.slice()
    setCheckpoint(c)
    c.finalSig = fSig
    await compositeFull(c, effects, seed)
    return c.out
  }

  if (c.referenceVersion !== referenceDevelopment.version()) {
    restore(c.work, c.baseline)
    c.checkpoint = null
    await runOps(c, ops)
    c.applied = ops.slice()
    setCheckpoint(c)
    c.referenceVersion = referenceDevelopment.version()
    c.finalSig = fSig
    await compositeFull(c, effects, seed)
    return c.out
  }

  // A pure Final change reuses the cached composite and re-runs only the Final
  // stack over the whole image — no rebake, no re-aging, no op replay.
  const finalChanged = c.finalSig !== fSig
  c.finalSig = fSig

  // ---- ops diff: how much of the applied list still matches ---------------
  const applied = c.applied
  let k = 0
  const m = Math.min(applied.length, ops.length)
  while (k < m && applied[k] === ops[k]) k++

  if (k === applied.length && ops.length === applied.length) {
    // Ops unchanged (e.g. a redundant token bump). Only redo Final if it moved.
    if (finalChanged) {
      applyFinal(c.composited, c.img.data, w, h, 0, 0, w - 1, h - 1, effects.final, seed)
      c.ctx.putImageData(c.img, 0, 0)
    }
    return c.out
  }

  if (k === applied.length) {
    // Pure append: apply just the new ops (on the worker pool when available)
    // and recomposite their union bbox.
    const bb = await runOps(c, ops.slice(applied.length))
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity
    if (bb) { x0 = bb.x0; y0 = bb.y0; x1 = bb.x1; y1 = bb.y1 }
    c.applied = ops.slice()
    maybeCheckpoint(c)
    if (finalChanged) {
      // The Final stack changed too (global): recomposite the touched region
      // into the buffer, then re-run Final over the whole image.
      if (x1 >= x0 && y1 >= y0) {
        const rx0 = Math.max(0, x0 - 1), ry0 = Math.max(0, y0 - 1)
        const rx1 = Math.min(w - 1, x1 + 1), ry1 = Math.min(h - 1, y1 + 1)
        compositeInto(c.work, c.composited, rx0, ry0, rx1, ry1)
      }
      applyFinal(c.composited, c.img.data, w, h, 0, 0, w - 1, h - 1, effects.final, seed)
      c.ctx.putImageData(c.img, 0, 0)
    } else if (x1 >= x0 && y1 >= y0) {
      // Grow by 1px: relief lighting of a pixel reads its neighbours' height.
      const rx0 = Math.max(0, x0 - 1), ry0 = Math.max(0, y0 - 1)
      const rx1 = Math.min(w - 1, x1 + 1), ry1 = Math.min(h - 1, y1 + 1)
      paintRegion(c, w, h, effects, seed, rx0, ry0, rx1, ry1)
    }
    return c.out
  }

  // Diverged / shortened (undo, reorder, clear): resume from the rolling
  // checkpoint if it's still a valid prefix of the target ops (the common
  // case — undoing a recent stroke), replaying only what's left. Otherwise
  // fall back to the material baseline and replay everything, same as before.
  const resumeFrom = tryResumeFromCheckpoint(c, ops)
  if (resumeFrom) {
    await runOps(c, resumeFrom)
    c.applied = ops.slice()
  } else {
    restore(c.work, c.baseline)
    await runOps(c, ops)
    c.applied = ops.slice()
    setCheckpoint(c)
  }
  c.referenceVersion = referenceDevelopment.version()
  await compositeFull(c, effects, seed)
  return c.out
}

/** Release a layer's cached buffers (call when the layer is removed). */
// The layer's last fully-materialized output canvas (printed + aged + every
// workshop op replayed) — exactly the pixels currently shown on the canvas.
// Returns null if the layer hasn't been rendered at least once yet (e.g. it
// was never visible). Used by "Merge layers" to flatten what's actually on
// screen rather than re-deriving it.
export function getLayerBakedCanvas(id: string): HTMLCanvasElement | null {
  return caches.get(id)?.out ?? null
}

export function dropLayerCache(id: string): void {
  caches.delete(id)
  locks.delete(id)
}

export function getCachedMaterialState(id: string): SheetState | null {
  return caches.get(id)?.work ?? null
}

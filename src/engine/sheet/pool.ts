// Worker pool that runs the heavy material passes (seed + age + composite) in
// parallel over horizontal row bands, on SharedArrayBuffer-backed fields.
//
// This is what keeps the app responsive on very large (4K+) images: the ~10s
// per-pixel work of a full 4K rebuild no longer runs on the main thread, and it
// is spread across every CPU core. The maths is unchanged, so the pixels are
// byte-for-byte identical to the synchronous path (see cache.ts fallback).

import type { PaperType } from '@/domain/params'
import type { LayerEffects, SheetOp, ToolParameterValues } from '@/domain/types'
import type { SheetState, FieldAllocator, SeedParams } from './state'
import type { BandBuffers, BandJob, WorkerDone } from './materializeWorker'
import type { BBox } from '@/engine/tools/core/contracts'

// SharedArrayBuffer requires cross-origin isolation. When that (or Worker) is
// unavailable we simply fall back to the synchronous path — same output.
export function parallelAvailable(): boolean {
  return (
    typeof SharedArrayBuffer !== 'undefined'
    && typeof Worker !== 'undefined'
    && typeof crossOriginIsolated !== 'undefined'
    && crossOriginIsolated === true
  )
}

/** Allocator whose arrays are backed by SharedArrayBuffer (shareable with workers). */
export const sabAllocator: FieldAllocator = {
  bytes: (n) => new Uint8ClampedArray(new SharedArrayBuffer(n)),
  floats: (n) => new Float32Array(new SharedArrayBuffer(n * 4)),
}

/** True when a typed array is backed by a SharedArrayBuffer. */
export function isShared(a: ArrayBufferView): boolean {
  return typeof SharedArrayBuffer !== 'undefined' && a.buffer instanceof SharedArrayBuffer
}

const POOL_SIZE = Math.max(
  1,
  Math.min(8, (typeof navigator !== 'undefined' && navigator.hardwareConcurrency) || 4),
)

interface Slot {
  worker: Worker
  busy: boolean
  resolve: ((done: WorkerDone) => void) | null
}

let slots: Slot[] | null = null
let jobId = 0

function ensurePool(): Slot[] {
  if (slots) return slots
  slots = []
  for (let i = 0; i < POOL_SIZE; i++) {
    const worker = new Worker(new URL('./materializeWorker.ts', import.meta.url), { type: 'module' })
    const slot: Slot = { worker, busy: false, resolve: null }
    worker.onmessage = (ev: MessageEvent<WorkerDone>) => {
      slot.busy = false
      const r = slot.resolve
      slot.resolve = null
      if (r) r(ev.data)
    }
    slots.push(slot)
  }
  return slots
}

// Serialize every pool operation. A full-pass job fans out across all slots and
// the stroke-replay job owns one slot, so overlapping dispatches from concurrent
// layer renders would clobber each other; chaining them keeps the pool coherent.
let poolQueue: Promise<unknown> = Promise.resolve()
function serialize<T>(fn: () => Promise<T>): Promise<T> {
  const next = poolQueue.catch(() => {}).then(fn)
  poolQueue = next.catch(() => {})
  return next
}

function buffersOf(s: SheetState, src: Uint8ClampedArray, composited: Uint8ClampedArray): BandBuffers {
  const b = (a: ArrayBufferView) => a.buffer as SharedArrayBuffer
  return {
    rgba: b(s.rgba), paper: b(s.paper), ink: b(s.ink), height: b(s.height),
    water: b(s.water), wet: b(s.wet), mobileR: b(s.mobileR), mobileG: b(s.mobileG),
    mobileB: b(s.mobileB), paint: b(s.paint), solubility: b(s.solubility),
    porosity: b(s.porosity), fiberAngle: b(s.fiberAngle), roughness: b(s.roughness),
    fiber: b(s.fiber), gloss: b(s.gloss), weak: b(s.weak), film: b(s.film),
    adhesive: b(s.adhesive), dust: b(s.dust), temperature: b(s.temperature), char: b(s.char),
    src: b(src), composited: b(composited),
  }
}

/** Even row bands over [0,h): one band per worker (fewer when the image is short). */
function bands(h: number, n: number): [number, number][] {
  const count = Math.max(1, Math.min(n, h))
  const per = Math.ceil(h / count)
  const out: [number, number][] = []
  for (let y = 0; y < h; y += per) out.push([y, Math.min(h - 1, y + per - 1)])
  return out
}

// Distributive Omit so the discriminated ApplyOps/SeedAge/Composite members are
// preserved (a plain `Omit<BandJob,'id'>` collapses to only their shared keys).
type DispatchJob = BandJob extends infer J ? (J extends unknown ? Omit<J, 'id'> : never) : never

function dispatch(jobs: DispatchJob[]): Promise<void> {
  return serialize(() => {
    const pool = ensurePool()
    const tasks = jobs.map((job, i) => new Promise<void>((resolve) => {
      const slot = pool[i]
      slot.busy = true
      slot.resolve = () => resolve()
      slot.worker.postMessage({ ...job, id: ++jobId } as BandJob)
    }))
    return Promise.all(tasks).then(() => undefined)
  })
}

// Run a single job on one slot and return the worker's reply (used for the
// inherently-sequential stroke replay, which owns one worker rather than fanning
// out into bands).
function dispatchOne(job: DispatchJob): Promise<WorkerDone> {
  return serialize(() => {
    const slot = ensurePool()[0]
    return new Promise<WorkerDone>((resolve) => {
      slot.busy = true
      slot.resolve = resolve
      slot.worker.postMessage({ ...job, id: ++jobId } as BandJob)
    })
  })
}

/**
 * Replay physical strokes over the shared material `work` state on a worker.
 * Ops are applied in order with already reference-resolved parameters; returns
 * the union dirty-region bbox. `work`/`src`/`composited` must be SAB-backed.
 */
export function parallelApplyOps(
  work: SheetState, src: Uint8ClampedArray, composited: Uint8ClampedArray,
  paperType: PaperType, entries: { op: SheetOp; params: ToolParameterValues }[],
): Promise<BBox | null> {
  const buffers = buffersOf(work, src, composited)
  return dispatchOne({
    phase: 'applyOps' as const, buffers, w: work.w, h: work.h, paperType, entries,
  }).then((done) => done.bbox ?? null)
}

/**
 * Seed + age the whole sheet across the worker pool. `src` and every field of
 * `work` must be SharedArrayBuffer-backed (see sabAllocator).
 */
export function parallelSeedAge(
  work: SheetState, src: Uint8ClampedArray, composited: Uint8ClampedArray,
  paperType: PaperType, seedParams: SeedParams, resetProcess: boolean,
  doAge: boolean, effects: LayerEffects, seed: number,
): Promise<void> {
  const buffers = buffersOf(work, src, composited)
  const parts = bands(work.h, POOL_SIZE)
  return dispatch(parts.map(([y0, y1]) => ({
    phase: 'seedAge' as const, buffers, w: work.w, h: work.h, paperType,
    y0, y1, seedParams, resetProcess, doAge, effects, seed,
  })))
}

/** Composite the whole sheet into `composited` across the worker pool. */
export function parallelComposite(
  work: SheetState, src: Uint8ClampedArray, composited: Uint8ClampedArray,
  paperType: PaperType,
): Promise<void> {
  const buffers = buffersOf(work, src, composited)
  const parts = bands(work.h, POOL_SIZE)
  return dispatch(parts.map(([y0, y1]) => ({
    phase: 'composite' as const, buffers, w: work.w, h: work.h, paperType, y0, y1,
  })))
}

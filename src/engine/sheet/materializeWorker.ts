// Worker: runs the per-pixel-independent material passes over one horizontal
// band of a layer. All field arrays are views over SharedArrayBuffers shared
// with the main thread, so there is nothing to copy back — the worker mutates
// shared memory in place and only signals completion.
//
// Because every stage here uses only a pixel's own global (x,y) (composite
// additionally reads its ±1px neighbours, which live in the same shared arrays),
// splitting the image into row bands is byte-for-byte identical to a full pass.

import { seedSheetBand, compositeInto, type SheetState } from './state'
import type { PaperType } from '@/domain/params'
import { applyHistory } from './history'
import type { LayerEffects, SheetOp, ToolParameterValues } from '@/domain/types'
import { toolEngines } from '../tools/registry'
import { simulateWith, type BBox } from '../tools/core/contracts'

export interface BandBuffers {
  rgba: SharedArrayBuffer
  paper: SharedArrayBuffer
  ink: SharedArrayBuffer
  height: SharedArrayBuffer
  water: SharedArrayBuffer
  wet: SharedArrayBuffer
  mobileR: SharedArrayBuffer
  mobileG: SharedArrayBuffer
  mobileB: SharedArrayBuffer
  paint: SharedArrayBuffer
  solubility: SharedArrayBuffer
  porosity: SharedArrayBuffer
  fiberAngle: SharedArrayBuffer
  roughness: SharedArrayBuffer
  fiber: SharedArrayBuffer
  gloss: SharedArrayBuffer
  weak: SharedArrayBuffer
  film: SharedArrayBuffer
  adhesive: SharedArrayBuffer
  dust: SharedArrayBuffer
  temperature: SharedArrayBuffer
  char: SharedArrayBuffer
  src: SharedArrayBuffer
  composited: SharedArrayBuffer
}

type SeedAgeJob = {
  id: number
  phase: 'seedAge'
  buffers: BandBuffers
  w: number
  h: number
  paperType: PaperType
  y0: number
  y1: number
  seedParams: { paperColor: string; yellowing: number; roughness: number; seed: number }
  resetProcess: boolean
  doAge: boolean
  effects: LayerEffects
  seed: number
}
type CompositeJob = {
  id: number
  phase: 'composite'
  buffers: BandBuffers
  w: number
  h: number
  paperType: PaperType
  y0: number
  y1: number
}
// Replay one or more physical strokes over the shared material state, off the
// main thread. Ops are applied in order (order is meaningful) with already
// reference-resolved parameters, mutating the shared buffers in place. The
// solver only touches each op's dirty region, so this is the same maths the main
// thread would run — byte-for-byte — just not on the UI thread.
type ApplyOpsJob = {
  id: number
  phase: 'applyOps'
  buffers: BandBuffers
  w: number
  h: number
  paperType: PaperType
  entries: { op: SheetOp; params: ToolParameterValues }[]
}
export type BandJob = SeedAgeJob | CompositeJob | ApplyOpsJob
export type WorkerDone = { id: number; bbox?: BBox | null }

function stateFrom(b: BandBuffers, w: number, h: number, paperType: PaperType): { state: SheetState; src: Uint8ClampedArray; composited: Uint8ClampedArray } {
  const f = (buf: SharedArrayBuffer) => new Float32Array(buf)
  const u = (buf: SharedArrayBuffer) => new Uint8ClampedArray(buf)
  const state: SheetState = {
    w, h, paperType,
    rgba: u(b.rgba), paper: u(b.paper), ink: f(b.ink), height: f(b.height),
    water: f(b.water), wet: f(b.wet), mobileR: f(b.mobileR), mobileG: f(b.mobileG),
    mobileB: f(b.mobileB), paint: f(b.paint), solubility: f(b.solubility),
    porosity: f(b.porosity), fiberAngle: f(b.fiberAngle), roughness: f(b.roughness),
    fiber: f(b.fiber), gloss: f(b.gloss), weak: f(b.weak), film: f(b.film),
    adhesive: f(b.adhesive), dust: f(b.dust), temperature: f(b.temperature), char: f(b.char),
  }
  return { state, src: u(b.src), composited: u(b.composited) }
}

const union = (a: BBox | null, b: BBox): BBox => (a ? {
  x0: Math.min(a.x0, b.x0), y0: Math.min(a.y0, b.y0),
  x1: Math.max(a.x1, b.x1), y1: Math.max(a.y1, b.y1),
} : b)

self.onmessage = (ev: MessageEvent<BandJob>) => {
  const job = ev.data
  if (job.phase === 'applyOps') {
    const { state } = stateFrom(job.buffers, job.w, job.h, job.paperType)
    let bbox: BBox | null = null
    for (const { op, params } of job.entries) {
      const b = simulateWith(toolEngines[op.tool], state, op, params)
      if (b) bbox = union(bbox, b)
    }
    ;(self as unknown as Worker).postMessage({ id: job.id, bbox } satisfies WorkerDone)
    return
  }
  if (job.y1 >= job.y0) {
    const { state, src, composited } = stateFrom(job.buffers, job.w, job.h, job.paperType)
    if (job.phase === 'seedAge') {
      seedSheetBand(state, src, job.y0, job.y1, job.seedParams, job.resetProcess)
      if (job.doAge) applyHistory(state, job.effects, job.seed, job.y0, job.y1)
    } else {
      compositeInto(state, composited, 0, job.y0, job.w - 1, job.y1)
    }
  }
  ;(self as unknown as Worker).postMessage({ id: job.id } satisfies WorkerDone)
}

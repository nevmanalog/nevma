// Main-thread dispatcher for the OffscreenCanvas bake worker.
//
// Serializes bake requests onto a single persistent worker (bakes share one GL
// context and must not overlap), converts the source into a transferable
// ImageBitmap, and rebuilds an HTMLCanvasElement from the transferred pixels.
// The result is byte-identical to the synchronous bakeMaterial fallback.

import { bakeMaterial, type MaterialInput } from '../bake'
import type { BakeJob, BakeDone } from './bakeWorker'

/**
 * Produce the printed base. Uses the OffscreenCanvas worker when available
 * (keeps the main thread responsive — the material shader can take seconds on
 * software WebGL / GPU-less machines) and falls back to the synchronous,
 * byte-identical bakeMaterial if the worker is unavailable or fails.
 */
export function bakeBase(input: MaterialInput): HTMLCanvasElement | Promise<HTMLCanvasElement> {
  if (!bakeWorkerAvailable()) return bakeMaterial(input)
  return bakeMaterialAsync(input).catch(() => bakeMaterial(input))
}

export function bakeWorkerAvailable(): boolean {
  return (
    typeof Worker !== 'undefined'
    && typeof OffscreenCanvas !== 'undefined'
    && typeof createImageBitmap !== 'undefined'
  )
}

let worker: Worker | null = null
let seq = 0
const pending = new Map<number, {
  resolve: (c: HTMLCanvasElement) => void
  reject: (e: unknown) => void
}>()

function ensureWorker(): Worker {
  if (worker) return worker
  const w = new Worker(new URL('./bakeWorker.ts', import.meta.url), { type: 'module' })
  w.onmessage = (ev: MessageEvent<BakeDone>) => {
    const { id, buf, width, height, error } = ev.data
    const p = pending.get(id)
    if (!p) return
    pending.delete(id)
    if (error || !buf) { p.reject(new Error(error ?? 'bake failed')); return }
    const out = document.createElement('canvas')
    out.width = width
    out.height = height
    out.getContext('2d')!.putImageData(
      new ImageData(new Uint8ClampedArray(buf), width, height), 0, 0,
    )
    p.resolve(out)
  }
  w.onerror = () => {
    // A worker-level failure invalidates every in-flight job; reject them and
    // drop the worker so the next call rebuilds it (or the caller falls back).
    const err = new Error('bake worker error')
    for (const [, p] of pending) p.reject(err)
    pending.clear()
    worker = null
  }
  worker = w
  return w
}

let queue: Promise<unknown> = Promise.resolve()

/** Bake on the worker. Requests are serialized; failures propagate so callers
 * can fall back to the synchronous bakeMaterial. */
export function bakeMaterialAsync(input: MaterialInput): Promise<HTMLCanvasElement> {
  const next = queue.catch(() => {}).then(() => dispatch(input))
  queue = next.catch(() => {})
  return next
}

async function dispatch(input: MaterialInput): Promise<HTMLCanvasElement> {
  const w = ensureWorker()
  // UNPACK_FLIP_Y_WEBGL is ignored for ImageBitmap uploads, so orientation is
  // fixed at creation time. 'flipY' makes the worker texture land in the same
  // orientation as the main-thread canvas upload (FLIP_Y=1) -> byte-identical.
  const source = await createImageBitmap(input.source as ImageBitmapSource, {
    premultiplyAlpha: 'none',
    colorSpaceConversion: 'none',
    imageOrientation: 'flipY',
  })
  const id = ++seq
  return new Promise<HTMLCanvasElement>((resolve, reject) => {
    pending.set(id, { resolve, reject })
    const job: BakeJob = {
      id, width: input.width, height: input.height,
      effects: input.effects, seed: input.seed, source,
    }
    w.postMessage(job, [source])
  })
}

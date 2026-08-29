// OffscreenCanvas material bake worker.
//
// Runs the EXACT same material pass as the main-thread bake (same program, same
// uniforms via drawMaterialPass, same source upload, same gl.readPixels
// readback) but on a worker thread. Under software WebGL (ANGLE/SwiftShader,
// i.e. GPU-less machines) the material shader can take many seconds for a 4K
// image; doing it here keeps the main thread responsive. readPixels forces the
// deferred render to fully complete before the pixels are transferred back —
// this is what makes the output byte-identical to the synchronous bake (a plain
// transferToImageBitmap / gl.finish does NOT force completion under SwiftShader
// and yields stale, non-deterministic pixels).

import { createQuadProgram, type QuadProgram } from './program'
import { MATERIAL_FRAG } from '../shaders/material.frag'
import { drawMaterialPass } from './materialPass'
import { readbackFlipped } from '../bake'
import type { LayerEffects } from '@/domain/types'

interface Renderer {
  canvas: OffscreenCanvas
  gl: WebGL2RenderingContext
  prog: QuadProgram
  uloc: (name: string) => WebGLUniformLocation | null
  tex: WebGLTexture
}

let R: Renderer | null = null

function renderer(): Renderer {
  if (R) return R
  const canvas = new OffscreenCanvas(1, 1)
  const gl = canvas.getContext('webgl2', {
    premultipliedAlpha: false,
    preserveDrawingBuffer: true,
    antialias: false,
  }) as WebGL2RenderingContext | null
  if (!gl) throw new Error('WebGL2 not supported in worker')

  const prog = createQuadProgram(gl, MATERIAL_FRAG)
  const locs = new Map<string, WebGLUniformLocation | null>()
  const uloc = (name: string): WebGLUniformLocation | null => {
    let l = locs.get(name)
    if (l === undefined) { l = gl.getUniformLocation(prog.program, name); locs.set(name, l) }
    return l
  }
  const tex = gl.createTexture()!
  gl.bindTexture(gl.TEXTURE_2D, tex)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)

  R = { canvas, gl, prog, uloc, tex }
  return R
}

export interface BakeJob {
  id: number
  width: number
  height: number
  effects: LayerEffects
  seed: number
  source: ImageBitmap
}

export interface BakeDone {
  id: number
  buf?: ArrayBuffer
  width: number
  height: number
  error?: string
}

self.onmessage = (ev: MessageEvent<BakeJob>) => {
  const job = ev.data
  try {
    const r = renderer()
    const { canvas, gl, prog, uloc, tex } = r
    if (canvas.width !== job.width || canvas.height !== job.height) {
      canvas.width = job.width
      canvas.height = job.height
    }

    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, tex)
    // An ImageBitmap uploads with the opposite vertical orientation to a
    // <canvas>/<img> under UNPACK_FLIP_Y_WEBGL, so FLIP_Y is left OFF here to
    // land the texels in the SAME orientation as the main-thread bake (which
    // uploads a canvas with FLIP_Y=1). This is what makes the procedural,
    // gl_FragCoord-keyed effects line up byte-for-byte with the sync bake.
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 0)
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, 0)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, job.source)
    job.source.close()

    drawMaterialPass(gl, prog, uloc, {
      width: job.width, height: job.height, effects: job.effects, seed: job.seed,
    })

    const img = readbackFlipped(gl, job.width, job.height)
    const buf = img.data.buffer as ArrayBuffer
    const done: BakeDone = { id: job.id, buf, width: job.width, height: job.height }
    ;(self as unknown as Worker).postMessage(done, [buf])
  } catch (e) {
    const done: BakeDone = { id: job.id, width: job.width, height: job.height, error: String(e) }
    ;(self as unknown as Worker).postMessage(done)
  }
}

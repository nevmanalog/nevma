// Bake: apply the full material pipeline to a source.
// Returns an HTMLCanvasElement Konva can render directly.

import { createQuadProgram, type QuadProgram } from './gl/program'
import { MATERIAL_FRAG } from './shaders/material.frag'
import { drawMaterialPass } from './gl/materialPass'
import type { LayerEffects } from '@/domain/types'

export interface MaterialInput {
  source: TexImageSource
  width: number
  height: number
  effects: LayerEffects
  seed: number
}

// Persistent WebGL renderer. Creating a context, compiling the (large) material
// shader, and losing the context on every bake is very expensive and also
// churns the browser's small pool of live GL contexts. Instead we keep ONE
// context, program, VAO, uniform-location cache and source texture alive for
// the whole session and just resize + redraw. Output is byte-for-byte identical
// (same shader, same uniforms, same source); only the setup cost is removed.
interface Renderer {
  canvas: HTMLCanvasElement
  gl: WebGL2RenderingContext
  prog: QuadProgram
  uloc: (name: string) => WebGLUniformLocation | null
  tex: WebGLTexture
  lastSource: TexImageSource | null
}

let R: Renderer | null = null

function renderer(): Renderer {
  if (R) return R
  const canvas = document.createElement('canvas')
  const gl = canvas.getContext('webgl2', {
    premultipliedAlpha: false,
    preserveDrawingBuffer: true,
    antialias: false,
  })
  if (!gl) throw new Error('WebGL2 not supported')
  // A lost context (GPU reset / tab backgrounded) invalidates every resource;
  // drop the cache so the next bake rebuilds from scratch.
  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); R = null })

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

  R = { canvas, gl, prog, uloc, tex, lastSource: null }
  return R
}

export function bakeMaterial(input: MaterialInput): HTMLCanvasElement {
  const { source, width, height, effects, seed } = input
  const r = renderer()
  const { canvas, gl, prog, uloc: u, tex } = r
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width
    canvas.height = height
  }

  gl.activeTexture(gl.TEXTURE0)
  gl.bindTexture(gl.TEXTURE_2D, tex)
  // Re-upload the source only when it actually changed (a new/edited bitmap);
  // repeated bakes from slider tweaks reuse the already-resident texture.
  if (r.lastSource !== source) {
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1)
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, 0)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source)
    r.lastSource = source
  }

  drawMaterialPass(gl, prog, u, { width, height, effects, seed })

  // Read the result back with gl.readPixels. readPixels forces the (deferred)
  // render to fully complete and returns the exact pixels; it produces the same
  // bytes as drawing the GL canvas into a 2D context but without that path's
  // pathologically slow present/copy under ANGLE/SwiftShader. readPixels is
  // bottom-up, so rows are flipped to top-down here — the VALUES are unchanged.
  const out = document.createElement('canvas')
  out.width = width
  out.height = height
  out.getContext('2d')!.putImageData(readbackFlipped(gl, width, height), 0, 0)
  return out
}

// Read the current framebuffer as a top-down ImageData. Shared by the
// main-thread bake and the worker bake so both readbacks are byte-identical.
export function readbackFlipped(
  gl: WebGL2RenderingContext, width: number, height: number,
): ImageData {
  const w4 = width * 4
  const raw = new Uint8Array(width * height * 4)
  gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, raw)
  const flipped = new Uint8ClampedArray(width * height * 4)
  for (let y = 0; y < height; y++) {
    const s = (height - 1 - y) * w4
    flipped.set(raw.subarray(s, s + w4), y * w4)
  }
  return new ImageData(flipped, width, height)
}

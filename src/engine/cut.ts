// Cut engine: selection polygon -> { fragment, donor } canvases.
// The fragment is the cut-out piece (cropped to the selection bounds).
// The donor is the original with a hole.
// Both edges come from the SAME mask (inverted) so they stay consistent.

import { createGL, createTexture } from './gl/context'
import { createQuadProgram } from './gl/program'
import { TEAR_FRAG } from './shaders/tear.frag'
import { polygonToSoftMask, polygonBounds } from '@/shared/raster'
import type { EdgeStyle } from '@/domain/types'

const STYLE_CODE: Record<EdgeStyle, number> = {
  scissors: 0,
  torn: 1,
  worn: 2,
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16)
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]
}

interface TearOptions {
  source: TexImageSource
  mask: TexImageSource
  width: number
  height: number
  invert: boolean
  style: EdgeStyle
  seed: number
  edgeColor: string
}

function runTear(opts: TearOptions): HTMLCanvasElement {
  const { source, mask, width, height, invert, style, seed, edgeColor } = opts
  const { canvas, gl } = createGL(width, height)
  const prog = createQuadProgram(gl, TEAR_FRAG)
  const srcTex = createTexture(gl, source)
  const maskTex = createTexture(gl, mask)
  const [er, eg, eb] = hexToRgb(edgeColor)

  gl.viewport(0, 0, width, height)
  gl.clearColor(0, 0, 0, 0)
  gl.clear(gl.COLOR_BUFFER_BIT)

  prog.draw((gl, p) => {
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, srcTex)
    gl.uniform1i(gl.getUniformLocation(p, 'u_src'), 0)
    gl.activeTexture(gl.TEXTURE1)
    gl.bindTexture(gl.TEXTURE_2D, maskTex)
    gl.uniform1i(gl.getUniformLocation(p, 'u_mask'), 1)
    gl.uniform2f(gl.getUniformLocation(p, 'u_resolution'), width, height)
    gl.uniform1f(gl.getUniformLocation(p, 'u_seed'), seed)
    gl.uniform1f(gl.getUniformLocation(p, 'u_invert'), invert ? 1 : 0)
    gl.uniform1f(gl.getUniformLocation(p, 'u_style'), STYLE_CODE[style])
    gl.uniform3f(gl.getUniformLocation(p, 'u_edgeColor'), er, eg, eb)
  })

  prog.dispose()
  const out = document.createElement('canvas')
  out.width = width
  out.height = height
  out.getContext('2d')!.drawImage(canvas, 0, 0)
  gl.getExtension('WEBGL_lose_context')?.loseContext()
  return out
}

export interface CropBounds { fx: number; fy: number; fw: number; fh: number }

export interface CutResult {
  fragment: { canvas: HTMLCanvasElement; offsetX: number; offsetY: number }
  donor: HTMLCanvasElement
  mask: HTMLCanvasElement
  crop: CropBounds
}

/**
 * Re-run the tear pass on a stored source + mask with a new edge colour.
 * Used to recolour an already-cut edge without re-selecting the shape.
 */
export function retear(
  source: TexImageSource,
  mask: TexImageSource,
  width: number,
  height: number,
  invert: boolean,
  style: EdgeStyle,
  seed: number,
  edgeColor: string,
): HTMLCanvasElement {
  return runTear({ source, mask, width, height, invert, style, seed, edgeColor })
}

export function cutSelection(
  source: TexImageSource,
  width: number,
  height: number,
  points: number[],
  style: EdgeStyle,
  seed: number,
  edgeColor = '#efe7d6',
): CutResult {
  // Wider blur = smoother gradient = the shader can measure distance further
  // from the edge, which is what the multi-scale warp needs to work.
  const blur = style === 'scissors' ? 3 : style === 'torn' ? 14 : 20
  const mask = polygonToSoftMask(points, width, height, blur)

  // Donor: full-size, hole punched (invert = keep outside).
  const donor = runTear({ source, mask, width, height, invert: true, style, seed, edgeColor })

  // Fragment: full-size cut then cropped to bounds to keep it light.
  const fragFull = runTear({ source, mask, width, height, invert: false, style, seed, edgeColor })
  const b = polygonBounds(points)
  const pad = 40 // room for protruding fibers / large edge damage / soft edge
  const fx = Math.max(0, Math.floor(b.minX - pad))
  const fy = Math.max(0, Math.floor(b.minY - pad))
  const fw = Math.min(width - fx, Math.ceil(b.width + pad * 2))
  const fh = Math.min(height - fy, Math.ceil(b.height + pad * 2))

  const cropped = document.createElement('canvas')
  cropped.width = fw
  cropped.height = fh
  cropped.getContext('2d')!.drawImage(fragFull, fx, fy, fw, fh, 0, 0, fw, fh)

  return {
    fragment: { canvas: cropped, offsetX: fx, offsetY: fy },
    donor,
    mask,
    crop: { fx, fy, fw, fh },
  }
}

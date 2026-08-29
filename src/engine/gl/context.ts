// Minimal WebGL2 helpers. Kept tiny on purpose — this is the seed of the future RHI.

export function createGL(width: number, height: number): {
  canvas: HTMLCanvasElement
  gl: WebGL2RenderingContext
} {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const gl = canvas.getContext('webgl2', {
    premultipliedAlpha: false,
    preserveDrawingBuffer: true,
    antialias: false,
  })
  if (!gl) throw new Error('WebGL2 not supported')
  // On low-memory phones the GPU driver can reclaim the context under memory
  // pressure. Left unhandled this throws from deep inside a draw call; just
  // swallowing the event here means the current bake fails gracefully
  // instead of taking the whole tab down with it.
  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault() }, false)
  return { canvas, gl }
}

/** Upload an image/canvas as a texture. */
export function createTexture(
  gl: WebGL2RenderingContext,
  source: TexImageSource,
): WebGLTexture {
  const tex = gl.createTexture()!
  gl.bindTexture(gl.TEXTURE_2D, tex)
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1)
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, 0)
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
  return tex
}

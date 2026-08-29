// Shader program + fullscreen-quad plumbing.

const QUAD_VS = `#version 300 es
in vec2 a_pos;
out vec2 v_uv;
void main() {
  v_uv = a_pos * 0.5 + 0.5;
  gl_Position = vec4(a_pos, 0.0, 1.0);
}`

function compile(gl: WebGL2RenderingContext, type: number, src: string): WebGLShader {
  const sh = gl.createShader(type)!
  gl.shaderSource(sh, src)
  gl.compileShader(sh)
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(sh)
    gl.deleteShader(sh)
    throw new Error(`Shader compile error:\n${log}\n---\n${src}`)
  }
  return sh
}

export interface QuadProgram {
  program: WebGLProgram
  draw(uniforms: (gl: WebGL2RenderingContext, prog: WebGLProgram) => void): void
  dispose(): void
}

export function createQuadProgram(
  gl: WebGL2RenderingContext,
  fragSrc: string,
): QuadProgram {
  const vs = compile(gl, gl.VERTEX_SHADER, QUAD_VS)
  const fs = compile(gl, gl.FRAGMENT_SHADER, fragSrc)
  const program = gl.createProgram()!
  gl.attachShader(program, vs)
  gl.attachShader(program, fs)
  gl.linkProgram(program)
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error(`Program link error:\n${gl.getProgramInfoLog(program)}`)
  }
  gl.deleteShader(vs)
  gl.deleteShader(fs)

  // Fullscreen quad.
  const vao = gl.createVertexArray()!
  gl.bindVertexArray(vao)
  const buf = gl.createBuffer()!
  gl.bindBuffer(gl.ARRAY_BUFFER, buf)
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 3, -1, -1, 3]),
    gl.STATIC_DRAW,
  )
  const loc = gl.getAttribLocation(program, 'a_pos')
  gl.enableVertexAttribArray(loc)
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0)
  gl.bindVertexArray(null)

  return {
    program,
    draw(setUniforms) {
      gl.useProgram(program)
      gl.bindVertexArray(vao)
      setUniforms(gl, program)
      gl.drawArrays(gl.TRIANGLES, 0, 3)
      gl.bindVertexArray(null)
    },
    dispose() {
      gl.deleteProgram(program)
      gl.deleteBuffer(buf)
      gl.deleteVertexArray(vao)
    },
  }
}

// Shared material render core. Runs the full material shader over a fullscreen
// quad using an already-created program + source texture. Works with ANY
// WebGL2 context (a main-thread <canvas> or a worker OffscreenCanvas) so the
// main-thread bake and the OffscreenCanvas worker bake produce byte-identical
// output from the same shader, uniforms and source.

import type { QuadProgram } from './program'
import {
  PAPER_TYPE_CODE, PRINTER_TYPE_CODE, COLOR_MODE_CODE,
  PREPRESS_MODE_CODE, SCANNER_MODE_CODE,
} from '@/domain/params'
import type { LayerEffects } from '@/domain/types'

export function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16)
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]
}

export interface MaterialPassParams {
  width: number
  height: number
  effects: LayerEffects
  seed: number
}

// Set every uniform and draw the fullscreen quad. `tex` must already be bound to
// TEXTURE0. The uniform block here is the single source of truth for both bake
// paths — do not fork it.
export function drawMaterialPass(
  gl: WebGL2RenderingContext,
  prog: QuadProgram,
  u: (name: string) => WebGLUniformLocation | null,
  p: MaterialPassParams,
): void {
  const { width, height, effects, seed } = p
  const { paper, printer, scanner } = effects

  gl.viewport(0, 0, width, height)
  gl.clearColor(0, 0, 0, 0)
  gl.clear(gl.COLOR_BUFFER_BIT)

  prog.draw((gl) => {
    gl.uniform1i(u('u_src'), 0)

    gl.uniform2f(u('u_resolution'), width, height)
    gl.uniform1f(u('u_seed'), seed)
    // Resolution-aware feature scaling: features sized to a ~1400px reference.
    const dpiScale = Math.min(3, Math.max(0.35, Math.max(width, height) / 1400))
    gl.uniform1f(u('u_dpiScale'), dpiScale)
    gl.uniform1f(u('u_intensity'), effects.intensity)
    gl.uniform1i(u('u_paperType'), PAPER_TYPE_CODE[effects.paperType])
    gl.uniform1i(u('u_printerType'), PRINTER_TYPE_CODE[effects.printerType])
    gl.uniform1i(u('u_prepress'), PREPRESS_MODE_CODE[effects.prepress ?? 'fullColor'])
    gl.uniform1i(u('u_scannerMode'), SCANNER_MODE_CODE[effects.scannerMode ?? 'home'])
    const [pr, pg, pb] = hexToRgb(effects.paperColor ?? '#ffffff')
    gl.uniform3f(u('u_paperColor'), pr, pg, pb)

    // per-engine master switches; absent (old data) = on
    const eng = effects.engines
    gl.uniform1i(u('u_paperOn'), eng?.paper === false ? 0 : 1)
    gl.uniform1i(u('u_printerOn'), eng?.printer === false ? 0 : 1)
    gl.uniform1i(u('u_damageOn'), eng?.damage === false ? 0 : 1)
    gl.uniform1i(u('u_scannerOn'), eng?.scanner === false ? 0 : 1)

    // Paper STOCK formation stays in the shader (that is image formation, not
    // damage-as-filter). Everything below that is a physical EVENT on the sheet
    // — stains, moisture, creases, scratches, abrasions, wear, paper damage —
    // is now applied to the material state in engine/sheet/history.ts, so it is
    // zeroed here to avoid double-applying it as a flat overlay.
    gl.uniform1f(u('u_yellowing'), paper.yellowing)
    gl.uniform1f(u('u_fibers'), paper.fibers)
    gl.uniform1f(u('u_roughness'), paper.roughness)
    gl.uniform1f(u('u_thickness'), paper.thickness)
    gl.uniform1f(u('u_stains'), 0)
    gl.uniform1f(u('u_moisture'), 0)
    gl.uniform1f(u('u_creases'), 0)
    gl.uniform1f(u('u_pScratches'), 0)

    gl.uniform1f(u('u_halftone'), printer.halftone)
    gl.uniform1f(u('u_inkDensity'), printer.inkDensity)
    gl.uniform1f(u('u_dpi'), printer.dpi)
    gl.uniform1f(u('u_dotGain'), printer.dotGain)
    gl.uniform1f(u('u_colorShift'), printer.colorShift)
    gl.uniform1f(u('u_registration'), printer.registration)
    gl.uniform1f(u('u_fade'), printer.fade)

    // migrated to engine/sheet/history.ts (physical material events)
    gl.uniform1f(u('u_dScratches'), 0)
    gl.uniform1f(u('u_abrasions'), 0)
    gl.uniform1f(u('u_worn'), 0)
    gl.uniform1f(u('u_paperDamage'), 0)

    gl.uniform1f(u('u_scNoise'), scanner.noise)
    gl.uniform1f(u('u_scDust'), scanner.dust)
    gl.uniform1f(u('u_scStreaks'), scanner.streaks)
    gl.uniform1f(u('u_scDistortion'), scanner.distortion)
    gl.uniform1f(u('u_scColor'), scanner.colorProblems)
    gl.uniform1f(u('u_scJpeg'), scanner.jpeg)
    gl.uniform1f(u('u_scBlur'), scanner.blur)
    gl.uniform1f(u('u_scExposure'), scanner.exposure)

    // scratches — migrated to engine/sheet/history.ts (physical grooves)
    gl.uniform1i(u('u_scratchOn'), 0)
    gl.uniform1i(u('u_scratchPattern'), 0)
    gl.uniform1f(u('u_scratchAmount'), 0)
    gl.uniform1f(u('u_scratchAngle'), 0)
    gl.uniform1f(u('u_scratchDepth'), 0)

    // colour mode
    gl.uniform1i(u('u_colorMode'), COLOR_MODE_CODE[effects.colorMode])
    const [tr, tg, tb] = hexToRgb(effects.tint)
    gl.uniform3f(u('u_tint'), tr, tg, tb)

    gl.uniform1i(u('u_paperTexOn'), 0)
    gl.uniform1f(u('u_paperTexAmt'), 0)
    gl.uniform1i(u('u_stainTexOn'), 0)
    gl.uniform1f(u('u_stainTexAmt'), 0)
    gl.uniform1i(u('u_scanTexOn'), 0)
    gl.uniform1f(u('u_scanTexAmt'), 0)
  })
}

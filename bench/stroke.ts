// Stroke-path parity + timing harness.
//
// Applies a fixed set of physical strokes (one per tool) to an aged sheet and
// prints a byte-exact checksum of the resulting material state, plus the time
// to apply a single large water stroke. Run BEFORE and AFTER a solver change to
// prove the output is byte-for-byte identical while measuring the speed-up.

class FakeCtx {
  constructor(private w: number, private h: number) {}
  getImageData(_x: number, _y: number, w: number, h: number) {
    const data = new Uint8ClampedArray(w * h * 4)
    for (let i = 0; i < data.length; i += 4) {
      data[i] = (i * 7 + 11) & 255
      data[i + 1] = (i * 13 + 3) & 255
      data[i + 2] = (i * 17 + 29) & 255
      data[i + 3] = i % 9973 === 0 ? 0 : 255
    }
    return { data, width: w, height: h }
  }
  createImageData(w: number, h: number) { return { data: new Uint8ClampedArray(w * h * 4), width: w, height: h } }
  putImageData() {}
  drawImage() {}
}
class FakeCanvas { width = 0; height = 0; getContext() { return new FakeCtx(this.width, this.height) } }
;(globalThis as any).document = { createElement: () => new FakeCanvas() }

import { createSheet, type SheetState } from '../src/engine/sheet/state'
import { applyHistory } from '../src/engine/sheet/history'
import { applyToolOperation } from '../src/engine/tools/registry'
import { buildDefaultFinal } from '../src/engine/final/registry'
import type { LayerEffects, SheetOp, PhysicalToolId } from '../src/domain/types'

const W = 1600, H = 1000
const base = new FakeCanvas(); base.width = W; base.height = H

const effects: LayerEffects = {
  intensity: 1, prepress: 'fullColor', colorMode: 'color', tint: '#8a6d3b',
  edgeColor: '#efe7d6', paperColor: '#fff3d0', paperType: 'oldAd',
  printerType: 'offset', scannerMode: 'home',
  paper: { yellowing: 0.4, fibers: 0.3, roughness: 0.35, thickness: 0.5, creases: 0.5, moisture: 0.4, stains: 0.4, scratches: 0.3 } as any,
  printer: {} as any, damage: { scratches: 0.4, abrasions: 0.4, worn: 0.4, paperDamage: 0.3 } as any,
  scanner: {} as any,
  engines: { paper: true, printer: true, damage: true, scanner: true },
  final: buildDefaultFinal(),
}
const SEED = 321

function build(): SheetState {
  const s = createSheet({ base: base as any, paperColor: effects.paperColor, yellowing: effects.paper.yellowing, roughness: effects.paper.roughness, paperType: effects.paperType, seed: SEED })
  applyHistory(s, effects, SEED)
  return s
}

const TOOLS: PhysicalToolId[] = [
  'sandpaper', 'water', 'knife', 'scratches', 'marker', 'pencil',
  'brush', 'tape', 'glue', 'patch', 'burn', 'pins', 'dirt',
]

function makeOps(): SheetOp[] {
  const ops: SheetOp[] = []
  TOOLS.forEach((tool, k) => {
    const cx = 180 + (k % 4) * 340
    const cy = 160 + Math.floor(k / 4) * 240
    ops.push({
      tool, points: [cx, cy, cx + 130, cy + 45, cx + 210, cy + 140, cx + 260, cy + 90],
      parameters: {}, seed: 1000 + k * 37, paperType: 'oldAd', elapsedMs: 700,
    })
  })
  return ops
}

function hashState(s: SheetState): string {
  const fields: ArrayBufferView[] = [
    s.rgba, s.paper, s.ink, s.height, s.water, s.wet, s.mobileR, s.mobileG, s.mobileB,
    s.paint, s.solubility, s.porosity, s.fiberAngle, s.roughness, s.fiber, s.gloss,
    s.weak, s.film, s.adhesive, s.dust, s.temperature, s.char,
  ]
  let h = 0x811c9dc5 >>> 0
  for (const f of fields) {
    const b = new Uint8Array(f.buffer as ArrayBuffer, f.byteOffset, f.byteLength)
    for (let i = 0; i < b.length; i++) { h ^= b[i]; h = Math.imul(h, 0x01000193) >>> 0 }
  }
  return h.toString(16).padStart(8, '0')
}

// --- parity checksum: apply every tool's stroke in order ---
const s = build()
for (const op of makeOps()) applyToolOperation(s, op)
console.log(`state checksum (13 strokes): ${hashState(s)}`)

// --- timing: representative strokes on a fresh aged sheet ---
function timeStroke(label: string, op: SheetOp): void {
  applyToolOperation(build(), { ...op }) // warm JIT
  let best = Infinity
  for (let i = 0; i < 6; i++) {
    const s2 = build()
    const t = performance.now()
    applyToolOperation(s2, { ...op, seed: (op.seed ?? 0) + i })
    best = Math.min(best, performance.now() - t)
  }
  console.log(`${label}: ${best.toFixed(1)} ms`)
}

timeStroke('thin scratch stroke', {
  tool: 'scratches', points: [400, 300, 700, 340, 1000, 300, 1300, 360],
  parameters: {}, seed: 11, paperType: 'oldAd', elapsedMs: 700,
})
timeStroke('medium pencil stroke', {
  tool: 'pencil', points: [500, 400, 640, 460, 780, 520, 920, 470],
  parameters: {}, seed: 22, paperType: 'oldAd', elapsedMs: 700,
})
timeStroke('large water stroke (size 90)', {
  tool: 'water', points: [800, 500, 900, 520, 1000, 560, 1120, 500, 1200, 560],
  parameters: { size: 90 }, seed: 42, paperType: 'oldAd', elapsedMs: 1000,
})

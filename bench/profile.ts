// Standalone profiling harness for the CPU-heavy render passes.
// Mocks just enough of the canvas API to run the real engine functions
// at a 4K resolution and time each stage.

class FakeCtx {
  constructor(private w: number, private h: number) {}
  getImageData(_x: number, _y: number, w: number, h: number) {
    const data = new Uint8ClampedArray(w * h * 4)
    for (let i = 0; i < data.length; i += 4) {
      data[i] = (i * 7) & 255
      data[i + 1] = (i * 13) & 255
      data[i + 2] = (i * 17) & 255
      data[i + 3] = 255
    }
    return { data, width: w, height: h }
  }
  createImageData(w: number, h: number) {
    return { data: new Uint8ClampedArray(w * h * 4), width: w, height: h }
  }
  putImageData() {}
  drawImage() {}
  save() {}
  restore() {}
  translate() {}
  rotate() {}
  scale() {}
  clearRect() {}
}
class FakeCanvas {
  width = 0
  height = 0
  getContext() { return new FakeCtx(this.width, this.height) }
}
;(globalThis as any).document = { createElement: () => new FakeCanvas() }

import { createSheet, compositeInto, composite } from '../src/engine/sheet/state'
import { applyHistory } from '../src/engine/sheet/history'
import { clearNoiseFields } from '../src/engine/sheet/noiseFields'
import { applyFinal } from '../src/engine/final/apply'
import { relaxMaterial } from '../src/engine/material/solver'
import { buildDefaultFinal } from '../src/engine/final/registry'
import type { LayerEffects } from '../src/domain/types'

function bench(label: string, fn: () => void, runs = 3) {
  fn() // warm
  let best = Infinity
  for (let i = 0; i < runs; i++) {
    const t = performance.now()
    fn()
    best = Math.min(best, performance.now() - t)
  }
  console.log(`${label.padEnd(38)} ${best.toFixed(1)} ms`)
}

const W = 3840, H = 2160
console.log(`\n=== 4K profile (${W}x${H} = ${(W * H / 1e6).toFixed(1)}MP) ===`)

const base = new FakeCanvas()
base.width = W; base.height = H

const effects: LayerEffects = {
  intensity: 1, prepress: 'fullColor', colorMode: 'color', tint: '#8a6d3b',
  edgeColor: '#efe7d6', paperColor: '#ffffff', paperType: 'oldAd',
  printerType: 'offset', scannerMode: 'home',
  paper: { yellowing: 0.4, fibers: 0.3, roughness: 0.3, thickness: 0.5, creases: 0.5, moisture: 0.4, stains: 0.4, scratches: 0.3 } as any,
  printer: {} as any, damage: { scratches: 0.4, abrasions: 0.4, worn: 0.4, paperDamage: 0.3 } as any,
  scanner: {} as any,
  engines: { paper: true, printer: true, damage: true, scanner: true },
  final: buildDefaultFinal(),
}

let state: any
bench('createSheet (seed material)', () => { state = createSheet({ base: base as any, paperColor: '#ffffff', yellowing: 0.4, roughness: 0.3, paperType: 'oldAd', seed: 123 }) })
bench('applyHistory (age+damage all on)', () => { applyHistory(state, effects, 123) })

const compBuf = new Uint8ClampedArray(W * H * 4)
bench('compositeInto (full)', () => { compositeInto(state, compBuf, 0, 0, W - 1, H - 1) })

const finalBuf = new Uint8ClampedArray(W * H * 4)
const finalAll = buildDefaultFinal()
for (const k of Object.keys(finalAll)) finalAll[k].enabled = true
bench('applyFinal (all enabled, full)', () => { applyFinal(compBuf, finalBuf, W, H, 0, 0, W - 1, H - 1, finalAll, 1) })
bench('applyFinal (none enabled, full)', () => { applyFinal(compBuf, finalBuf, W, H, 0, 0, W - 1, H - 1, buildDefaultFinal(), 1) })

bench('composite (export flatten)', () => { composite(state) })

// A brush stroke region relax (water) over a ~300px area
bench('relaxMaterial (300x300, 12 steps)', () => {
  relaxMaterial(state, { x0: 1000, y0: 1000, x1: 1300, y1: 1300 }, { steps: 12, spread: 30, tool: 'water', mobility: 1, evaporation: 0.8, tideStrength: 0.5 })
})

console.log('\n=== full first-render (createSheet+applyHistory+composite+final) ===')
bench('full pipeline (4K, cold)', () => {
  const s = createSheet({ base: base as any, paperColor: '#ffffff', yellowing: 0.4, roughness: 0.3, paperType: 'oldAd', seed: 123 })
  applyHistory(s, effects, 123)
  const cb = new Uint8ClampedArray(W * H * 4)
  compositeInto(s, cb, 0, 0, W - 1, H - 1)
  const fb = new Uint8ClampedArray(W * H * 4)
  applyFinal(cb, fb, W, H, 0, 0, W - 1, H - 1, finalAll, 1)
}, 2)

// Honest cold-vs-warm comparison for the noise-field cache (noiseFields.ts):
// a NEW seed this script has never used before, so nothing above could have
// pre-warmed it, then a second call with that same seed+size — simulating
// "first time this layer is aged" vs "user nudges the slider again".
console.log('\n=== noise-field cache: cold vs warm (fresh seed 999, never used above) ===')
clearNoiseFields()
const freshState = createSheet({ base: base as any, paperColor: '#ffffff', yellowing: 0.4, roughness: 0.3, paperType: 'oldAd', seed: 999 })
const t0 = performance.now()
applyHistory(freshState, effects, 999)
console.log(`applyHistory (1st call, seed never cached)   ${(performance.now() - t0).toFixed(1)} ms`)
const t1 = performance.now()
applyHistory(freshState, effects, 999)
console.log(`applyHistory (2nd call, same seed — cached)  ${(performance.now() - t1).toFixed(1)} ms`)

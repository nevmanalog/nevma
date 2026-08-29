// Verify the banded kernels produce byte-for-byte identical results to a full
// single pass, for both the fresh-alloc and reuse paths.

class FakeCtx {
  constructor(private w: number, private h: number) {}
  getImageData(_x: number, _y: number, w: number, h: number) {
    const data = new Uint8ClampedArray(w * h * 4)
    for (let i = 0; i < data.length; i += 4) {
      data[i] = (i * 7 + 11) & 255
      data[i + 1] = (i * 13 + 3) & 255
      data[i + 2] = (i * 17 + 29) & 255
      data[i + 3] = i % 997 === 0 ? 0 : 255
    }
    return { data, width: w, height: h }
  }
  createImageData(w: number, h: number) { return { data: new Uint8ClampedArray(w * h * 4), width: w, height: h } }
  putImageData() {}
  drawImage() {}
}
class FakeCanvas { width = 0; height = 0; getContext() { return new FakeCtx(this.width, this.height) } }
;(globalThis as any).document = { createElement: () => new FakeCanvas() }

import { createSheet, seedSheetBand, allocSheet, compositeInto, type SheetState } from '../src/engine/sheet/state'
import { applyHistory } from '../src/engine/sheet/history'
import { buildDefaultFinal } from '../src/engine/final/registry'
import type { LayerEffects } from '../src/domain/types'

const W = 640, H = 481 // odd height to exercise uneven band splits
const base = new FakeCanvas(); base.width = W; base.height = H
const srcBytes = new FakeCtx(W, H).getImageData(0, 0, W, H).data as Uint8ClampedArray

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
const seed = 4242

function eqFloat(a: Float32Array, b: Float32Array, name: string): boolean {
  if (a.length !== b.length) { console.log(`  LEN MISMATCH ${name}`); return false }
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) { console.log(`  ${name} differs at ${i}: ${a[i]} vs ${b[i]}`); return false }
  return true
}
function eqBytes(a: Uint8ClampedArray, b: Uint8ClampedArray, name: string): boolean {
  if (a.length !== b.length) { console.log(`  LEN MISMATCH ${name}`); return false }
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) { console.log(`  ${name} differs at ${i}: ${a[i]} vs ${b[i]}`); return false }
  return true
}
function compare(a: SheetState, b: SheetState, tag: string) {
  const keys: (keyof SheetState)[] = ['rgba','paper','ink','height','water','wet','mobileR','mobileG','mobileB','paint','solubility','porosity','fiberAngle','roughness','fiber','gloss','weak','film','adhesive','dust','temperature','char']
  let ok = true
  for (const k of keys) {
    const av = a[k] as any, bv = b[k] as any
    if (av instanceof Uint8ClampedArray) { if (!eqBytes(av, bv, `${tag}.${String(k)}`)) ok = false }
    else if (av instanceof Float32Array) { if (!eqFloat(av, bv, `${tag}.${String(k)}`)) ok = false }
  }
  console.log(`${tag}: ${ok ? 'IDENTICAL' : 'DIFFERENT'}`)
  return ok
}

// --- reference: full single pass ---
const ref = createSheet({ base: base as any, paperColor: effects.paperColor, yellowing: effects.paper.yellowing, roughness: effects.paper.roughness, paperType: effects.paperType, seed })
applyHistory(ref, effects, seed)
const refComp = new Uint8ClampedArray(W * H * 4)
compositeInto(ref, refComp, 0, 0, W - 1, H - 1)

// --- banded: seed + age + composite over N uneven bands on shared arrays ---
function banded(N: number): { s: SheetState; comp: Uint8ClampedArray } {
  const s = allocSheet(W, H, effects.paperType)
  const bands: [number, number][] = []
  const per = Math.ceil(H / N)
  for (let y = 0; y < H; y += per) bands.push([y, Math.min(H - 1, y + per - 1)])
  for (const [y0, y1] of bands) seedSheetBand(s, srcBytes, y0, y1, { paperColor: effects.paperColor, yellowing: effects.paper.yellowing, roughness: effects.paper.roughness, seed }, false)
  for (const [y0, y1] of bands) applyHistory(s, effects, seed, y0, y1)
  const comp = new Uint8ClampedArray(W * H * 4)
  for (const [y0, y1] of bands) compositeInto(s, comp, 0, y0, W - 1, y1)
  return { s, comp }
}

let allOk = true
for (const N of [1, 3, 7, 16]) {
  const b = banded(N)
  const so = compare(ref, b.s, `bands=${N} state`)
  const co = eqBytes(refComp, b.comp, `bands=${N} composite`)
  console.log(`bands=${N} composite: ${co ? 'IDENTICAL' : 'DIFFERENT'}`)
  allOk = allOk && so && co
}

// --- reuse path: re-seed into an existing (dirty) state must match fresh ---
const dirty = banded(4).s
// dirty it up
for (let i = 0; i < dirty.water.length; i += 3) { dirty.water[i] = 0.7; dirty.char[i] = 0.3; dirty.height[i] = 1.1 }
seedSheetBand(dirty, srcBytes, 0, H - 1, { paperColor: effects.paperColor, yellowing: effects.paper.yellowing, roughness: effects.paper.roughness, seed }, true)
applyHistory(dirty, effects, seed)
const reuseOk = compare(ref, dirty, 'reuse-path state')
allOk = allOk && reuseOk

console.log(`\n${allOk ? 'ALL IDENTICAL ✓' : 'MISMATCH ✗'}`)
process.exit(allOk ? 0 : 1)

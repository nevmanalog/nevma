// Correctness contract for the render engine's parallel path: the worker pool
// (src/engine/sheet/pool.ts) runs seedSheetBand/applyHistory/compositeInto over
// independent horizontal bands and shares buffers with the main thread. Nothing
// about that split is allowed to change a single pixel versus running the exact
// same passes as one full-height call — the whole point of parallelizing is
// "same answer, more cores". This test is the guardrail for that guarantee: it
// doesn't touch actual Web Workers (that needs a browser), but it exercises the
// same banded-kernel-over-shared-arrays shape they rely on.
//
// If this test starts failing after a change to state.ts/history.ts, that
// change introduced a dependency on band boundaries (e.g. reading a
// neighbouring pixel that hasn't been written yet in another band) — a real
// correctness bug, not a false positive.

import { describe, it } from 'vitest'
import { installFakeDom, makeFakeCanvas } from '../helpers/fakeDom'
import { assertTypedArraysEqual } from '../helpers/typedArrays'

installFakeDom()

const {
  createSheet, seedSheetBand, allocSheet, compositeInto,
} = await import('@/engine/sheet/state')
const { applyHistory } = await import('@/engine/sheet/history')
const { buildDefaultFinal } = await import('@/engine/final/registry')
type SheetState = Awaited<ReturnType<typeof createSheet>>
type LayerEffects = Parameters<typeof applyHistory>[1]

const W = 640, H = 481 // odd height, deliberately: exercises uneven band splits
const base = makeFakeCanvas(W, H)
// Read source pixels through the SAME fake canvas createSheet() reads from
// internally, so this and the banded path are guaranteed to agree on source
// content — deriving it from a separately-formulated array risks the two
// silently drifting apart (a bug in the test, not the engine).
const srcBytes = (base.getContext('2d') as any).getImageData(0, 0, W, H).data as Uint8ClampedArray

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

const FIELD_KEYS = [
  'rgba', 'paper', 'ink', 'height', 'water', 'wet', 'mobileR', 'mobileG', 'mobileB',
  'paint', 'solubility', 'porosity', 'fiberAngle', 'roughness', 'fiber', 'gloss',
  'weak', 'film', 'adhesive', 'dust', 'temperature', 'char',
] as const

function expectIdenticalState(a: SheetState, b: SheetState): void {
  for (const k of FIELD_KEYS) {
    assertTypedArraysEqual((a as any)[k], (b as any)[k], `field "${k}"`)
  }
}

function reference() {
  const ref = createSheet({
    base: base as any, paperColor: effects.paperColor, yellowing: effects.paper.yellowing,
    roughness: effects.paper.roughness, paperType: effects.paperType, seed,
  })
  applyHistory(ref, effects, seed)
  const refComp = new Uint8ClampedArray(W * H * 4)
  compositeInto(ref, refComp, 0, 0, W - 1, H - 1)
  return { ref, refComp }
}

function banded(N: number): { s: SheetState; comp: Uint8ClampedArray } {
  const s = allocSheet(W, H, effects.paperType)
  const bands: [number, number][] = []
  const per = Math.ceil(H / N)
  for (let y = 0; y < H; y += per) bands.push([y, Math.min(H - 1, y + per - 1)])
  for (const [y0, y1] of bands) {
    seedSheetBand(s, srcBytes, y0, y1, {
      paperColor: effects.paperColor, yellowing: effects.paper.yellowing,
      roughness: effects.paper.roughness, seed,
    }, false)
  }
  for (const [y0, y1] of bands) applyHistory(s, effects, seed, y0, y1)
  const comp = new Uint8ClampedArray(W * H * 4)
  for (const [y0, y1] of bands) compositeInto(s, comp, 0, y0, W - 1, y1)
  return { s, comp }
}

describe('parallel/banded rendering matches a single full-height pass', () => {
  const { ref, refComp } = reference()

  it.each([1, 3, 7, 16])('bands=%i produces identical state and composite', (N) => {
    const b = banded(N)
    expectIdenticalState(ref, b.s)
    assertTypedArraysEqual(b.comp, refComp, 'composite')
  })

  it('reusing a dirty SheetState matches seeding fresh', () => {
    const dirty = banded(4).s
    // Simulate a layer that's already been worked on before being re-seeded
    // (e.g. the user tweaks a paper slider after painting on the sheet).
    for (let i = 0; i < dirty.water.length; i += 3) {
      dirty.water[i] = 0.7; dirty.char[i] = 0.3; dirty.height[i] = 1.1
    }
    seedSheetBand(dirty, srcBytes, 0, H - 1, {
      paperColor: effects.paperColor, yellowing: effects.paper.yellowing,
      roughness: effects.paper.roughness, seed,
    }, true)
    applyHistory(dirty, effects, seed)
    expectIdenticalState(ref, dirty)
  })
})

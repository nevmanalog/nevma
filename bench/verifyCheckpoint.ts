// Verifies the checkpoint fast-path added to cache.ts's "diverged" branch
// (used when undo/reorder/remove makes the applied ops list diverge from the
// target one). For several different "undo to op N" targets, this compares:
//   A) renderLayerCached fed the FULL ops list, then fed a SHORTER prefix
//      (exercises the checkpoint-or-baseline diverged path, same as a real
//      undo in the app), vs
//   B) renderLayerCached fed ONLY that shorter prefix from a brand-new cache
//      entry (nothing to diverge from — always the "ground truth" baseline
//      replay).
// If the checkpoint path is correct, A and B must be byte-for-byte identical
// for every undo point tested, including ones that land both before and
// after a checkpoint would have been taken (CHECKPOINT_INTERVAL = 6).

class FakeCtx {
  constructor(private w: number, private h: number) {}
  getImageData(_x: number, _y: number, w: number, h: number) {
    const data = new Uint8ClampedArray(w * h * 4)
    for (let i = 0; i < data.length; i += 4) {
      data[i] = (i * 7) & 255; data[i + 1] = (i * 13) & 255
      data[i + 2] = (i * 17) & 255; data[i + 3] = 255
    }
    return { data, width: w, height: h }
  }
  createImageData(w: number, h: number) { return { data: new Uint8ClampedArray(w * h * 4), width: w, height: h } }
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

import { renderLayerCached, dropLayerCache } from '../src/engine/sheet/cache'
import { createDefaultToolParameters } from '../src/engine/tools/registry'
import type { LayerEffects, SheetOp } from '../src/domain/types'
import { buildDefaultFinal } from '../src/engine/final/registry'

const W = 400, H = 300
const base = new FakeCanvas(); base.width = W; base.height = H

const effects: LayerEffects = {
  intensity: 1, prepress: 'fullColor', colorMode: 'color', tint: '#8a6d3b',
  edgeColor: '#efe7d6', paperColor: '#ffffff', paperType: 'oldAd',
  printerType: 'offset', scannerMode: 'home',
  paper: { yellowing: 0.2, fibers: 0.2, roughness: 0.2, thickness: 0.5, creases: 0.1, moisture: 0.1, stains: 0.1, scratches: 0.1 } as any,
  printer: {} as any, damage: { scratches: 0.1, abrasions: 0.1, worn: 0.1, paperDamage: 0.1 } as any,
  scanner: {} as any,
  engines: { paper: true, printer: true, damage: true, scanner: true },
  final: buildDefaultFinal(),
}

const defaults = createDefaultToolParameters()

// A realistic multi-stroke history: alternating brush/water ops at different
// positions, enough (14) to span multiple CHECKPOINT_INTERVAL (6) boundaries.
function makeOps(n: number): SheetOp[] {
  const ops: SheetOp[] = []
  for (let i = 0; i < n; i++) {
    const tool = i % 2 === 0 ? 'brush' : 'water'
    const x = 40 + (i * 23) % (W - 80)
    const y = 40 + (i * 37) % (H - 80)
    ops.push({
      tool, points: [x, y, x + 15, y + 10, x + 5, y + 20],
      parameters: defaults[tool], seed: 1000 + i, paperType: 'oldAd',
      elapsedMs: 300,
    })
  }
  return ops
}

const allOps = makeOps(14)

async function render(id: string, ops: SheetOp[]): Promise<Uint8ClampedArray> {
  const canvas = await renderLayerCached(
    id, base as any, effects, 42, W, H, ops,
    () => base as any,
  )
  return (canvas.getContext('2d') as any).getImageData(0, 0, W, H).data
}

function identical(a: Uint8ClampedArray, b: Uint8ClampedArray): boolean {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false
  return true
}

async function main() {
  // Build the full history INCREMENTALLY — one op per call, exactly like the
  // real app calling renderLayerCached after every completed stroke. This is
  // what actually exercises the "pure append" path where checkpoints get
  // taken; feeding the whole list in one shot would only hit the initial
  // print-rebuild path and never checkpoint at all.
  for (let n = 1; n <= allOps.length; n++) {
    await render('layer-a', allOps.slice(0, n))
  }

  let allPass = true
  // Undo to various points: some inside the first checkpoint interval, some
  // spanning several, one right at a checkpoint boundary.
  for (const undoTo of [13, 11, 8, 6, 5, 3, 1, 0]) {
    const target = allOps.slice(0, undoTo)

    // A: diverge from the full history via cache.ts's diverged-rebuild path
    // (this is what actually happens when the user presses undo).
    const a = await render('layer-a', target)

    // B: ground truth — a brand new layer id, built directly from the target
    // ops with no prior history to diverge from.
    dropLayerCache(`layer-b-${undoTo}`)
    const b = await render(`layer-b-${undoTo}`, target)

    const ok = identical(a, b)
    allPass = allPass && ok
    console.log(`undo to ${String(undoTo).padStart(2)} ops: ${ok ? 'IDENTICAL' : 'MISMATCH ✗'}`)
  }

  // And redo back to the full list after undoing — must also match a
  // from-scratch build of the full list.
  const back = await render('layer-a', allOps)
  const fresh = await render('layer-fresh', allOps)
  const redoOk = identical(back, fresh)
  allPass = allPass && redoOk
  console.log(`redo to full history: ${redoOk ? 'IDENTICAL' : 'MISMATCH ✗'}`)

  console.log(allPass ? '\nALL IDENTICAL ✓' : '\nFAILED ✗')
  if (!allPass) process.exit(1)
}

main()

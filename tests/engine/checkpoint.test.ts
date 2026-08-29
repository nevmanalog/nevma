// Correctness contract for the undo checkpoint added in Phase 1
// (src/engine/sheet/cache.ts: setCheckpoint/maybeCheckpoint/tryResumeFromCheckpoint).
//
// The checkpoint exists purely as a performance shortcut for the
// "diverged" rebuild path (undo/reorder/remove): instead of always replaying
// every op from the material baseline, it may resume from a more recent
// snapshot. That must NEVER change the result — if it does, this is the
// single most important place in the codebase to catch it, since a silent
// pixel mismatch here would show up as "undo sometimes looks slightly wrong"
// in production, which is exactly the kind of bug that's miserable to track
// down after the fact.

import { describe, it } from 'vitest'
import { installFakeDom, makeFakeCanvas } from '../helpers/fakeDom'
import { assertTypedArraysEqual } from '../helpers/typedArrays'

installFakeDom()

const { renderLayerCached, dropLayerCache } = await import('@/engine/sheet/cache')
const { createDefaultToolParameters } = await import('@/engine/tools/registry')
const { buildDefaultFinal } = await import('@/engine/final/registry')
type LayerEffects = Parameters<typeof renderLayerCached>[2]

const W = 400, H = 300
const base = makeFakeCanvas(W, H)

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
// positions, spanning several CHECKPOINT_INTERVAL (6) boundaries.
function makeOps(n: number): any[] {
  const ops = []
  for (let i = 0; i < n; i++) {
    const tool = i % 2 === 0 ? 'brush' : 'water'
    const x = 40 + (i * 23) % (W - 80)
    const y = 40 + (i * 37) % (H - 80)
    ops.push({
      tool, points: [x, y, x + 15, y + 10, x + 5, y + 20],
      parameters: (defaults as any)[tool], seed: 1000 + i, paperType: 'oldAd',
      elapsedMs: 300,
    })
  }
  return ops
}

const allOps = makeOps(14)

async function render(id: string, ops: any[]): Promise<Uint8ClampedArray> {
  const canvas = await renderLayerCached(id, base as any, effects, 42, W, H, ops, () => base as any)
  return (canvas.getContext('2d') as any).getImageData(0, 0, W, H).data
}

describe('undo checkpoint fast-path matches a from-scratch build', () => {
  it('every undo point in a 14-op history is byte-identical to ground truth', async () => {
    // Build incrementally — one op per call — exactly like the app calling
    // renderLayerCached after every completed stroke. This is the only thing
    // that exercises the checkpoint-taking "pure append" path; feeding the
    // whole list in one shot would only hit the initial print-rebuild path.
    for (let n = 1; n <= allOps.length; n++) {
      await render('layer-a', allOps.slice(0, n))
    }

    for (const undoTo of [13, 11, 8, 6, 5, 3, 1, 0]) {
      const target = allOps.slice(0, undoTo)

      // Diverge from the full history via cache.ts's diverged-rebuild path —
      // what actually happens when the user presses undo.
      const a = await render('layer-a', target)

      // Ground truth: a brand new layer id built directly from the target
      // ops, with no prior history to diverge (or checkpoint) from.
      const freshId = `ground-truth-${undoTo}`
      dropLayerCache(freshId)
      const b = await render(freshId, target)

      assertTypedArraysEqual(a, b, `undo to ${undoTo} ops`)
    }

    // Redo back to the full list — must also match a from-scratch build.
    const back = await render('layer-a', allOps)
    dropLayerCache('ground-truth-full')
    const fresh = await render('ground-truth-full', allOps)
    assertTypedArraysEqual(back, fresh, 'redo to full history')
  })
})

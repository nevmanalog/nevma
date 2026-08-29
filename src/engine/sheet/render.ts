// Materialize the sheet: turn the printed base into a physical SheetState,
// age/damage it, replay the ordered physical operations, then flatten.
//
// The screen ALWAYS shows a composited physical sheet, never raw filter output:
//   printed base  (image formation only — print/paper stock/scanner)
//     -> createSheet   estimate ink sitting on the paper stock
//     -> applyHistory  age, crease, damp, stain, scratch, wear the material
//     -> replay ops    each user tool mutates what the previous one left
//     -> composite     relief lighting + gloss derive the visible image
//
// Because every stage mutates one shared material state in order, swapping two
// steps (e.g. water and sandpaper) genuinely changes the result.

import type { SheetOp, LayerEffects } from '@/domain/types'
import { createSheet, composite } from './state'
import { applyHistory } from './history'
import { applyToolOperation } from '@/engine/tools/registry'

export function renderSheet(
  base: HTMLCanvasElement,
  ops: SheetOp[],
  effects: LayerEffects,
  seed: number,
): HTMLCanvasElement {
  const state = createSheet({
    base,
    paperColor: effects.paperColor ?? '#ffffff',
    yellowing: effects.paper?.yellowing ?? 0,
    roughness: effects.paper?.roughness ?? 0,
    paperType: effects.paperType,
    seed,
  })
  applyHistory(state, effects, seed)
  for (const op of ops) applyToolOperation(state, op)
  return composite(state)
}

export type { SheetState } from './state'

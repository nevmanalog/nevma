import type {
  PhysicalToolId, SheetOp, ToolParameterValues, WorkshopToolId,
} from '@/domain/types'
import type { SheetState } from '@/engine/sheet/state'
import type { BBox, PhysicalToolEngine } from './core/contracts'
import { cloneParameters, mergeParameters } from './core/parameters'
import { referenceDevelopment } from '@/engine/reference/development'
import { sandpaperEngine } from './sandpaper/engine'
import { waterEngine } from './water/engine'
import { knifeEngine } from './knife/engine'
import { scratchesEngine } from './scratches/engine'
import { markerEngine } from './marker/engine'
import { pencilEngine } from './pencil/engine'
import { paintbrushEngine } from './paintbrush/engine'
import { tapeEngine } from './tape/engine'
import { glueEngine } from './glue/engine'
import { patchEngine } from './patch/engine'
import { burnEngine } from './burn/engine'
import { pinsEngine } from './pins/engine'
import { dirtEngine } from './dirt/engine'
import { simulateWith } from './core/contracts'

export const PHYSICAL_TOOL_IDS: readonly PhysicalToolId[] = [
  'sandpaper',
  'water',
  'knife',
  'scratches',
  'marker',
  'pencil',
  'brush',
  'tape',
  'glue',
  'patch',
  'burn',
  'pins',
  'dirt',
]

export const toolEngines: Record<PhysicalToolId, PhysicalToolEngine> = {
  sandpaper: sandpaperEngine,
  water: waterEngine,
  knife: knifeEngine,
  scratches: scratchesEngine,
  marker: markerEngine,
  pencil: pencilEngine,
  brush: paintbrushEngine,
  tape: tapeEngine,
  glue: glueEngine,
  patch: patchEngine,
  burn: burnEngine,
  pins: pinsEngine,
  dirt: dirtEngine,
}

export function isPhysicalToolId(tool: WorkshopToolId): tool is PhysicalToolId {
  return tool !== 'move' && tool !== 'cut' && tool !== 'pen'
}

export function getPhysicalToolEngine(tool: WorkshopToolId): PhysicalToolEngine | null {
  return isPhysicalToolId(tool) ? toolEngines[tool] : null
}

export function createDefaultToolParameters(): Record<PhysicalToolId, ToolParameterValues> {
  return {
    sandpaper: cloneParameters(sandpaperEngine.defaults),
    water: cloneParameters(waterEngine.defaults),
    knife: cloneParameters(knifeEngine.defaults),
    scratches: cloneParameters(scratchesEngine.defaults),
    marker: cloneParameters(markerEngine.defaults),
    pencil: cloneParameters(pencilEngine.defaults),
    brush: cloneParameters(paintbrushEngine.defaults),
    tape: cloneParameters(tapeEngine.defaults),
    glue: cloneParameters(glueEngine.defaults),
    patch: cloneParameters(patchEngine.defaults),
    burn: cloneParameters(burnEngine.defaults),
    pins: cloneParameters(pinsEngine.defaults),
    dirt: cloneParameters(dirtEngine.defaults),
  }
}

// Resolve an op's effective parameters (engine defaults <- op params <- active
// reference-profile overrides). Split out so the worker path can resolve on the
// main thread and hand the concrete values to the worker, keeping the worker
// independent of the (main-thread-only) reference registry — the simulation then
// runs identically on or off the main thread.
export function resolveOpParameters(op: SheetOp): ToolParameterValues {
  const engine = toolEngines[op.tool]
  const concrete = mergeParameters(engine.defaults, op.parameters)
  return referenceDevelopment.resolve(op.tool, concrete, op.reference)
}

export function applyToolOperation(state: SheetState, op: SheetOp): BBox | null {
  return simulateWith(toolEngines[op.tool], state, op, resolveOpParameters(op))
}

// The stack a layer stores keeps every op, on or off, so a disabled one can be
// re-enabled with its settings intact. Rendering only ever replays the enabled
// subset — this is the single place that distinction is applied, so every
// bake/export site stays byte-for-byte in sync with what the Ops panel shows.
export function effectiveOps(ops: SheetOp[]): SheetOp[] {
  return ops.filter((op) => op.enabled !== false)
}

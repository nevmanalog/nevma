import type { TKey } from '@/i18n/dict'
import type {
  PhysicalToolId, SheetOp, ToolParameterValues,
} from '@/domain/types'
import type { SheetState } from '@/engine/sheet/state'
import { relaxMaterial } from '@/engine/material/solver'
import type { ImpactField } from './geometry'

export interface BBox {
  x0: number
  y0: number
  x1: number
  y1: number
}

export type ParameterFormat = 'number' | 'pixels' | 'percent' | 'degrees'

export interface ToolParameterSpec {
  key: string
  labelKey: TKey
  kind: 'range' | 'color'
  min?: number
  max?: number
  step?: number
  format?: ParameterFormat
}

export type CursorKind =
  | 'circle' | 'pad' | 'chisel' | 'wedge' | 'band'
  | 'dots' | 'cross' | 'pencil' | 'bristle' | 'sheet'

export interface ToolCursor {
  kind: CursorKind
  radius: number
  length: number
  width: number
  angle: number
  color: string
}

export interface ToolStageContext {
  state: SheetState
  op: SheetOp
  parameters: ToolParameterValues
  impact: ImpactField
}

export interface ToolSimulationModules {
  impact: (state: SheetState, op: SheetOp, parameters: ToolParameterValues) => ImpactField | null
  interactions: (context: ToolStageContext) => void
  paper: (context: ToolStageContext) => void
  paint: (context: ToolStageContext) => void
  texture: (context: ToolStageContext) => void
  variability: (context: ToolStageContext) => void
  render: (context: ToolStageContext) => BBox | null
}

export interface PhysicalToolEngine {
  id: PhysicalToolId
  defaults: ToolParameterValues
  controls: readonly ToolParameterSpec[]
  cursor: (parameters: ToolParameterValues) => ToolCursor
  modules: ToolSimulationModules
  dynamics?: (parameters: ToolParameterValues) => {
    steps: number
    spread: number
    mobility?: number
    evaporation?: number
    tideStrength?: number
  }
}

export const emptyStage = () => {}

function adaptImpactToSurface(
  state: SheetState,
  impact: ImpactField,
  tool: PhysicalToolId,
): void {
  const liquid = tool === 'water' || tool === 'glue' || tool === 'brush' || tool === 'marker'
  const destructive = tool === 'sandpaper' || tool === 'knife' || tool === 'scratches' || tool === 'pins'
  const covering = tool === 'tape' || tool === 'patch'

  for (let localY = 0; localY < impact.bh; localY++) {
    for (let localX = 0; localX < impact.bw; localX++) {
      const localIndex = localY * impact.bw + localX
      const coverage = impact.coverage[localIndex]
      if (coverage <= 0) continue
      const x = impact.x0 + localX
      const y = impact.y0 + localY
      const index = y * state.w + x
      const left = x > 0 ? index - 1 : index
      const right = x + 1 < state.w ? index + 1 : index
      const up = y > 0 ? index - state.w : index
      const down = y + 1 < state.h ? index + state.w : index
      const luma = (sample: number) => {
        const p = sample * 4
        return state.rgba[p] * 0.299 + state.rgba[p + 1] * 0.587 + state.rgba[p + 2] * 0.114
      }
      const textureContrast = Math.min(
        1,
        (Math.abs(luma(right) - luma(left)) + Math.abs(luma(down) - luma(up))) / 255,
      )
      const relief = Math.min(
        1,
        (Math.abs(state.height[right] - state.height[left])
          + Math.abs(state.height[down] - state.height[up])) * 0.35,
      )

      let response = 0.9
      if (liquid) {
        response = 0.72
          + state.porosity[index] * 0.24
          + state.roughness[index] * 0.12
          + state.wet[index] * 0.12
          + textureContrast * 0.06
          - state.film[index] * 0.34
      } else if (destructive) {
        response = 0.76
          + state.weak[index] * 0.24
          + state.fiber[index] * 0.16
          + state.roughness[index] * 0.1
          + state.char[index] * 0.16
          + relief * 0.1
          + textureContrast * 0.06
      } else if (covering) {
        response = 0.96
          + relief * 0.04
          + textureContrast * 0.015
          + state.adhesive[index] * 0.03
          - state.water[index] * 0.03
      } else if (tool === 'burn') {
        response = 0.72
          + state.roughness[index] * 0.15
          + state.fiber[index] * 0.15
          + state.paint[index] * 0.08
          + state.char[index] * 0.2
          + textureContrast * 0.08
          - state.wet[index] * 0.2
      } else {
        response = 0.8
          + state.roughness[index] * 0.14
          + state.fiber[index] * 0.1
          + relief * 0.08
          + textureContrast * 0.05
      }
      impact.coverage[localIndex] = Math.max(0, Math.min(1, coverage * response))
    }
  }
}

export function simulateWith(engine: PhysicalToolEngine, state: SheetState, op: SheetOp, parameters: ToolParameterValues): BBox | null {
  const impact = engine.modules.impact(state, op, parameters)
  if (!impact) return null
  adaptImpactToSurface(state, impact, engine.id)
  const context = { state, op, parameters, impact }
  engine.modules.interactions(context)
  engine.modules.paper(context)
  engine.modules.paint(context)
  engine.modules.texture(context)
  engine.modules.variability(context)
  const rendered = engine.modules.render(context)
  if (!rendered) return null
  const dynamics = engine.dynamics?.(parameters) ?? { steps: 2, spread: 3 }
  const elapsedScale = Math.max(0.75, Math.min(2.2, (op.elapsedMs ?? Math.max(120, op.points.length * 12)) / 520))
  return relaxMaterial(state, rendered, {
    steps: Math.max(1, Math.round(dynamics.steps * elapsedScale)),
    spread: dynamics.spread,
    tool: engine.id,
    mobility: dynamics.mobility,
    evaporation: dynamics.evaporation,
    tideStrength: dynamics.tideStrength,
    impact,
  })
}

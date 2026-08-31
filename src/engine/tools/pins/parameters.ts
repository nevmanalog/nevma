import type { ToolParameterValues } from '@/domain/types'
import type { ToolParameterSpec } from '../core/contracts'

export const pinsDefaults: ToolParameterValues = {
  size: 18,
  holeRatio: 0.16,
  rimRatio: 1.7,
  fiberBurst: 0.9,
  edgeLift: 0.35,
  edgeRaggedness: 0.6,
}

export const pinsControls: readonly ToolParameterSpec[] = [
  { key: 'size', labelKey: 'brSize', helpKey: 'hPinsSize', kind: 'range', min: 3, max: 80, step: 1, format: 'pixels' },
]

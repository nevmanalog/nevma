import type { ToolParameterValues } from '@/domain/types'
import type { ToolParameterSpec } from '../core/contracts'

export const burnDefaults: ToolParameterValues = {
  size: 36,
  pressure: 0.55,
  edgeIrregularity: 0.3,
  heatTransfer: 0.4,
  charThreshold: 0.66,
  holeThreshold: 0.92,
  embrittlement: 0.5,
}

export const burnControls: readonly ToolParameterSpec[] = [
  { key: 'size', labelKey: 'brSize', helpKey: 'hBurnSize', kind: 'range', min: 3, max: 180, step: 1, format: 'pixels' },
  { key: 'pressure', labelKey: 'brPressure', helpKey: 'hBurnPressure', kind: 'range', min: 0.05, max: 1, step: 0.01, format: 'percent' },
]

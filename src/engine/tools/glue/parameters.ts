import type { ToolParameterValues } from '@/domain/types'
import type { ToolParameterSpec } from '../core/contracts'

export const glueDefaults: ToolParameterValues = {
  size: 28,
  pressure: 0.6,
  viscosity: 0.7,
  stringiness: 0.6,
  gloss: 0.7,
  shrinkage: 0.3,
}

export const glueControls: readonly ToolParameterSpec[] = [
  { key: 'size', labelKey: 'brSize', kind: 'range', min: 3, max: 160, step: 1, format: 'pixels' },
  { key: 'pressure', labelKey: 'brPressure', kind: 'range', min: 0.05, max: 1, step: 0.01, format: 'percent' },
]

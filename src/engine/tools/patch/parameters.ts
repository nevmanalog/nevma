import type { ToolParameterValues } from '@/domain/types'
import type { ToolParameterSpec } from '../core/contracts'

export const patchDefaults: ToolParameterValues = {
  size: 52,
  stockWarmth: 0.5,
  fiberScale: 0.5,
  edgeTear: 0.18,
  thickness: 0.18,
  adhesiveSheen: 0.1,
  shadow: 0.22,
}

export const patchControls: readonly ToolParameterSpec[] = [
  { key: 'size', labelKey: 'brSize', helpKey: 'hPatchSize', kind: 'range', min: 8, max: 240, step: 1, format: 'pixels' },
]

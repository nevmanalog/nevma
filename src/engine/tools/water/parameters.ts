import type { ToolParameterValues } from '@/domain/types'
import type { ToolParameterSpec } from '../core/contracts'

export const waterDefaults: ToolParameterValues = {
  size: 48,
  pressure: 0.55,
  angle: 90,
  edgeIrregularity: 0.34,
  pigmentMobility: 0.72,
  tideStrength: 0.22,
  cockling: 0.5,
}

export const waterControls: readonly ToolParameterSpec[] = [
  { key: 'size', labelKey: 'brSize', kind: 'range', min: 4, max: 220, step: 1, format: 'pixels' },
  { key: 'pressure', labelKey: 'brPressure', kind: 'range', min: 0.05, max: 1, step: 0.01, format: 'percent' },
  { key: 'angle', labelKey: 'brAngle', kind: 'range', min: 0, max: 360, step: 1, format: 'degrees' },
]

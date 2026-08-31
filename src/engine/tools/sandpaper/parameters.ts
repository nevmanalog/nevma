import type { ToolParameterValues } from '@/domain/types'
import type { ToolParameterSpec } from '../core/contracts'

export const sandpaperDefaults: ToolParameterValues = {
  size: 42,
  pressure: 0.6,
  angle: 90,
  randomness: 0.4,
  padAspect: 0.85,
  inkRemoval: 0.9,
  fiberLift: 0.55,
  cutThreshold: 0.92,
}

export const sandpaperControls: readonly ToolParameterSpec[] = [
  { key: 'size', labelKey: 'brSize', helpKey: 'hSandSize', kind: 'range', min: 4, max: 220, step: 1, format: 'pixels' },
  { key: 'pressure', labelKey: 'brPressure', helpKey: 'hSandPressure', kind: 'range', min: 0.05, max: 1, step: 0.01, format: 'percent' },
  { key: 'angle', labelKey: 'brAngle', helpKey: 'hSandAngle', kind: 'range', min: 0, max: 360, step: 1, format: 'degrees' },
  { key: 'randomness', labelKey: 'brRandom', helpKey: 'hSandRandom', kind: 'range', min: 0, max: 1, step: 0.01, format: 'percent' },
]

import type { ToolParameterValues } from '@/domain/types'
import type { ToolParameterSpec } from '../core/contracts'

export const knifeDefaults: ToolParameterValues = {
  size: 12,
  pressure: 0.7,
  kerfWidth: 0.35,
  lipLift: 0.5,
  severThreshold: 0.72,
  fiberFeather: 0.4,
}

export const knifeControls: readonly ToolParameterSpec[] = [
  { key: 'size', labelKey: 'brSize', helpKey: 'hKnifeSize', kind: 'range', min: 2, max: 80, step: 1, format: 'pixels' },
  { key: 'pressure', labelKey: 'brPressure', helpKey: 'hKnifePressure', kind: 'range', min: 0.05, max: 1, step: 0.01, format: 'percent' },
  { key: 'kerfWidth', labelKey: 'brKerf', helpKey: 'hKnifeKerf', kind: 'range', min: 0.1, max: 1, step: 0.01, format: 'percent' },
  { key: 'fiberFeather', labelKey: 'brFiber', helpKey: 'hKnifeFiber', kind: 'range', min: 0, max: 1, step: 0.01, format: 'percent' },
]

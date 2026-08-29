import type { ToolParameterValues } from '@/domain/types'
import type { ToolParameterSpec } from '../core/contracts'

export const dirtDefaults: ToolParameterValues = {
  size: 38,
  pressure: 0.5,
  grit: 0.5,
  grease: 0.35,
  dustRate: 0.05,
  fingerprintFrequency: 0.35,
  creviceAffinity: 1.3,
}

export const dirtControls: readonly ToolParameterSpec[] = [
  { key: 'size', labelKey: 'brSize', kind: 'range', min: 4, max: 180, step: 1, format: 'pixels' },
  { key: 'pressure', labelKey: 'brPressure', kind: 'range', min: 0.05, max: 1, step: 0.01, format: 'percent' },
  { key: 'grit', labelKey: 'brGrit', kind: 'range', min: 0, max: 1, step: 0.01, format: 'percent' },
]

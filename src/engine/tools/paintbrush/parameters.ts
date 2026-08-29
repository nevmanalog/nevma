import type { ToolParameterValues } from '@/domain/types'
import type { ToolParameterSpec } from '../core/contracts'

export const paintbrushDefaults: ToolParameterValues = {
  size: 28,
  pressure: 0.65,
  randomness: 0.35,
  color: '#3d2418',
  bristleCount: 9,
  paintLoad: 0.8,
  impasto: 0.7,
  wetSheen: 0.35,
  blend: 0.4,
}

export const paintbrushControls: readonly ToolParameterSpec[] = [
  { key: 'size', labelKey: 'brSize', kind: 'range', min: 3, max: 180, step: 1, format: 'pixels' },
  { key: 'pressure', labelKey: 'brPressure', kind: 'range', min: 0.05, max: 1, step: 0.01, format: 'percent' },
  { key: 'paintLoad', labelKey: 'brLoad', kind: 'range', min: 0.05, max: 1, step: 0.01, format: 'percent' },
  { key: 'wetSheen', labelKey: 'brWet', kind: 'range', min: 0, max: 1, step: 0.01, format: 'percent' },
  { key: 'blend', labelKey: 'brBlend', kind: 'range', min: 0, max: 1, step: 0.01, format: 'percent' },
  { key: 'randomness', labelKey: 'brRandom', kind: 'range', min: 0, max: 1, step: 0.01, format: 'percent' },
  { key: 'color', labelKey: 'brColor', kind: 'color' },
]

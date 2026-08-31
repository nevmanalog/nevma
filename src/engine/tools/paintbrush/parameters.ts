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
  { key: 'size', labelKey: 'brSize', helpKey: 'hBrushSize', kind: 'range', min: 3, max: 180, step: 1, format: 'pixels' },
  { key: 'pressure', labelKey: 'brPressure', helpKey: 'hBrushPressure', kind: 'range', min: 0.05, max: 1, step: 0.01, format: 'percent' },
  { key: 'paintLoad', labelKey: 'brLoad', helpKey: 'hBrushLoad', kind: 'range', min: 0.05, max: 1, step: 0.01, format: 'percent' },
  { key: 'wetSheen', labelKey: 'brWet', helpKey: 'hBrushWet', kind: 'range', min: 0, max: 1, step: 0.01, format: 'percent' },
  { key: 'blend', labelKey: 'brBlend', helpKey: 'hBrushBlend', kind: 'range', min: 0, max: 1, step: 0.01, format: 'percent' },
  { key: 'randomness', labelKey: 'brRandom', helpKey: 'hBrushRandom', kind: 'range', min: 0, max: 1, step: 0.01, format: 'percent' },
  { key: 'color', labelKey: 'brColor', helpKey: 'hBrushColor', kind: 'color' },
]

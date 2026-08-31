import type { ToolParameterValues } from '@/domain/types'
import type { ToolParameterSpec } from '../core/contracts'

export const pencilDefaults: ToolParameterValues = {
  size: 5,
  pressure: 0.55,
  grit: 0.55,
  color: '#2b2927',
  toothScale: 1.7,
  graphiteSheen: 0.18,
  speedSensitivity: 0.28,
  hardness: 0.4,
}

export const pencilControls: readonly ToolParameterSpec[] = [
  { key: 'size', labelKey: 'brSize', helpKey: 'hPencilSize', kind: 'range', min: 1, max: 40, step: 1, format: 'pixels' },
  { key: 'pressure', labelKey: 'brPressure', helpKey: 'hPencilPressure', kind: 'range', min: 0.05, max: 1, step: 0.01, format: 'percent' },
  { key: 'grit', labelKey: 'brGrit', helpKey: 'hPencilGrit', kind: 'range', min: 0, max: 1, step: 0.01, format: 'percent' },
  { key: 'hardness', labelKey: 'brHardness', helpKey: 'hPencilHardness', kind: 'range', min: 0, max: 1, step: 0.01, format: 'percent' },
  { key: 'color', labelKey: 'brColor', helpKey: 'hPencilColor', kind: 'color' },
]

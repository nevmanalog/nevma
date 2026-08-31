import type { ToolParameterValues } from '@/domain/types'
import type { ToolParameterSpec } from '../core/contracts'

export const tapeDefaults: ToolParameterValues = {
  size: 34,
  color: '#eadfbd',
  angle: 0,
  filmThickness: 0.16,
  adhesiveDarkening: 0.05,
  gloss: 0.4,
  bubbleRate: 0.34,
  wrinkleRate: 0.22,
}

export const tapeControls: readonly ToolParameterSpec[] = [
  { key: 'size', labelKey: 'brSize', helpKey: 'hTapeSize', kind: 'range', min: 4, max: 160, step: 1, format: 'pixels' },
  { key: 'angle', labelKey: 'brAngle', helpKey: 'hTapeAngle', kind: 'range', min: 0, max: 180, step: 1, format: 'degrees' },
  { key: 'gloss', labelKey: 'brGloss', helpKey: 'hTapeGloss', kind: 'range', min: 0, max: 1, step: 0.01, format: 'percent' },
  { key: 'bubbleRate', labelKey: 'brBubbles', helpKey: 'hTapeBubbles', kind: 'range', min: 0, max: 1, step: 0.01, format: 'percent' },
  { key: 'wrinkleRate', labelKey: 'brWrinkle', helpKey: 'hTapeWrinkle', kind: 'range', min: 0, max: 1, step: 0.01, format: 'percent' },
  { key: 'color', labelKey: 'brColor', helpKey: 'hTapeColor', kind: 'color' },
]

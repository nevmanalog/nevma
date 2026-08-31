import type { ToolParameterValues } from '@/domain/types'
import type { ToolParameterSpec } from '../core/contracts'

export const markerDefaults: ToolParameterValues = {
  size: 18,
  pressure: 0.65,
  color: '#222222',
  edgeFeather: 0.26,
  pigmentLoad: 0.8,
  bleed: 0.22,
  speedSensitivity: 0.45,
}

export const markerControls: readonly ToolParameterSpec[] = [
  { key: 'size', labelKey: 'brSize', helpKey: 'hMarkerSize', kind: 'range', min: 2, max: 120, step: 1, format: 'pixels' },
  { key: 'pressure', labelKey: 'brPressure', helpKey: 'hMarkerPressure', kind: 'range', min: 0.05, max: 1, step: 0.01, format: 'percent' },
  { key: 'pigmentLoad', labelKey: 'brInk', helpKey: 'hMarkerInk', kind: 'range', min: 0.05, max: 1, step: 0.01, format: 'percent' },
  { key: 'bleed', labelKey: 'brBleed', helpKey: 'hMarkerBleed', kind: 'range', min: 0, max: 1, step: 0.01, format: 'percent' },
  { key: 'color', labelKey: 'brColor', helpKey: 'hMarkerColor', kind: 'color' },
]

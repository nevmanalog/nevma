import type { ToolParameterValues } from '@/domain/types'
import type { ToolParameterSpec } from '../core/contracts'

export const scratchesDefaults: ToolParameterValues = {
  size: 24,
  pressure: 0.5,
  randomness: 0.4,
  laneCount: 4,
  ridgeHeight: 0.5,
  inkLoss: 0.12,
}

export const scratchesControls: readonly ToolParameterSpec[] = [
  { key: 'size', labelKey: 'brSize', helpKey: 'hScratchSize', kind: 'range', min: 2, max: 120, step: 1, format: 'pixels' },
  { key: 'pressure', labelKey: 'brPressure', helpKey: 'hScratchPressure', kind: 'range', min: 0.05, max: 1, step: 0.01, format: 'percent' },
  { key: 'randomness', labelKey: 'brRandom', helpKey: 'hScratchRandom', kind: 'range', min: 0, max: 1, step: 0.01, format: 'percent' },
]

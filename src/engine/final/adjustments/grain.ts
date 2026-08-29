import { clamp255, type FinalAdjustment } from '../contracts'
import { hash2 } from '@/engine/sheet/state'

/**
 * Film grain — deterministic monochrome luminance noise. Keyed off absolute
 * (x, y) and the layer seed, so it is stable across redraws and identical for a
 * region or a full pass.
 */
export const grainAdjustment: FinalAdjustment = {
  id: 'grain',
  icon: '⁙',
  labelKey: 'finGrain',
  helpKey: 'hFinGrain',
  controls: [
    { key: 'amount', labelKey: 'finGrainAmount', helpKey: 'hFinGrain', min: 0, max: 1, step: 0.01, default: 0, format: 'percent' },
    { key: 'size', labelKey: 'finGrainSize', helpKey: 'hFinGrainSize', min: 1, max: 4, step: 0.5, default: 1, format: 'number' },
  ],
  isIdentity: (v) => v.amount <= 0,
  apply: ({ data, width, x0, y0, x1, y1, values, seed }) => {
    const strength = values.amount * 64
    const size = Math.max(1, values.size)
    for (let y = y0; y <= y1; y++) {
      const gy = Math.floor(y / size)
      for (let x = x0; x <= x1; x++) {
        const p = (y * width + x) * 4
        if (data[p + 3] === 0) continue
        const gx = Math.floor(x / size)
        const n = (hash2(gx, gy, seed | 0) - 0.5) * 2 * strength
        data[p] = clamp255(data[p] + n)
        data[p + 1] = clamp255(data[p + 1] + n)
        data[p + 2] = clamp255(data[p + 2] + n)
      }
    }
  },
}

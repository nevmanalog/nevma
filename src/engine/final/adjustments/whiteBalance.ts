import { clamp255, type FinalAdjustment } from '../contracts'

/**
 * White balance — two independent axes:
 *   temp: cool (blue) <-> warm (amber)   — shifts red up / blue down
 *   tint: green       <-> magenta        — shifts green against red/blue
 */
export const whiteBalanceAdjustment: FinalAdjustment = {
  id: 'whiteBalance',
  icon: '🌡',
  labelKey: 'finWhiteBalance',
  helpKey: 'hFinWhiteBalance',
  controls: [
    { key: 'temp', labelKey: 'finTemp', helpKey: 'hFinTemp', min: -1, max: 1, step: 0.01, default: 0, format: 'signedPercent' },
    { key: 'tint', labelKey: 'finTintWB', helpKey: 'hFinTintWB', min: -1, max: 1, step: 0.01, default: 0, format: 'signedPercent' },
  ],
  isIdentity: (v) => v.temp === 0 && v.tint === 0,
  apply: ({ data, width, x0, y0, x1, y1, values }) => {
    const t = values.temp * 42
    const g = values.tint * 36
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const p = (y * width + x) * 4
        if (data[p + 3] === 0) continue
        data[p] = clamp255(data[p] + t + g * 0.5)
        data[p + 1] = clamp255(data[p + 1] - g)
        data[p + 2] = clamp255(data[p + 2] - t + g * 0.5)
      }
    }
  },
}

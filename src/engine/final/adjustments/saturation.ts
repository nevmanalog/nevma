import { clamp255, luma, type FinalAdjustment } from '../contracts'

/** Saturation — scales colour distance from its luminance grey. */
export const saturationAdjustment: FinalAdjustment = {
  id: 'saturation',
  icon: '🎨',
  labelKey: 'finSaturation',
  helpKey: 'hFinSaturation',
  controls: [
    { key: 'amount', labelKey: 'finSaturation', helpKey: 'hFinSaturation', min: -1, max: 1, step: 0.01, default: 0, format: 'signedPercent' },
  ],
  isIdentity: (v) => v.amount === 0,
  apply: ({ data, width, x0, y0, x1, y1, values }) => {
    const s = 1 + values.amount
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const p = (y * width + x) * 4
        if (data[p + 3] === 0) continue
        const gray = luma(data[p], data[p + 1], data[p + 2])
        data[p] = clamp255(gray + (data[p] - gray) * s)
        data[p + 1] = clamp255(gray + (data[p + 1] - gray) * s)
        data[p + 2] = clamp255(gray + (data[p + 2] - gray) * s)
      }
    }
  },
}

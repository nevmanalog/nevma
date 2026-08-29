import { clamp255, type FinalAdjustment } from '../contracts'

/** Contrast — pushes values away from (or toward) mid grey around a pivot. */
export const contrastAdjustment: FinalAdjustment = {
  id: 'contrast',
  icon: '◐',
  labelKey: 'finContrast',
  helpKey: 'hFinContrast',
  controls: [
    { key: 'amount', labelKey: 'finContrast', helpKey: 'hFinContrast', min: -1, max: 1, step: 0.01, default: 0, format: 'signedPercent' },
  ],
  isIdentity: (v) => v.amount === 0,
  apply: ({ data, width, x0, y0, x1, y1, values }) => {
    // amount -1 -> flat grey (factor 0), 0 -> unchanged, +1 -> strong (factor 3).
    const a = values.amount
    const factor = a >= 0 ? 1 + a * 2 : 1 + a
    const pivot = 127.5
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const p = (y * width + x) * 4
        if (data[p + 3] === 0) continue
        data[p] = clamp255((data[p] - pivot) * factor + pivot)
        data[p + 1] = clamp255((data[p + 1] - pivot) * factor + pivot)
        data[p + 2] = clamp255((data[p + 2] - pivot) * factor + pivot)
      }
    }
  },
}

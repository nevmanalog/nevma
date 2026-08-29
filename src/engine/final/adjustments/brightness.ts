import { clamp255, type FinalAdjustment } from '../contracts'

/** Linear brightness — an additive offset applied to every channel. */
export const brightnessAdjustment: FinalAdjustment = {
  id: 'brightness',
  icon: '◒',
  labelKey: 'finBrightness',
  helpKey: 'hFinBrightness',
  controls: [
    { key: 'amount', labelKey: 'finBrightness', helpKey: 'hFinBrightness', min: -1, max: 1, step: 0.01, default: 0, format: 'signedPercent' },
  ],
  isIdentity: (v) => v.amount === 0,
  apply: ({ data, width, x0, y0, x1, y1, values }) => {
    const add = values.amount * 255
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const p = (y * width + x) * 4
        if (data[p + 3] === 0) continue
        data[p] = clamp255(data[p] + add)
        data[p + 1] = clamp255(data[p + 1] + add)
        data[p + 2] = clamp255(data[p + 2] + add)
      }
    }
  },
}

import { clamp255, type FinalAdjustment } from '../contracts'

/** Photographic exposure in stops — a multiplicative light change. */
export const exposureAdjustment: FinalAdjustment = {
  id: 'exposure',
  icon: '☀',
  labelKey: 'finExposure',
  helpKey: 'hFinExposure',
  controls: [
    { key: 'ev', labelKey: 'finExposureEv', helpKey: 'hFinExposure', min: -2, max: 2, step: 0.01, default: 0, format: 'stops' },
  ],
  isIdentity: (v) => v.ev === 0,
  apply: ({ data, width, x0, y0, x1, y1, values }) => {
    const factor = Math.pow(2, values.ev)
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const p = (y * width + x) * 4
        if (data[p + 3] === 0) continue
        data[p] = clamp255(data[p] * factor)
        data[p + 1] = clamp255(data[p + 1] * factor)
        data[p + 2] = clamp255(data[p + 2] * factor)
      }
    }
  },
}

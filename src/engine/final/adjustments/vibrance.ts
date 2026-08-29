import { clamp255, luma, type FinalAdjustment } from '../contracts'

/**
 * Vibrance — a saturation boost weighted toward already-muted colours, so
 * strong colours are protected from clipping (unlike flat saturation).
 */
export const vibranceAdjustment: FinalAdjustment = {
  id: 'vibrance',
  icon: '✧',
  labelKey: 'finVibrance',
  helpKey: 'hFinVibrance',
  controls: [
    { key: 'amount', labelKey: 'finVibrance', helpKey: 'hFinVibrance', min: -1, max: 1, step: 0.01, default: 0, format: 'signedPercent' },
  ],
  isIdentity: (v) => v.amount === 0,
  apply: ({ data, width, x0, y0, x1, y1, values }) => {
    const amt = values.amount
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const p = (y * width + x) * 4
        if (data[p + 3] === 0) continue
        const r = data[p], g = data[p + 1], b = data[p + 2]
        const mx = Math.max(r, g, b)
        const mn = Math.min(r, g, b)
        const sat = mx <= 0 ? 0 : (mx - mn) / mx
        const factor = 1 + amt * (1 - sat)
        const gray = luma(r, g, b)
        data[p] = clamp255(gray + (r - gray) * factor)
        data[p + 1] = clamp255(gray + (g - gray) * factor)
        data[p + 2] = clamp255(gray + (b - gray) * factor)
      }
    }
  },
}

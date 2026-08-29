import { clamp255, smoothstep, type FinalAdjustment } from '../contracts'

/**
 * Vignette — darkens (or lightens) toward the frame corners. Purely a function
 * of absolute pixel position and the full canvas size, so a region redraw is
 * identical to a full pass.
 */
export const vignetteAdjustment: FinalAdjustment = {
  id: 'vignette',
  icon: '⬤',
  labelKey: 'finVignette',
  helpKey: 'hFinVignette',
  controls: [
    { key: 'amount', labelKey: 'finVigAmount', helpKey: 'hFinVignette', min: -1, max: 1, step: 0.01, default: 0, format: 'signedPercent' },
    { key: 'midpoint', labelKey: 'finVigMidpoint', helpKey: 'hFinVigMidpoint', min: 0, max: 1, step: 0.01, default: 0.55, format: 'percent' },
    { key: 'feather', labelKey: 'finVigFeather', helpKey: 'hFinVigFeather', min: 0.01, max: 1, step: 0.01, default: 0.45, format: 'percent' },
  ],
  isIdentity: (v) => v.amount === 0,
  apply: ({ data, width, height, x0, y0, x1, y1, values }) => {
    const amount = values.amount
    const mid = values.midpoint
    const feather = Math.max(0.01, values.feather)
    const cx = (width - 1) / 2
    const cy = (height - 1) / 2
    const norm = 1 / Math.max(1e-4, Math.hypot(cx, cy))
    for (let y = y0; y <= y1; y++) {
      const dy = y - cy
      for (let x = x0; x <= x1; x++) {
        const p = (y * width + x) * 4
        if (data[p + 3] === 0) continue
        const dx = x - cx
        const d = Math.hypot(dx, dy) * norm // 0 centre .. 1 corner
        const falloff = smoothstep(mid, mid + feather, d)
        const factor = 1 - amount * falloff
        data[p] = clamp255(data[p] * factor)
        data[p + 1] = clamp255(data[p + 1] * factor)
        data[p + 2] = clamp255(data[p + 2] * factor)
      }
    }
  },
}

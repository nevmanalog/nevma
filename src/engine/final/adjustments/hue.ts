import { clamp255, type FinalAdjustment } from '../contracts'

/** Hue rotation — spins colours around the luma-preserving hue wheel. */
export const hueAdjustment: FinalAdjustment = {
  id: 'hue',
  icon: '◉',
  labelKey: 'finHue',
  helpKey: 'hFinHue',
  controls: [
    { key: 'angle', labelKey: 'finHue', helpKey: 'hFinHue', min: -180, max: 180, step: 1, default: 0, format: 'degrees' },
  ],
  isIdentity: (v) => v.angle === 0,
  apply: ({ data, width, x0, y0, x1, y1, values }) => {
    const a = (values.angle * Math.PI) / 180
    const c = Math.cos(a)
    const s = Math.sin(a)
    // Luma-preserving hue rotation matrix (weights 0.299/0.587/0.114).
    const m0 = 0.299 + 0.701 * c + 0.168 * s
    const m1 = 0.587 - 0.587 * c + 0.330 * s
    const m2 = 0.114 - 0.114 * c - 0.497 * s
    const m3 = 0.299 - 0.299 * c - 0.328 * s
    const m4 = 0.587 + 0.413 * c + 0.035 * s
    const m5 = 0.114 - 0.114 * c + 0.292 * s
    const m6 = 0.299 - 0.300 * c + 1.250 * s
    const m7 = 0.587 - 0.588 * c - 1.050 * s
    const m8 = 0.114 + 0.886 * c - 0.203 * s
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const p = (y * width + x) * 4
        if (data[p + 3] === 0) continue
        const r = data[p], g = data[p + 1], b = data[p + 2]
        data[p] = clamp255(r * m0 + g * m1 + b * m2)
        data[p + 1] = clamp255(r * m3 + g * m4 + b * m5)
        data[p + 2] = clamp255(r * m6 + g * m7 + b * m8)
      }
    }
  },
}

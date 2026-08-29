import { clamp01, clamp255, type FinalAdjustment } from '../contracts'

// Five tonal zones (black, shadows, midtones, highlights, white). Each slider
// lifts/lowers its zone with a smooth Gaussian weight, and the sum builds a
// continuous tone curve — a practical curve editor without a node canvas.
const ZONES = [0, 0.25, 0.5, 0.75, 1] as const
const KEYS = ['blacks', 'shadows', 'midtones', 'highlights', 'whites'] as const
const SIGMA = 0.19
const gauss = (x: number, c: number) => Math.exp(-((x - c) * (x - c)) / (2 * SIGMA * SIGMA))

export const curvesAdjustment: FinalAdjustment = {
  id: 'curves',
  icon: '〰',
  labelKey: 'finCurves',
  helpKey: 'hFinCurves',
  controls: [
    { key: 'blacks', labelKey: 'finBlacks', helpKey: 'hFinCurves', min: -1, max: 1, step: 0.01, default: 0, format: 'signedPercent' },
    { key: 'shadows', labelKey: 'finShadows', helpKey: 'hFinCurves', min: -1, max: 1, step: 0.01, default: 0, format: 'signedPercent' },
    { key: 'midtones', labelKey: 'finMidtones', helpKey: 'hFinCurves', min: -1, max: 1, step: 0.01, default: 0, format: 'signedPercent' },
    { key: 'highlights', labelKey: 'finHighlights', helpKey: 'hFinCurves', min: -1, max: 1, step: 0.01, default: 0, format: 'signedPercent' },
    { key: 'whites', labelKey: 'finWhites', helpKey: 'hFinCurves', min: -1, max: 1, step: 0.01, default: 0, format: 'signedPercent' },
  ],
  isIdentity: (v) => KEYS.every((k) => v[k] === 0),
  apply: ({ data, width, x0, y0, x1, y1, values }) => {
    const lut = new Uint8ClampedArray(256)
    for (let i = 0; i < 256; i++) {
      const x = i / 255
      let lift = 0
      for (let z = 0; z < ZONES.length; z++) lift += values[KEYS[z]] * gauss(x, ZONES[z])
      lut[i] = clamp255(clamp01(x + lift * 0.5) * 255)
    }
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const p = (y * width + x) * 4
        if (data[p + 3] === 0) continue
        data[p] = lut[data[p]]
        data[p + 1] = lut[data[p + 1]]
        data[p + 2] = lut[data[p + 2]]
      }
    }
  },
}

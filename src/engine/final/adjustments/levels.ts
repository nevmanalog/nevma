import { clamp01, clamp255, type FinalAdjustment } from '../contracts'

/**
 * Levels — remap the tonal range: clip input black/white points, apply a gamma
 * (midtone) curve, then rescale into an output black/white range. Built once
 * into a 256-entry LUT and shared by all three channels.
 */
export const levelsAdjustment: FinalAdjustment = {
  id: 'levels',
  icon: '▤',
  labelKey: 'finLevels',
  helpKey: 'hFinLevels',
  controls: [
    { key: 'inBlack', labelKey: 'finInBlack', helpKey: 'hFinLevels', min: 0, max: 254, step: 1, default: 0, format: 'level' },
    { key: 'inWhite', labelKey: 'finInWhite', helpKey: 'hFinLevels', min: 1, max: 255, step: 1, default: 255, format: 'level' },
    { key: 'gamma', labelKey: 'finGamma', helpKey: 'hFinGamma', min: 0.1, max: 3, step: 0.01, default: 1, format: 'number' },
    { key: 'outBlack', labelKey: 'finOutBlack', helpKey: 'hFinLevels', min: 0, max: 255, step: 1, default: 0, format: 'level' },
    { key: 'outWhite', labelKey: 'finOutWhite', helpKey: 'hFinLevels', min: 0, max: 255, step: 1, default: 255, format: 'level' },
  ],
  isIdentity: (v) =>
    v.inBlack === 0 && v.inWhite === 255 && v.gamma === 1 && v.outBlack === 0 && v.outWhite === 255,
  apply: ({ data, width, x0, y0, x1, y1, values }) => {
    const inBlack = values.inBlack
    const inWhite = Math.max(inBlack + 1, values.inWhite)
    const invGamma = 1 / Math.max(0.01, values.gamma)
    const outBlack = values.outBlack
    const outRange = values.outWhite - values.outBlack
    const span = inWhite - inBlack
    const lut = new Uint8ClampedArray(256)
    for (let i = 0; i < 256; i++) {
      const t = clamp01((i - inBlack) / span)
      lut[i] = clamp255(outBlack + Math.pow(t, invGamma) * outRange)
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

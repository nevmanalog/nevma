// Parameter schemas — the central artifact. UI, presets and randomize all
// derive from these. Labels are i18n keys resolved at render time.

import type { TKey } from '@/i18n/dict'

export interface ParamSpec {
  key: string
  labelKey: TKey
  helpKey: TKey
  min: number
  max: number
  step: number
  default: number
}

export type ParamSchema = readonly ParamSpec[]

// ---- Enums -----------------------------------------------------------------

export type PaperType = 'newsprint' | 'oldAd' | 'cardboard' | 'glossy' | 'cheap'
export type PrinterType = 'offset' | 'laser' | 'xerox' | 'inkjet' | 'newspaper' | 'risograph'

export const PAPER_TYPES: { id: PaperType; labelKey: TKey }[] = [
  { id: 'newsprint', labelKey: 'paperNewsprint' },
  { id: 'oldAd', labelKey: 'paperOldAd' },
  { id: 'cardboard', labelKey: 'paperCardboard' },
  { id: 'glossy', labelKey: 'paperGlossy' },
  { id: 'cheap', labelKey: 'paperCheap' },
]

export const PRINTER_TYPES: { id: PrinterType; labelKey: TKey }[] = [
  { id: 'offset', labelKey: 'printOffset' },
  { id: 'laser', labelKey: 'printLaser' },
  { id: 'xerox', labelKey: 'printXerox' },
  { id: 'inkjet', labelKey: 'printInkjet' },
  { id: 'newspaper', labelKey: 'printNewspaper' },
  { id: 'risograph', labelKey: 'printRiso' },
]

import type { ColorMode, PrepressMode, ScannerMode } from './types'

export const SCANNER_MODES: { id: ScannerMode; labelKey: TKey }[] = [
  { id: 'none', labelKey: 'scanNone' },
  { id: 'home', labelKey: 'scanHome' },
  { id: 'pro', labelKey: 'scanPro' },
  { id: 'phone', labelKey: 'scanPhone' },
]
export const SCANNER_MODE_CODE: Record<ScannerMode, number> = {
  none: 0, home: 1, pro: 2, phone: 3,
}

export const PREPRESS_MODES: { id: PrepressMode; labelKey: TKey }[] = [
  { id: 'fullColor', labelKey: 'prepFullColor' },
  { id: 'cmykOffset', labelKey: 'prepCmykOffset' },
  { id: 'grayscale', labelKey: 'prepGrayscale' },
  { id: 'blackInk', labelKey: 'prepBlackInk' },
  { id: 'newspaper', labelKey: 'prepNewspaper' },
  { id: 'risograph', labelKey: 'prepRisograph' },
]
export const PREPRESS_MODE_CODE: Record<PrepressMode, number> = {
  fullColor: 0, cmykOffset: 1, grayscale: 2, blackInk: 3, newspaper: 4, risograph: 5,
}

export const COLOR_MODES: { id: ColorMode; labelKey: TKey }[] = [
  { id: 'color', labelKey: 'colColor' },
  { id: 'bw', labelKey: 'colBW' },
  { id: 'tint', labelKey: 'colTint' },
]
export const COLOR_MODE_CODE: Record<ColorMode, number> = { color: 0, bw: 1, tint: 2 }

export const PAPER_TYPE_CODE: Record<PaperType, number> = {
  newsprint: 0, oldAd: 1, cardboard: 2, glossy: 3, cheap: 4,
}
export const PRINTER_TYPE_CODE: Record<PrinterType, number> = {
  offset: 0, laser: 1, xerox: 2, inkjet: 3, newspaper: 4, risograph: 5,
}

// ---- Paper Engine ----------------------------------------------------------

export const PAPER_SCHEMA = [
  { key: 'yellowing', labelKey: 'pYellowing', helpKey: 'hpYellowing', min: 0, max: 1, step: 0.01, default: 0.15 },
  { key: 'fibers', labelKey: 'pFibers', helpKey: 'hpFibers', min: 0, max: 1, step: 0.01, default: 0.35 },
  { key: 'roughness', labelKey: 'pRoughness', helpKey: 'hpRoughness', min: 0, max: 1, step: 0.01, default: 0.25 },
  { key: 'thickness', labelKey: 'pThickness', helpKey: 'hpThickness', min: 0, max: 1, step: 0.01, default: 0.3 },
  { key: 'stains', labelKey: 'pStains', helpKey: 'hpStains', min: 0, max: 1, step: 0.01, default: 0.08 },
  { key: 'moisture', labelKey: 'pMoisture', helpKey: 'hpMoisture', min: 0, max: 1, step: 0.01, default: 0.06 },
  { key: 'creases', labelKey: 'pCreases', helpKey: 'hpCreases', min: 0, max: 1, step: 0.01, default: 0 },
  { key: 'scratches', labelKey: 'pScratches', helpKey: 'hpPScratches', min: 0, max: 1, step: 0.01, default: 0.05 },
] as const satisfies ParamSchema

// ---- Printer Engine --------------------------------------------------------

export const PRINTER_SCHEMA = [
  { key: 'inkDensity', labelKey: 'prInkDensity', helpKey: 'hprInkDensity', min: 0, max: 1, step: 0.01, default: 0.55 },
  { key: 'dpi', labelKey: 'prDpi', helpKey: 'hprDpi', min: 72, max: 600, step: 1, default: 300 },
  { key: 'dotGain', labelKey: 'prDotGain', helpKey: 'hprDotGain', min: 0, max: 1, step: 0.01, default: 0.25 },
  { key: 'halftone', labelKey: 'prHalftone', helpKey: 'hprHalftone', min: 0, max: 1, step: 0.01, default: 0.35 },
  { key: 'colorShift', labelKey: 'prColorShift', helpKey: 'hprColorShift', min: -1, max: 1, step: 0.01, default: 0 },
  { key: 'fade', labelKey: 'prFade', helpKey: 'hprFade', min: 0, max: 1, step: 0.01, default: 0.06 },
  { key: 'registration', labelKey: 'prRegistration', helpKey: 'hprRegistration', min: 0, max: 8, step: 0.1, default: 0.4 },
] as const satisfies ParamSchema

// Curated per-stage subsets shown in the guided wizard. The full schema is
// still available for fine-tuning in the editor.
export const PRINTER_WIZARD_KEYS = ['inkDensity', 'dpi', 'dotGain', 'halftone', 'colorShift', 'fade'] as const
export const PAPER_WIZARD_KEYS = ['yellowing', 'fibers', 'thickness', 'stains'] as const
export const SCANNER_WIZARD_KEYS = ['noise', 'jpeg', 'dust', 'blur', 'streaks', 'exposure'] as const

// ---- Damage Engine ---------------------------------------------------------

export const DAMAGE_SCHEMA = [
  { key: 'scratches', labelKey: 'dScratches', helpKey: 'hdScratches', min: 0, max: 1, step: 0.01, default: 0.1 },
  { key: 'abrasions', labelKey: 'dAbrasions', helpKey: 'hdAbrasions', min: 0, max: 1, step: 0.01, default: 0.08 },
  { key: 'worn', labelKey: 'dWorn', helpKey: 'hdWorn', min: 0, max: 1, step: 0.01, default: 0.08 },
  { key: 'paperDamage', labelKey: 'dPaperDamage', helpKey: 'hdPaperDamage', min: 0, max: 1, step: 0.01, default: 0.06 },
] as const satisfies ParamSchema

// ---- Scanner Engine --------------------------------------------------------

export const SCANNER_SCHEMA = [
  { key: 'noise', labelKey: 'scNoise', helpKey: 'hscNoise', min: 0, max: 1, step: 0.01, default: 0.1 },
  { key: 'jpeg', labelKey: 'scJpeg', helpKey: 'hscJpeg', min: 0, max: 1, step: 0.01, default: 0.06 },
  { key: 'dust', labelKey: 'scDust', helpKey: 'hscDust', min: 0, max: 1, step: 0.01, default: 0.08 },
  { key: 'blur', labelKey: 'scBlur', helpKey: 'hscBlur', min: 0, max: 1, step: 0.01, default: 0.05 },
  { key: 'streaks', labelKey: 'scStreaks', helpKey: 'hscStreaks', min: 0, max: 1, step: 0.01, default: 0.08 },
  { key: 'exposure', labelKey: 'scExposure', helpKey: 'hscExposure', min: 0, max: 1, step: 0.01, default: 0.5 },
  { key: 'distortion', labelKey: 'scDistortion', helpKey: 'hscDistortion', min: 0, max: 1, step: 0.01, default: 0.06 },
  { key: 'colorProblems', labelKey: 'scColor', helpKey: 'hscColor', min: 0, max: 1, step: 0.01, default: 0.08 },
] as const satisfies ParamSchema

// ---- Derived types ---------------------------------------------------------

type ParamsFromSchema<S extends ParamSchema> = { [K in S[number]['key']]: number }

export type PaperParams = ParamsFromSchema<typeof PAPER_SCHEMA>
export type PrinterParams = ParamsFromSchema<typeof PRINTER_SCHEMA>
export type DamageParams = ParamsFromSchema<typeof DAMAGE_SCHEMA>
export type ScannerParams = ParamsFromSchema<typeof SCANNER_SCHEMA>

// ---- Helpers ---------------------------------------------------------------

export function defaultsFrom<S extends ParamSchema>(schema: S): ParamsFromSchema<S> {
  const out = {} as Record<string, number>
  for (const spec of schema) out[spec.key] = spec.default
  return out as ParamsFromSchema<S>
}

export function randomizeFrom<S extends ParamSchema>(schema: S, rand: () => number): ParamsFromSchema<S> {
  const out = {} as Record<string, number>
  for (const spec of schema) {
    const v = spec.min + rand() * (spec.max - spec.min)
    out[spec.key] = Math.round(v / spec.step) * spec.step
  }
  return out as ParamsFromSchema<S>
}

/**
 * Produce a fresh VARIATION of an existing parameter set: each value is jittered
 * around its current base by up to `amount` of the parameter's full range, then
 * clamped and stepped. Unlike `randomizeFrom` (which draws each value uniformly
 * across the whole range) this stays close to the source, so a template keeps
 * its character while every regeneration looks a little different.
 */
export function varyFrom<S extends ParamSchema>(
  schema: S, base: ParamsFromSchema<S>, rand: () => number, amount = 0.18,
): ParamsFromSchema<S> {
  const src = base as Record<string, number>
  const out = {} as Record<string, number>
  for (const spec of schema) {
    const current = src[spec.key] ?? spec.default
    const jitter = (rand() * 2 - 1) * amount * (spec.max - spec.min)
    const v = Math.min(spec.max, Math.max(spec.min, current + jitter))
    out[spec.key] = Math.round(v / spec.step) * spec.step
  }
  return out as ParamsFromSchema<S>
}

export const defaultPaper = (): PaperParams => defaultsFrom(PAPER_SCHEMA)
export const defaultPrinter = (): PrinterParams => defaultsFrom(PRINTER_SCHEMA)
export const defaultDamage = (): DamageParams => defaultsFrom(DAMAGE_SCHEMA)
export const defaultScanner = (): ScannerParams => defaultsFrom(SCANNER_SCHEMA)

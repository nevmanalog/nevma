// Templates = physical configurations of real historical materials.
// Each is a full description (paper + print + aging + scanner) plus the
// physical parameter values it maps to. Not random filter stacks.
import type {
  PaperParams, PrinterParams, DamageParams, ScannerParams, PaperType, PrinterType,
} from './params'
import { defaultPaper, defaultPrinter, defaultDamage, defaultScanner } from './params'
import type { ColorMode, PrepressMode } from './types'
import type { TKey } from '@/i18n/dict'
import type { Lang } from '@/i18n/dict'

export interface TemplateDescription {
  paper: Record<Lang, string>
  print: Record<Lang, string>
  aging: Record<Lang, string>
  scanner: Record<Lang, string>
}

export interface Preset {
  id: string
  nameKey: TKey
  intensity: number
  prepress: PrepressMode
  colorMode: ColorMode
  paperType: PaperType
  printerType: PrinterType
  seed: number
  paper: PaperParams
  printer: PrinterParams
  damage: DamageParams
  scanner: ScannerParams
  desc: TemplateDescription
}

const make = (
  id: string, nameKey: TKey, intensity: number,
  prepress: PrepressMode, colorMode: ColorMode,
  paperType: PaperType, printerType: PrinterType, seed: number,
  paper: Partial<PaperParams>, printer: Partial<PrinterParams>,
  damage: Partial<DamageParams>, scanner: Partial<ScannerParams>,
  desc: TemplateDescription,
): Preset => ({
  id, nameKey, intensity, prepress, colorMode, paperType, printerType, seed,
  paper: { ...defaultPaper(), ...paper },
  printer: { ...defaultPrinter(), ...printer },
  damage: { ...defaultDamage(), ...damage },
  scanner: { ...defaultScanner(), ...scanner },
  desc,
})

// Six strongly-opinionated looks (60s–90s print culture). Each one drives the
// whole pipeline hard — prepress + printer + paper + damage + scanner — so the
// image is fully transformed, not lightly filtered.
export const PRESETS: Preset[] = [
  // High-contrast photocopy zine: crushed blacks, blown highlights, toner grime.
  make('xerox-zine', 'presetXeroxZine', 1.0, 'blackInk', 'bw', 'cheap', 'xerox', 1988,
    { yellowing: 0.1, fibers: 0.3, roughness: 0.72, thickness: 0.28, stains: 0.22, moisture: 0.08, creases: 0, scratches: 0.32 },
    { inkDensity: 0.9, dpi: 110, dotGain: 0.55, halftone: 0.7, colorShift: 0, registration: 0.5, fade: 0.4 },
    { scratches: 0.38, abrasions: 0.32, worn: 0.28, paperDamage: 0 },
    { noise: 0.4, dust: 0, streaks: 0.5, blur: 0.12, distortion: 0.1, colorProblems: 0.08, jpeg: 0.15 },
    {
      paper: { en: 'Cheap copy paper, cool white, rough surface.', ru: 'Дешёвая копировальная бумага, холодная белизна, шершавая поверхность.' },
      print: { en: 'Photocopier toner, harsh 1-bit contrast, speckle & dropouts.', ru: 'Тонер копира, жёсткий контраст «в лоб», крапинки и выпадения.' },
      aging: { en: 'Heavy scratches and scuffs from repeated copying.', ru: 'Сильные царапины и потёртости от многократного копирования.' },
      scanner: { en: 'Old scanner: noise, streaks, banding.', ru: 'Старый сканер: шум, штрихи, полосы.' },
    }),

  // Newspaper: coarse CMYK halftone screen soaked into yellowed newsprint.
  make('news-halftone', 'presetNewsHalftone', 0.95, 'newspaper', 'color', 'newsprint', 'newspaper', 1972,
    { yellowing: 0.66, fibers: 0.72, roughness: 0.58, thickness: 0.16, stains: 0.36, moisture: 0.28, creases: 0, scratches: 0.2 },
    { inkDensity: 0.6, dpi: 150, dotGain: 0.45, halftone: 0.95, colorShift: -0.12, registration: 2.4, fade: 0.42 },
    { scratches: 0.2, abrasions: 0.16, worn: 0.28, paperDamage: 0 },
    { noise: 0.2, dust: 0, streaks: 0.18, blur: 0.08, distortion: 0.08, colorProblems: 0.12, jpeg: 0.1 },
    {
      paper: { en: 'Thin yellowed newsprint, coarse fibers.', ru: 'Тонкая пожелтевшая газетная бумага, грубые волокна.' },
      print: { en: 'Newspaper press, coarse halftone dots, ink bled into fibers.', ru: 'Газетная печать, крупный растр, краска впиталась в волокна.' },
      aging: { en: 'Brittle, browned edges.', ru: 'Ломкая, побуревшие края.' },
      scanner: { en: 'Old scan, visible noise and banding.', ru: 'Старое сканирование, заметный шум и полосы.' },
    }),

  // Soviet offset poster: bold flat inks on cardstock, strong plate misregistration.
  make('soviet-offset', 'presetSovietOffset', 0.9, 'cmykOffset', 'color', 'cardboard', 'offset', 1965,
    { yellowing: 0.44, fibers: 0.48, roughness: 0.4, thickness: 0.62, stains: 0.3, moisture: 0.2, creases: 0, scratches: 0.24 },
    { inkDensity: 0.8, dpi: 170, dotGain: 0.3, halftone: 0.5, colorShift: -0.2, registration: 2.2, fade: 0.24 },
    { scratches: 0.3, abrasions: 0.26, worn: 0.32, paperDamage: 0 },
    { noise: 0.14, dust: 0, streaks: 0.12, blur: 0.05, distortion: 0.08, colorProblems: 0.2, jpeg: 0.06 },
    {
      paper: { en: 'Thick aged cardstock, warm ivory, visible fibers.', ru: 'Плотный состаренный картон, тёплый цвет слоновой кости, видимые волокна.' },
      print: { en: 'Offset litho, bold flat inks, heavy registration drift.', ru: 'Офсетная литография, плотные плашечные краски, сильный сдвиг приводки.' },
      aging: { en: 'Edge scuffs, light water staining.', ru: 'Потёртости по краям, лёгкие водяные разводы.' },
      scanner: { en: 'Archive flatbed scan, warm cast.', ru: 'Архивное планшетное сканирование, тёплый оттенок.' },
    }),

  // 90s risograph gig poster: limited punchy duotone inks, big misregistration.
  make('riso-punk', 'presetRisoPunk', 0.9, 'risograph', 'color', 'oldAd', 'risograph', 1993,
    { yellowing: 0.2, fibers: 0.54, roughness: 0.5, thickness: 0.48, stains: 0.16, moisture: 0.12, creases: 0, scratches: 0.24 },
    { inkDensity: 0.92, dpi: 130, dotGain: 0.4, halftone: 0.6, colorShift: 0.55, registration: 3.0, fade: 0.14 },
    { scratches: 0.26, abrasions: 0.22, worn: 0.2, paperDamage: 0 },
    { noise: 0.16, dust: 0, streaks: 0.12, blur: 0.06, distortion: 0.16, colorProblems: 0.28, jpeg: 0.08 },
    {
      paper: { en: 'Uncoated recycled stock, warm, textured.', ru: 'Немелованная переработанная бумага, тёплая, фактурная.' },
      print: { en: 'Risograph, 2–3 bright spot inks, strong misregistration.', ru: 'Ризограф, 2–3 яркие плашечные краски, сильное несовпадение.' },
      aging: { en: 'Taped corners, street-poster wear.', ru: 'Заклеенные углы, износ уличного постера.' },
      scanner: { en: 'Consumer scan, punchy colours, minor distortion.', ru: 'Бытовое сканирование, яркие цвета, лёгкие искажения.' },
    }),

  // Faded photo print: soft, washed-out, warm — like a sun-bleached snapshot.
  make('faded-photo', 'presetFadedPhoto', 0.85, 'grayscale', 'tint', 'glossy', 'offset', 1979,
    { yellowing: 0.5, fibers: 0.16, roughness: 0.18, thickness: 0.34, stains: 0.24, moisture: 0.26, creases: 0, scratches: 0.12 },
    { inkDensity: 0.35, dpi: 260, dotGain: 0.12, halftone: 0.14, colorShift: 0.2, registration: 0.8, fade: 0.72 },
    { scratches: 0.16, abrasions: 0.18, worn: 0.26, paperDamage: 0 },
    { noise: 0.14, dust: 0, streaks: 0.08, blur: 0.4, distortion: 0.06, colorProblems: 0.22, jpeg: 0.12, exposure: 0.62 },
    {
      paper: { en: 'Smooth photo paper, warm, faintly yellowed.', ru: 'Гладкая фотобумага, тёплая, слегка пожелтевшая.' },
      print: { en: 'Faded print, low ink density, washed toward paper tone.', ru: 'Выцветший отпечаток, малая плотность краски, вымыт к тону бумаги.' },
      aging: { en: 'Sun-bleached, soft, damp rings.', ru: 'Выгоревшая на солнце, мягкая, влажные разводы.' },
      scanner: { en: 'Soft phone capture, warm and slightly blurred.', ru: 'Мягкая съёмка телефоном, тёплая и слегка размытая.' },
    }),

  // Grunge torn collage: dirty black-and-white photocopy, heavy damage & noise.
  make('grunge-collage', 'presetGrungeCollage', 1.0, 'blackInk', 'bw', 'cheap', 'xerox', 1996,
    { yellowing: 0.16, fibers: 0.4, roughness: 0.7, thickness: 0.3, stains: 0.4, moisture: 0.35, creases: 0, scratches: 0.42 },
    { inkDensity: 0.96, dpi: 100, dotGain: 0.6, halftone: 0.5, colorShift: 0, registration: 1.0, fade: 0.3 },
    { scratches: 0.45, abrasions: 0.42, worn: 0.4, paperDamage: 0 },
    { noise: 0.42, dust: 0, streaks: 0.44, blur: 0.1, distortion: 0.14, colorProblems: 0.1, jpeg: 0.2 },
    {
      paper: { en: 'Rough dirty copy paper, stained and damp.', ru: 'Шершавая грязная бумага, в пятнах и влажная.' },
      print: { en: 'Contrasty photocopy, blown highlights, crushed shadows.', ru: 'Контрастная ксерокопия, выбитые света, забитые тени.' },
      aging: { en: 'Torn, heavily scuffed and damaged.', ru: 'Рваная, сильно потёртая и повреждённая.' },
      scanner: { en: 'Grimy scan, heavy noise, streaks and dust.', ru: 'Грязное сканирование, сильный шум, штрихи и пыль.' },
    }),
]

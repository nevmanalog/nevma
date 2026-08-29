// Analog texture library. Real scanned material kept in ONE shared pool — a
// scan is a physical thing (fibres, tone, dirt, scratches), not something that
// only belongs to a single tab. The same source can therefore feed several
// pipeline stages at once (its fibre tone in the paper stage, its blotches in
// the ageing stage, its specks in the scanner stage) exactly where that reads
// as physically plausible. Only the luminance of each scan is used; its colour
// is discarded. Textures are preloaded once and a listener re-bakes on arrival.

// Files live in public/textures/analog and are referenced by URL so Vite serves
// them as static assets (no bundling of large binaries into JS).
const ANALOG_FILES = [
  'textures/analog/scan01.jpg',
  'textures/analog/scan02.jpg',
  'textures/analog/scan03.jpg',
  'textures/analog/scan04.jpg',
  'textures/analog/scan05.jpg',
  'textures/analog/scan06.jpg',
  'textures/analog/scan07.png',
  'textures/analog/scan08.png',
  'textures/analog/scan09.jpg',
  'textures/analog/scan10.jpg',
]

// A role is only a *hint* for how a picked scan is used by the shader (tiling,
// polarity). Every role draws from the same shared pool.
export type TextureRole = 'paper' | 'stain' | 'scanner'

export interface AnalogTexture {
  img: HTMLImageElement
  mid: number // mean luminance 0..1: the scan's neutral point, so the shader can
              // use deviation from its own tone (works for dark and light sheets)
}

const pool: AnalogTexture[] = []
let pending = ANALOG_FILES.length
let ready = false
const listeners = new Set<() => void>()

// Distinct seed offsets per role so the same layer does not necessarily pick
// the identical scan for every stage — but the pools overlap, so a given scan
// can legitimately show up in more than one stage.
const ROLE_OFFSET: Record<TextureRole, number> = { paper: 0, stain: 3, scanner: 7 }

function url(rel: string): string {
  const base = import.meta.env.BASE_URL || '/'
  return `${base.replace(/\/$/, '')}/${rel}`
}

// Mean luminance of an image, computed on a tiny downscaled canvas.
function meanLuminance(img: HTMLImageElement): number {
  const n = 24
  const c = document.createElement('canvas')
  c.width = n
  c.height = n
  const ctx = c.getContext('2d')
  if (!ctx) return 0.5
  ctx.drawImage(img, 0, 0, n, n)
  const { data } = ctx.getImageData(0, 0, n, n)
  let sum = 0
  for (let i = 0; i < data.length; i += 4) {
    sum += (0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]) / 255
  }
  return sum / (n * n)
}

function done() {
  if (--pending <= 0) { ready = true; listeners.forEach((fn) => fn()) }
}

export function loadAnalogTextures(): void {
  if (ready || pool.length) return
  if (pending === 0) { ready = true; return }
  for (const rel of ANALOG_FILES) {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      let mid = 0.5
      try { mid = meanLuminance(img) } catch { /* keep default */ }
      pool.push({ img, mid })
      done()
    }
    img.onerror = () => done()
    img.src = url(rel)
  }
}

export function analogTexturesReady(): boolean {
  return ready
}

// Pick a texture for a given stage deterministically from a seed: stable per
// layer/seed, different across seeds. All roles share one pool; the role only
// offsets the pick so stages don't always align, while still allowing the same
// scan to serve multiple stages.
export function textureForRole(role: TextureRole, seed: number): AnalogTexture | null {
  if (!pool.length) return null
  const idx = Math.abs(Math.floor(seed) + ROLE_OFFSET[role]) % pool.length
  return pool[idx]
}

export function onAnalogTexturesReady(fn: () => void): () => void {
  listeners.add(fn)
  if (ready) fn()
  return () => listeners.delete(fn)
}

// Cache for the per-pixel noise fields sampled by the aging pass
// (history.ts). Every fbm()/valueNoise() call in applyHistory depends only
// on (x, y, seed) and a fixed per-effect frequency — never on the user's
// slider VALUE for that effect (creases, moisture, stains, ...). The slider
// only scales/thresholds the noise value after it's sampled. That means
// dragging a single slider was re-evaluating every octave of every noise
// field across the whole image on every tick, for no reason: the field
// itself hadn't changed at all.
//
// This cache computes each named field once per (seed, width, height) and
// reuses it after that. Only fields actually requested get computed (still
// gated by "is this effect's intensity > 0", same as before), so a layer
// that never touches e.g. "stains" never pays for that field.
//
// Bounded to a small number of most-recently-used (seed, w, h) keys — a
// full field at 4K is ~33MB, and a layer can have up to ~10 of them, so
// unbounded caching would grow without limit across a long editing session
// touching many differently-seeded layers. This module is imported both on
// the main thread and inside each pool worker (materializeWorker.ts); each
// JS context gets its own independent cache, which is what we want — no
// cross-thread sharing/locking needed.

type Fields = Map<string, Float32Array>

// Conservative cap: keep only the single most recently used seed+size. The
// hot path this exists for is "the user is actively dragging a slider on
// the currently active layer" — that only ever needs one key hot at a time.
// Bump this if profiling shows thrashing from switching between a couple of
// active layers, but weigh that against the ~33MB-per-field-per-entry cost.
const MAX_ENTRIES = 1

const cache = new Map<string, Fields>()
const order: string[] = [] // MRU-ordered keys, most recent last

function keyFor(seed: number, w: number, h: number): string {
  return `${seed}:${w}:${h}`
}

function touch(key: string): void {
  const idx = order.indexOf(key)
  if (idx !== -1) order.splice(idx, 1)
  order.push(key)
  while (order.length > MAX_ENTRIES) {
    const evict = order.shift()
    if (evict !== undefined) cache.delete(evict)
  }
}

/**
 * Get the named noise field for this (seed, w, h), computing it via `fill`
 * the first time it's asked for and reusing it after that. `fill` is called
 * with a fresh Float32Array of length w*h to populate (row-major, same
 * layout as the sheet's own fields) — compute it for every pixel, not just
 * a band, so the cache stays valid regardless of which y-range subsequent
 * calls need.
 */
export function getNoiseField(
  name: string, seed: number, w: number, h: number,
  fill: (out: Float32Array, w: number, h: number) => void,
): Float32Array {
  const key = keyFor(seed, w, h)
  let fields = cache.get(key)
  if (!fields) { fields = new Map(); cache.set(key, fields) }
  touch(key)
  let field = fields.get(name)
  if (!field) {
    field = new Float32Array(w * h)
    fill(field, w, h)
    fields.set(name, field)
  }
  return field
}

/** Drop every cached field. Not currently called anywhere — exposed for
 *  tests/tools that want a clean slate, and as an escape hatch if memory
 *  pressure ever needs a manual reset. */
export function clearNoiseFields(): void {
  cache.clear()
  order.length = 0
}

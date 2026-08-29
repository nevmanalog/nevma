// Unit tests for the parameter schema helpers (domain/params.ts). Every aging
// panel, the randomize button, and preset variation all go through
// defaultsFrom/randomizeFrom/varyFrom — if these ever produce a value outside
// a param's [min, max], it flows straight into the engine (see history.ts,
// which trusts these values without re-clamping) and can silently misbehave.

import { describe, expect, it } from 'vitest'
import {
  PAPER_SCHEMA, PRINTER_SCHEMA, DAMAGE_SCHEMA, SCANNER_SCHEMA,
  defaultsFrom, randomizeFrom, varyFrom, type ParamSchema,
} from '@/domain/params'

const SCHEMAS: [string, ParamSchema][] = [
  ['PAPER_SCHEMA', PAPER_SCHEMA],
  ['PRINTER_SCHEMA', PRINTER_SCHEMA],
  ['DAMAGE_SCHEMA', DAMAGE_SCHEMA],
  ['SCANNER_SCHEMA', SCANNER_SCHEMA],
]

describe('defaultsFrom', () => {
  it.each(SCHEMAS)('%s: every default is within [min, max]', (_name, schema) => {
    const defaults = defaultsFrom(schema) as Record<string, number>
    for (const spec of schema) {
      expect(defaults[spec.key]).toBeGreaterThanOrEqual(spec.min)
      expect(defaults[spec.key]).toBeLessThanOrEqual(spec.max)
    }
  })
})

describe('randomizeFrom', () => {
  it.each(SCHEMAS)('%s: stays within bounds across many draws', (_name, schema) => {
    for (let trial = 0; trial < 200; trial++) {
      const out = randomizeFrom(schema, Math.random) as Record<string, number>
      for (const spec of schema) {
        expect(out[spec.key]).toBeGreaterThanOrEqual(spec.min)
        expect(out[spec.key]).toBeLessThanOrEqual(spec.max)
      }
    }
  })

  it.each(SCHEMAS)('%s: hits exactly min at rand()=0 and max at rand()=1', (_name, schema) => {
    const atMin = randomizeFrom(schema, () => 0) as Record<string, number>
    const atMax = randomizeFrom(schema, () => 1) as Record<string, number>
    for (const spec of schema) {
      expect(atMin[spec.key]).toBe(spec.min)
      expect(atMax[spec.key]).toBe(spec.max)
    }
  })
})

describe('varyFrom', () => {
  it.each(SCHEMAS)('%s: jittered output stays within bounds even at the extremes', (_name, schema) => {
    const base = defaultsFrom(schema)
    // rand()=1 pushes every jitter fully positive, rand()=0 fully negative —
    // the two cases most likely to overshoot [min, max] before clamping.
    for (const randVal of [0, 1, 0.5]) {
      const out = varyFrom(schema, base, () => randVal) as Record<string, number>
      for (const spec of schema) {
        expect(out[spec.key]).toBeGreaterThanOrEqual(spec.min)
        expect(out[spec.key]).toBeLessThanOrEqual(spec.max)
      }
    }
  })

  it('amount=0 returns the base value unchanged (mod step rounding)', () => {
    const base = defaultsFrom(PAPER_SCHEMA)
    const out = varyFrom(PAPER_SCHEMA, base, () => Math.random(), 0) as Record<string, number>
    for (const spec of PAPER_SCHEMA) {
      expect(out[spec.key]).toBeCloseTo(base[spec.key as keyof typeof base], 5)
    }
  })

  it('a missing key in base falls back to the schema default instead of NaN', () => {
    const incomplete = {} as Record<string, number>
    const out = varyFrom(PAPER_SCHEMA, incomplete as any, () => 0.5) as Record<string, number>
    for (const spec of PAPER_SCHEMA) {
      expect(Number.isNaN(out[spec.key])).toBe(false)
    }
  })
})

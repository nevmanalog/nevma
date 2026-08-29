// Unit tests for src/state/history.ts's command coalescing (added in Phase 0).
//
// Before this, every onChange tick of a slider pushed its own full Command
// onto the undo stack — dragging one slider a couple of seconds could evict
// real earlier work (a knife cut, a water stroke) from the 100-entry limit.
// The fix merges same-key commands pushed within a short window into a
// single undo step. These tests are the guardrail for that behavior, and for
// the one subtlety that's easy to get wrong: a merged step's undo() must
// restore state from BEFORE the whole burst, not just undo the latest tick.

import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import type { Command } from '@/domain/types'
import { emptyHistory, redo, run, undo, type History } from '@/state/history'

/** A toy "patch a value" command, standing in for store.ts's patchLayer. */
function setValue(box: { value: number }, from: number, to: number, coalesceKey?: string): Command {
  return {
    label: 'Set value',
    coalesceKey,
    execute: () => { box.value = to },
    undo: () => { box.value = from },
    redo() { this.execute() },
  }
}

beforeEach(() => { vi.useFakeTimers() })
afterEach(() => { vi.useRealTimers() })

describe('history command coalescing', () => {
  it('merges rapid same-key commands into a single undo step', () => {
    const box = { value: 0 }
    let h: History = emptyHistory()

    // Simulate dragging a slider from 0 -> 1 -> 2 -> 3, each tick firing
    // near-instantly (well within the coalesce window).
    h = run(h, setValue(box, 0, 1, 'Paper:layer1'))
    vi.advanceTimersByTime(10)
    h = run(h, setValue(box, 1, 2, 'Paper:layer1'))
    vi.advanceTimersByTime(10)
    h = run(h, setValue(box, 2, 3, 'Paper:layer1'))

    expect(box.value).toBe(3)
    expect(h.past).toHaveLength(1) // one undo step for the whole drag, not three
  })

  it("a merged step's undo restores state from BEFORE the whole burst", () => {
    const box = { value: 0 }
    let h: History = emptyHistory()

    h = run(h, setValue(box, 0, 1, 'Paper:layer1'))
    vi.advanceTimersByTime(10)
    h = run(h, setValue(box, 1, 2, 'Paper:layer1'))
    vi.advanceTimersByTime(10)
    h = run(h, setValue(box, 2, 3, 'Paper:layer1'))

    h = undo(h)
    expect(box.value).toBe(0) // NOT 2 — undo must not just reverse the last tick
  })

  it('redo after a merged undo re-applies the final (latest) value', () => {
    const box = { value: 0 }
    let h: History = emptyHistory()

    h = run(h, setValue(box, 0, 1, 'Paper:layer1'))
    vi.advanceTimersByTime(10)
    h = run(h, setValue(box, 1, 2, 'Paper:layer1'))

    h = undo(h)
    expect(box.value).toBe(0)
    h = redo(h)
    expect(box.value).toBe(2)
  })

  it('does not merge commands with different coalesceKeys', () => {
    const boxA = { value: 0 }, boxB = { value: 0 }
    let h: History = emptyHistory()

    h = run(h, setValue(boxA, 0, 1, 'Paper:layer1'))
    vi.advanceTimersByTime(10)
    h = run(h, setValue(boxB, 0, 1, 'Damage:layer1')) // different key: different control

    expect(h.past).toHaveLength(2)
  })

  it('does not merge commands with no coalesceKey at all', () => {
    const box = { value: 0 }
    let h: History = emptyHistory()

    h = run(h, setValue(box, 0, 1))
    vi.advanceTimersByTime(10)
    h = run(h, setValue(box, 1, 2))

    expect(h.past).toHaveLength(2) // e.g. two separate tool strokes
  })

  it('starts a fresh step once the coalesce window has elapsed', () => {
    const box = { value: 0 }
    let h: History = emptyHistory()

    h = run(h, setValue(box, 0, 1, 'Paper:layer1'))
    vi.advanceTimersByTime(700) // past COALESCE_WINDOW_MS (600ms)
    h = run(h, setValue(box, 1, 2, 'Paper:layer1'))

    expect(h.past).toHaveLength(2)
    h = undo(h)
    expect(box.value).toBe(1) // only the second (separate) step was undone
  })

  it('a fresh run() after coalescing clears the redo stack', () => {
    const box = { value: 0 }
    let h: History = emptyHistory()

    h = run(h, setValue(box, 0, 1, 'Paper:layer1'))
    h = undo(h)
    expect(h.future).toHaveLength(1)

    h = run(h, setValue(box, 0, 5, 'Paper:layer1'))
    expect(h.future).toHaveLength(0)
  })
})

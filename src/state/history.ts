// Command-based undo/redo.
//
// Every mutation is a Command with execute()/undo()/redo(). The history keeps
// two stacks of already-executed commands. This is fundamentally different from
// snapshotting results: a command knows HOW to reverse itself, so cutting can
// restore the intact original layer and remove the fragment, and a sandpaper
// stroke can be pulled back out — losslessly.

import type { Command } from '@/domain/types'

const LIMIT = 100

// A burst of commands sharing a coalesceKey, pushed within this many ms of
// each other, is merged into one undo step. 600ms comfortably spans the gap
// between onChange ticks while a slider is actively being dragged (they fire
// far faster than that), but is short enough that coming back to nudge the
// same slider a few seconds later starts a fresh, separate undo step.
const COALESCE_WINDOW_MS = 600

export interface History {
  past: Command[]
  future: Command[]
}

export const emptyHistory = (): History => ({ past: [], future: [] })

// Timestamp of when each command was last pushed/merged, keyed by object
// identity. A WeakMap avoids adding a visible field to Command or leaking
// memory once a command falls out of the history stacks.
const pushedAt = new WeakMap<Command, number>()

/** Run a command for the first time and record it for undo. Clears redo.
 *
 *  If the command carries a coalesceKey matching the most recent past
 *  command, and it was pushed within COALESCE_WINDOW_MS, the two are merged:
 *  the new command's execute/redo apply its (latest) value, but undo stays
 *  the ORIGINAL command's undo — so undoing the merged step restores state
 *  from before the whole burst, not just its last tick. */
export function run(h: History, cmd: Command): History {
  cmd.execute()
  const now = Date.now()
  const last = h.past[h.past.length - 1]
  if (cmd.coalesceKey && last?.coalesceKey === cmd.coalesceKey
    && now - (pushedAt.get(last) ?? 0) < COALESCE_WINDOW_MS) {
    const merged: Command = {
      label: cmd.label, coalesceKey: cmd.coalesceKey,
      execute: cmd.execute, redo: cmd.redo, undo: last.undo,
    }
    pushedAt.set(merged, now)
    return { past: [...h.past.slice(0, -1), merged], future: [] }
  }
  pushedAt.set(cmd, now)
  return { past: [...h.past.slice(-(LIMIT - 1)), cmd], future: [] }
}

export function undo(h: History): History {
  if (h.past.length === 0) return h
  const cmd = h.past[h.past.length - 1]
  cmd.undo()
  return { past: h.past.slice(0, -1), future: [cmd, ...h.future.slice(0, LIMIT - 1)] }
}

export function redo(h: History): History {
  if (h.future.length === 0) return h
  const cmd = h.future[0]
  cmd.redo()
  return { past: [...h.past.slice(-(LIMIT - 1)), cmd], future: h.future.slice(1) }
}

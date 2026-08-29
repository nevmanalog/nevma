import { create } from 'zustand'
import type { Command, ColorMode, CutMode, DocumentMeta, EdgeStyle, EngineId, Layer, LayerGroup, PrepressMode, ScannerMode, SheetOp, ToolId, ToolParameterValues, Viewport } from '@/domain/types'
import type {
  PaperParams, PrinterParams, DamageParams, ScannerParams, PaperType, PrinterType,
} from '@/domain/params'
import {
  defaultPaper, defaultPrinter, defaultDamage, defaultScanner,
  PAPER_SCHEMA, PRINTER_SCHEMA, DAMAGE_SCHEMA, SCANNER_SCHEMA, randomizeFrom, varyFrom,
} from '@/domain/params'
import { PRESETS } from '@/domain/presets'
import { buildDefaultFinal, normalizeFinal } from '@/engine/final/registry'
import { retear, type CropBounds } from '@/engine/cut'
import { getLayerBakedCanvas } from '@/engine/sheet/cache'
import { newId, makeRng } from '@/shared/id'
import { emptyHistory, run as histRun, undo as histUndo, redo as histRedo, type History } from './history'
import { alignedTransform, clampTransformToCanvas, fitTransformToCanvas, transformPoint, type AlignMode } from '@/shared/bounds'

// Separated data model. Each layer's pixel sources live here, keyed by layer id.
//   originalBitmaps: the pristine, never-mutated source pixels of a layer.
//   sourceBitmaps:   the working pixels the renderer reads (for a donor after a
//                    cut this is the holed image; for everything else it equals
//                    the original). Kept distinct so a cut is fully reversible.
export const originalBitmaps = new Map<string, HTMLCanvasElement | HTMLImageElement>()
export const sourceBitmaps = new Map<string, HTMLCanvasElement | HTMLImageElement>()

// Everything needed to re-run the tear pass for a cut layer with a new edge
// colour. Kept so the cut edge stays recolourable after the cut is committed.
interface CutInfo {
  source: HTMLCanvasElement | HTMLImageElement
  mask: HTMLCanvasElement
  width: number
  height: number
  invert: boolean
  style: EdgeStyle
  seed: number
  crop?: CropBounds
}
export const cutInfo = new Map<string, CutInfo>()

// Ordered physical workshop operations per layer. These are REPLAYED in order
// on top of the printed base by engine/sheet, so their sequence is meaningful.
// Kept outside React state (like the bitmap maps) and versioned via bakeToken.
export const sheetOps = new Map<string, SheetOp[]>()

interface SavedPreset {
  id: string
  name: string
  effects: Layer['effects']
  seed: number
}

interface AppState {
  doc: DocumentMeta | null
  // Bumped whenever a brand-new document is created, so the viewport can fit it
  // to screen. Loading a project does NOT bump it (the saved viewport is kept).
  fitRequest: number
  layerOrder: string[]
  layers: Record<string, Layer>
  activeLayerId: string | null
  activeGroupId: string | null
  activeTool: ToolId
  cutMode: CutMode
  edgeStyle: EdgeStyle
  lockAspect: boolean
  viewport: Viewport
  bakeToken: Record<string, number>
  savedPresets: SavedPreset[]
  collapsed: Record<string, boolean>
  helpKey: string | null
  history: History
  canUndo: boolean
  canRedo: boolean
  groups: LayerGroup[]
  layerGroups: Record<string, string> // layerId -> groupId

  createDocument: (opts: { name: string; width: number; height: number }) => void
  addImageLayer: (img: HTMLImageElement | HTMLCanvasElement, width?: number, height?: number) => void
  addBlankLayer: () => void
  commitCut: (donorId: string, holedCanvas: HTMLCanvasElement, fragCanvas: HTMLCanvasElement, name: string, x: number, y: number, edgeStyle: EdgeStyle, mask: HTMLCanvasElement, crop: CropBounds) => void
  reorderLayers: (order: string[]) => void
  setActiveLayer: (id: string | null) => void
  setActiveGroup: (gid: string | null) => void
  setTool: (t: ToolId) => void
  setCutMode: (m: CutMode) => void
  setEdgeStyle: (s: EdgeStyle) => void
  setLockAspect: (v: boolean) => void
  setViewport: (v: Partial<Viewport>) => void
  commitTransform: (id: string, before: Layer['transform'], after: Layer['transform']) => void
  liveTransform: (id: string, patch: Partial<Layer['transform']>) => void
  /** Photoshop-style "align to canvas": snaps the active layer's position
   *  (edge or center) to the document bounds. Keeps scale/rotation intact. */
  alignLayer: (id: string, mode: AlignMode) => void
  /** Uniformly scales + centers the layer so it's entirely visible inside
   *  the canvas (may leave a gap on one axis). Non-destructive. */
  fitLayerToCanvas: (id: string) => void
  /** Uniformly scales + centers the layer so it fully covers the canvas
   *  edge-to-edge (may overhang on one axis, same as align-bar clamping
   *  already allows). Non-destructive — the overhang is just not visible. */
  fillLayerToCanvas: (id: string) => void
  /** Destructively bakes the layer's current on-canvas appearance into a new
   *  bitmap exactly the size of the document, discarding whatever falls
   *  outside the canvas edges, and resets its transform to identity. Undoable
   *  like everything else. */
  cropLayerToCanvas: (id: string) => void
  updateIntensity: (id: string, v: number) => void
  updatePaper: (id: string, patch: Partial<PaperParams>) => void
  updatePrinter: (id: string, patch: Partial<PrinterParams>) => void
  updateDamage: (id: string, patch: Partial<DamageParams>) => void
  updateScanner: (id: string, patch: Partial<ScannerParams>) => void
  setPrepress: (id: string, m: PrepressMode) => void
  setScannerMode: (id: string, m: ScannerMode) => void
  setColorMode: (id: string, m: ColorMode) => void
  setPaperColor: (id: string, hex: string) => void
  setTint: (id: string, hex: string) => void
  setEdgeColor: (id: string, hex: string) => void
  setPaperType: (id: string, t: PaperType) => void
  setPrinterType: (id: string, t: PrinterType) => void
  toggleEngine: (id: string, engine: EngineId) => void
  setSeed: (id: string, seed: number) => void
  toggleFinalAdjustment: (id: string, adjId: string) => void
  updateFinalAdjustment: (id: string, adjId: string, patch: Record<string, number>) => void
  applyPreset: (id: string, presetId: string) => void
  randomizeTemplate: (id: string, presetId: string) => void
  saveCurrentPreset: (id: string, name: string) => void
  applySavedPreset: (id: string, presetId: string) => void
  renamePreset: (presetId: string, name: string) => void
  deletePreset: (presetId: string) => void
  /** Adds an externally-sourced preset (e.g. from a published community
   *  post — see PostPresetChip) straight into savedPresets, without needing
   *  an active layer to snapshot from the way saveCurrentPreset does. Shows
   *  up immediately in the Final tab's "load saved" dropdown. */
  importPreset: (name: string, effects: Layer['effects'], seed: number) => void
  randomize: (id: string) => void
  toggleVisible: (id: string) => void
  toggleLocked: (id: string) => void
  renameLayer: (id: string, name: string) => void
  removeLayer: (id: string) => void
  /** Flattens two or more layers (as they currently look on the canvas —
   *  every effect and workshop op included) into ONE new layer stacked on
   *  top. Non-destructive: the source layers are left exactly as they were,
   *  still in the stack, still editable — this only adds a layer, it never
   *  removes or hides one. */
  mergeLayers: (ids: string[]) => void
  createGroup: () => void
  renameGroup: (gid: string, name: string) => void
  deleteGroup: (gid: string) => void
  toggleGroupCollapsed: (gid: string) => void
  setLayerGroup: (id: string, gid: string | null) => void
  setGroupVisible: (gid: string, visible: boolean) => void
  toggleCollapsed: (key: string) => void
  setHelp: (key: string | null) => void
  addSheetOp: (layerId: string, op: SheetOp) => void
  addSheetOps: (entries: { layerId: string; op: SheetOp }[]) => void
  /** Photoshop-style: switch one already-applied tool op on/off without losing
   *  its settings or its place in the stack. */
  toggleSheetOp: (layerId: string, index: number) => void
  /** Edit the parameters of an already-applied tool op after the fact — the
   *  whole stack replays from the material baseline with the new values. */
  updateSheetOpParameters: (layerId: string, index: number, patch: ToolParameterValues) => void
  /** Remove an already-applied tool op from the stack entirely. */
  removeSheetOp: (layerId: string, index: number) => void
  undo: () => void
  redo: () => void
  jumpHistory: (appliedCount: number) => void
  bump: (id: string) => void
}

let counter = 0

const freshEffects = (): Layer['effects'] => ({
  intensity: 1,
  prepress: 'fullColor',
  colorMode: 'color',
  tint: '#8a6d3b',
  edgeColor: '#efe7d6',
  paperColor: '#ffffff',
  paperType: 'oldAd',
  printerType: 'offset',
  scannerMode: 'home',
  paper: defaultPaper(),
  printer: defaultPrinter(),
  damage: defaultDamage(),
  scanner: defaultScanner(),
  // A freshly uploaded image is the clean original: every physical engine is
  // off until the user applies a template or explicitly enables a stage.
  engines: { paper: false, printer: false, damage: false, scanner: false },
  final: buildDefaultFinal(),
})

const loadCollapsed = (): Record<string, boolean> => {
  try { return JSON.parse(localStorage.getItem('collapsed') || '{}') } catch { return {} }
}

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v))

// A raster canvas of the given size. `fill` paints a solid background (used for
// the white document background); omitting it leaves fully transparent pixels
// (used for empty Photoshop-style layers).
const makeRasterCanvas = (w: number, h: number, fill?: string): HTMLCanvasElement => {
  const c = document.createElement('canvas')
  c.width = Math.max(1, Math.round(w))
  c.height = Math.max(1, Math.round(h))
  if (fill) {
    const ctx = c.getContext('2d')!
    ctx.fillStyle = fill
    ctx.fillRect(0, 0, c.width, c.height)
  }
  return c
}

export const useStore = create<AppState>((set, get) => {
  const bump = (id: string) => set((s) => ({ bakeToken: { ...s.bakeToken, [id]: (s.bakeToken[id] ?? 0) + 1 } }))

  // Push and run a command, then refresh the can-undo/redo flags.
  const dispatch = (cmd: Command) => {
    set((s) => ({ history: histRun(s.history, cmd) }))
    syncFlags()
  }
  const syncFlags = () => {
    const h = get().history
    set({ canUndo: h.past.length > 0, canRedo: h.future.length > 0 })
  }

  // Re-run the tear for a cut layer with a new edge colour and swap in the
  // regenerated pixels. No-op for layers that were never cut.
  const regenCutSource = (id: string, edgeColor: string) => {
    const info = cutInfo.get(id)
    if (!info) return
    const full = retear(info.source, info.mask, info.width, info.height, info.invert, info.style, info.seed, edgeColor)
    if (info.crop) {
      const { fx, fy, fw, fh } = info.crop
      const cropped = document.createElement('canvas')
      cropped.width = fw
      cropped.height = fh
      cropped.getContext('2d')!.drawImage(full, fx, fy, fw, fh, 0, 0, fw, fh)
      sourceBitmaps.set(id, cropped)
      originalBitmaps.set(id, cropped)
    } else {
      sourceBitmaps.set(id, full)
    }
  }

  // Generic per-layer patch command factory. Captures before/after so undo is
  // an exact restore, not a re-computation.
  const patchLayer = (id: string, label: string, before: Partial<Layer>, after: Partial<Layer>): Command => ({
    label,
    // Same label + same layer, pushed in quick succession, is almost always
    // one continuous interaction (dragging a single slider fires many
    // onChange ticks) — coalesce those into a single undo step. See
    // history.ts for the merge window.
    coalesceKey: `${label}:${id}`,
    execute() { set((s) => ({ layers: { ...s.layers, [id]: { ...s.layers[id], ...clone(after) } } })); bump(id) },
    undo() { set((s) => ({ layers: { ...s.layers, [id]: { ...s.layers[id], ...clone(before) } } })); bump(id) },
    redo() { this.execute() },
  })

  // Multi-layer version: one atomic, reversible command that patches several
  // layers at once. Used for group edits so undo/redo moves every group member
  // together in a single history step.
  interface LayerEdit { id: string; before: Partial<Layer>; after: Partial<Layer> }
  const patchLayersCmd = (label: string, edits: LayerEdit[]): Command => ({
    label,
    coalesceKey: `${label}:${edits.map((e) => e.id).join(',')}`,
    execute() {
      set((s) => {
        const layers = { ...s.layers }
        for (const e of edits) layers[e.id] = { ...layers[e.id], ...clone(e.after) }
        return { layers }
      })
      for (const e of edits) bump(e.id)
    },
    undo() {
      set((s) => {
        const layers = { ...s.layers }
        for (const e of edits) layers[e.id] = { ...layers[e.id], ...clone(e.before) }
        return { layers }
      })
      for (const e of edits) bump(e.id)
    },
    redo() { this.execute() },
  })

  // Resolve which layers an "active selection" edit should touch. When a group
  // is selected every unlocked member is a target; otherwise it is just the one
  // passed layer. Locked layers are never mutated in group mode.
  const editTargets = (id: string): string[] => {
    const s = get()
    if (s.activeGroupId && id === s.activeLayerId) {
      const members = s.layerOrder.filter(
        (lid) => s.layerGroups[lid] === s.activeGroupId && s.layers[lid] && !s.layers[lid].locked,
      )
      if (members.length > 0) return members
    }
    return [id]
  }

  // Capture the before-state for exactly the keys an `after` patch will change,
  // so undo restores those keys and nothing else.
  const pickBefore = (l: Layer, after: Partial<Layer>): Partial<Layer> => {
    const before: Partial<Layer> = {}
    if ('effects' in after) before.effects = clone(l.effects)
    if ('seed' in after) before.seed = l.seed
    if ('name' in after) before.name = l.name
    if ('visible' in after) before.visible = l.visible
    if ('locked' in after) before.locked = l.locked
    if ('transform' in after) before.transform = clone(l.transform)
    if ('width' in after) before.width = l.width
    if ('height' in after) before.height = l.height
    if ('edgeStyle' in after) before.edgeStyle = l.edgeStyle
    return before
  }

  // Dispatch a patch against the active selection (single layer or whole group)
  // as one history command. `build` produces the `after` patch for each target
  // from that layer's own current state.
  const patchActive = (id: string, label: string, build: (l: Layer) => Partial<Layer>) => {
    const targets = editTargets(id)
    const edits: LayerEdit[] = []
    for (const tid of targets) {
      const l = get().layers[tid]
      if (!l) continue
      const after = build(l)
      edits.push({ id: tid, before: pickBefore(l, after), after })
    }
    if (edits.length === 0) return
    if (edits.length === 1) { dispatch(patchLayer(edits[0].id, label, edits[0].before, edits[0].after)); return }
    dispatch(patchLayersCmd(label, edits))
  }

  return {
    doc: null,
    fitRequest: 0,
    layerOrder: [],
    layers: {},
    activeLayerId: null,
    activeGroupId: null,
    activeTool: 'select',
    cutMode: 'lasso',
    edgeStyle: 'torn',
    lockAspect: true,
    viewport: { x: 0, y: 0, scale: 1 },
    bakeToken: {},
    savedPresets: [],
    collapsed: loadCollapsed(),
    helpKey: null,
    history: emptyHistory(),
    canUndo: false,
    canRedo: false,
    groups: [],
    layerGroups: {},

    // Start a fresh project on a blank white canvas ("New project"). This is a
    // hard reset: it clears every layer, group, history entry and the off-React
    // pixel maps, then drops in a single white background layer the size of the
    // chosen canvas. All existing tools then operate relative to this document.
    createDocument: ({ name, width, height }) => {
      originalBitmaps.clear()
      sourceBitmaps.clear()
      cutInfo.clear()
      sheetOps.clear()
      counter = 0
      const bgId = newId()
      const bg = makeRasterCanvas(width, height, '#ffffff')
      originalBitmaps.set(bgId, bg)
      sourceBitmaps.set(bgId, bg)
      const layer: Layer = {
        id: bgId, name: 'Background', kind: 'base', isCanvas: true, visible: true, locked: false,
        width: bg.width, height: bg.height,
        transform: { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 },
        effects: freshEffects(), seed: Math.floor(Math.random() * 100000),
        edgeStyle: 'torn',
      }
      set((s) => ({
        doc: { name: name || 'Untitled', width: bg.width, height: bg.height, background: 'white' },
        fitRequest: s.fitRequest + 1,
        layers: { [bgId]: layer },
        layerOrder: [bgId],
        activeLayerId: bgId,
        activeGroupId: null,
        groups: [],
        layerGroups: {},
        history: emptyHistory(),
        canUndo: false,
        canRedo: false,
        bakeToken: { [bgId]: 1 },
        viewport: { x: 0, y: 0, scale: 1 },
      }))
    },

    // Add an empty, fully transparent layer the size of the document — the
    // Photoshop "New Layer" action. Reversible like every other mutation.
    addBlankLayer: () => {
      const doc = get().doc
      const w = doc?.width ?? 1000
      const h = doc?.height ?? 1000
      const id = newId()
      const canvas = makeRasterCanvas(w, h)
      const layer: Layer = {
        id, name: `Layer ${++counter}`, kind: 'blank', visible: true, locked: false,
        width: canvas.width, height: canvas.height,
        transform: { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 },
        effects: freshEffects(), seed: Math.floor(Math.random() * 100000),
        edgeStyle: 'torn',
      }
      const cmd: Command = {
        label: 'New layer',
        execute() {
          originalBitmaps.set(id, canvas)
          sourceBitmaps.set(id, canvas)
          set((s) => ({
            layers: { ...s.layers, [id]: clone(layer) },
            layerOrder: [...s.layerOrder, id],
            activeLayerId: id,
            bakeToken: { ...s.bakeToken, [id]: (s.bakeToken[id] ?? 0) + 1 },
          }))
        },
        undo() {
          set((s) => {
            const layers = { ...s.layers }; delete layers[id]
            return { layers, layerOrder: s.layerOrder.filter((x) => x !== id), activeLayerId: s.activeLayerId === id ? null : s.activeLayerId }
          })
        },
        redo() { this.execute() },
      }
      dispatch(cmd)
    },

    addImageLayer: (img, width, height) => {
      const id = newId()
      const layer: Layer = {
        id, name: `Image ${++counter}`, kind: 'base', visible: true, locked: false,
        width: width ?? ('naturalWidth' in img ? img.naturalWidth : img.width),
        height: height ?? ('naturalHeight' in img ? img.naturalHeight : img.height),
        transform: { x: 60, y: 60, scaleX: 1, scaleY: 1, rotation: 0 },
        effects: freshEffects(), seed: Math.floor(Math.random() * 100000),
        edgeStyle: 'torn',
      }
      const cmd: Command = {
        label: 'Add image',
        execute() {
          originalBitmaps.set(id, img)
          sourceBitmaps.set(id, img)
          set((s) => ({
            layers: { ...s.layers, [id]: clone(layer) },
            layerOrder: [...s.layerOrder, id],
            activeLayerId: id,
            bakeToken: { ...s.bakeToken, [id]: (s.bakeToken[id] ?? 0) + 1 },
          }))
        },
        undo() {
          set((s) => {
            const layers = { ...s.layers }; delete layers[id]
            return { layers, layerOrder: s.layerOrder.filter((x) => x !== id), activeLayerId: s.activeLayerId === id ? null : s.activeLayerId }
          })
        },
        redo() { this.execute() },
      }
      dispatch(cmd)
    },

    // Cutting as a fully reversible command.
    // execute: donor pixels -> holed; add fragment layer.
    // undo:    donor pixels -> ORIGINAL (kept alive); remove fragment.
    // The donor's original bitmap is never overwritten or deleted.
    commitCut: (donorId, holedCanvas, fragCanvas, name, x, y, edgeStyle, mask, crop) => {
      const fragId = newId()
      const donorBefore = get().layers[donorId]
      const donorOriginal = originalBitmaps.get(donorId) ?? sourceBitmaps.get(donorId)!
      const donorPrevSource = sourceBitmaps.get(donorId)! // may already be holed from earlier
      const prevWidth = donorBefore.width
      const prevHeight = donorBefore.height
      const donorPrevCutInfo = cutInfo.get(donorId)
      // The physical workshop history made before the cut must survive into both
      // pieces. The donor keeps its ops verbatim (they replay on the holed base;
      // strokes over the hole fall on transparent pixels and no-op). The fragment
      // inherits the SAME ordered ops, re-expressed in fragment-local coordinates
      // by subtracting the crop offset — so every edit inside the cut-out shape
      // reappears on the new layer. Ops outside the fragment simply clip away.
      const donorOpsAtCut = sheetOps.get(donorId) ?? []
      const buildFragOps = (): SheetOp[] => donorOpsAtCut.map((op) => {
        const cloned = clone(op)
        for (let i = 0; i + 1 < cloned.points.length; i += 2) {
          cloned.points[i] -= crop.fx
          cloned.points[i + 1] -= crop.fy
        }
        return cloned
      })
      const frag: Layer = {
        id: fragId, name, kind: 'fragment', visible: true, locked: false,
        width: fragCanvas.width, height: fragCanvas.height,
        // The fragment's pixels are cropped from the donor's LOCAL (unrotated,
        // unscaled) pixel grid, so to land in the same place at the same size
        // on the canvas it must keep the donor's rotation/scale at the moment
        // of the cut — only the position changes, to the world-space point
        // that corner was sitting at (passed in as x, y, already computed by
        // applying the donor's full transform to the crop offset). Hardcoding
        // scale/rotation to identity here made every cut piece snap back to
        // an unrotated, unscaled size — wrong size and wrong position for any
        // layer that had been rotated or scaled before cutting.
        transform: { x, y, scaleX: donorBefore.transform.scaleX, scaleY: donorBefore.transform.scaleY, rotation: donorBefore.transform.rotation },
        effects: clone(donorBefore.effects), seed: donorBefore.seed, edgeStyle,
      }
      const cmd: Command = {
        label: 'Cut',
        execute() {
          sourceBitmaps.set(donorId, holedCanvas)
          originalBitmaps.set(fragId, fragCanvas)
          sourceBitmaps.set(fragId, fragCanvas)
          if (donorOpsAtCut.length) sheetOps.set(fragId, buildFragOps())
          // Keep enough to recolour either edge later without re-selecting.
          cutInfo.set(donorId, { source: donorPrevSource, mask, width: donorBefore.width, height: donorBefore.height, invert: true, style: edgeStyle, seed: donorBefore.seed })
          cutInfo.set(fragId, { source: donorPrevSource, mask, width: donorBefore.width, height: donorBefore.height, invert: false, style: edgeStyle, seed: donorBefore.seed, crop })
          set((s) => ({
            layers: {
              ...s.layers,
              [donorId]: { ...s.layers[donorId], width: holedCanvas.width, height: holedCanvas.height },
              [fragId]: clone(frag),
            },
            layerOrder: [...s.layerOrder, fragId],
            activeLayerId: fragId,
            bakeToken: { ...s.bakeToken, [donorId]: (s.bakeToken[donorId] ?? 0) + 1, [fragId]: 1 },
          }))
        },
        undo() {
          // restore donor to exactly what it was before the cut
          sourceBitmaps.set(donorId, donorPrevSource)
          originalBitmaps.set(donorId, donorOriginal)
          sourceBitmaps.delete(fragId)
          originalBitmaps.delete(fragId)
          sheetOps.delete(fragId)
          cutInfo.delete(fragId)
          if (donorPrevCutInfo) cutInfo.set(donorId, donorPrevCutInfo)
          else cutInfo.delete(donorId)
          set((s) => {
            const layers = { ...s.layers }
            delete layers[fragId]
            layers[donorId] = { ...layers[donorId], width: prevWidth, height: prevHeight }
            return {
              layers,
              layerOrder: s.layerOrder.filter((id) => id !== fragId),
              activeLayerId: donorId,
              bakeToken: { ...s.bakeToken, [donorId]: (s.bakeToken[donorId] ?? 0) + 1 },
            }
          })
        },
        redo() { this.execute() },
      }
      dispatch(cmd)
    },

    // Reorder as a reversible command. layerOrder is bottom->top, so the
    // renderer (which maps over it in order) reflects the new stacking at once.
    reorderLayers: (order) => {
      const before = get().layerOrder
      // The canvas layer is pinned at the very bottom (index 0) no matter
      // what order the caller asks for — belt-and-braces alongside
      // LayersPanel not making it draggable in the first place, so a stray
      // drop (or any future caller) can never bury it under other layers or
      // shuffle it out of its slot.
      const layers = get().layers
      const canvasId = before.find((id) => layers[id]?.isCanvas)
      const after = canvasId
        ? [canvasId, ...order.filter((id) => id !== canvasId)]
        : [...order]
      dispatch({
        label: 'Reorder layers',
        execute() { set({ layerOrder: [...after] }) },
        undo() { set({ layerOrder: [...before] }) },
        redo() { this.execute() },
      })
    },

    // Selecting a concrete layer clears any group selection: edits then target
    // only that layer.
    setActiveLayer: (id) => set({ activeLayerId: id, activeGroupId: null }),
    // Selecting a group keeps a representative layer active (so the right panel
    // has something to show and single-layer tools like Cut still work), while
    // marking the group so edits fan out to every member.
    setActiveGroup: (gid) => {
      if (!gid) { set({ activeGroupId: null }); return }
      const s = get()
      const members = s.layerOrder.filter((lid) => s.layerGroups[lid] === gid && s.layers[lid])
      if (members.length === 0) { set({ activeGroupId: gid }); return }
      const rep = members[members.length - 1] // top-most member
      set({ activeGroupId: gid, activeLayerId: rep })
    },
    setTool: (t) => set({ activeTool: t }),
    setCutMode: (m) => set({ cutMode: m }),
    setEdgeStyle: (s) => set({ edgeStyle: s }),
    setLockAspect: (v) => set({ lockAspect: v }),
    setViewport: (v) => set((s) => ({ viewport: { ...s.viewport, ...v } })),

    // live drag: no history, just visual state
    liveTransform: (id, patch) =>
      set((s) => ({ layers: { ...s.layers, [id]: { ...s.layers[id], transform: { ...s.layers[id].transform, ...patch } } } })),
    // final drop: one command capturing before/after transform. Cut fragments
    // are always clamped fully back inside the canvas — they can never be
    // left hanging off the edge. Regular image layers are left as dropped:
    // they're allowed to hang off the canvas edge (use alignLayer /
    // fit-to-canvas to line them back up, Photoshop-style).
    commitTransform: (id, before, after) => {
      const l = get().layers[id]
      const doc = get().doc
      const clamped = l && doc && l.kind === 'fragment'
        ? clampTransformToCanvas(after, l.width, l.height, doc.width, doc.height, true)
        : after
      dispatch(patchLayer(id, 'Transform', { transform: clone(before) }, { transform: clone(clamped) }))
    },

    alignLayer: (id, mode) => {
      const s = get()
      const l = s.layers[id]
      const doc = s.doc
      if (!l || !doc || l.locked) return
      const before = { ...l.transform }
      const after = alignedTransform(before, l.width, l.height, doc.width, doc.height, mode)
      if (after.x === before.x && after.y === before.y) return
      dispatch(patchLayer(id, 'Align', { transform: clone(before) }, { transform: clone(after) }))
    },

    fitLayerToCanvas: (id) => {
      const s = get()
      const l = s.layers[id]
      const doc = s.doc
      if (!l || !doc || l.locked) return
      const before = { ...l.transform }
      const after = fitTransformToCanvas(l.width, l.height, doc.width, doc.height, 'contain')
      dispatch(patchLayer(id, 'Fit to canvas', { transform: clone(before) }, { transform: clone(after) }))
    },

    fillLayerToCanvas: (id) => {
      const s = get()
      const l = s.layers[id]
      const doc = s.doc
      if (!l || !doc || l.locked) return
      const before = { ...l.transform }
      const after = fitTransformToCanvas(l.width, l.height, doc.width, doc.height, 'cover')
      dispatch(patchLayer(id, 'Fill canvas', { transform: clone(before) }, { transform: clone(after) }))
    },

    // Flattens the layer's current transform into its pixels: rasterizes
    // exactly what's visible inside the document bounds into a new
    // doc-sized bitmap, then resets position/scale/rotation to identity.
    // Anything hanging off the canvas edge is permanently gone from this
    // layer's pixels (though the whole op is one undo step, like a cut).
    cropLayerToCanvas: (id) => {
      const s = get()
      const l = s.layers[id]
      const doc = s.doc
      const src = sourceBitmaps.get(id)
      if (!l || !doc || l.locked || !src) return
      const t = l.transform
      const docW = Math.max(1, Math.round(doc.width))
      const docH = Math.max(1, Math.round(doc.height))
      const bake = (source: HTMLCanvasElement | HTMLImageElement) => {
        const canvas = document.createElement('canvas')
        canvas.width = docW
        canvas.height = docH
        const ctx = canvas.getContext('2d')!
        ctx.imageSmoothingEnabled = true
        ctx.save()
        ctx.translate(t.x, t.y)
        ctx.rotate((t.rotation * Math.PI) / 180)
        ctx.scale(t.scaleX, t.scaleY)
        ctx.drawImage(source, 0, 0, l.width, l.height)
        ctx.restore()
        return canvas
      }
      const newSource = bake(src)
      const prevOriginal = originalBitmaps.get(id)
      const newOriginal = prevOriginal ? bake(prevOriginal) : newSource

      const prevSource = src
      const prevWidth = l.width
      const prevHeight = l.height
      const prevTransform = clone(t)
      const prevOps = sheetOps.get(id)
      const prevCutInfo = cutInfo.get(id)
      // Existing brush strokes are stored in the layer's OLD local pixel
      // space; re-express each point in document space (identical to what
      // its old transform already put it at) so they land in the same
      // physical spot once the layer's transform becomes identity.
      const newOps = prevOps?.map((op) => {
        const cloned = clone(op)
        for (let i = 0; i + 1 < cloned.points.length; i += 2) {
          const p = transformPoint(t, cloned.points[i], cloned.points[i + 1])
          cloned.points[i] = p.x
          cloned.points[i + 1] = p.y
        }
        return cloned
      })
      const identity: Layer['transform'] = { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 }

      const cmd: Command = {
        label: 'Crop to canvas',
        execute() {
          sourceBitmaps.set(id, newSource)
          originalBitmaps.set(id, newOriginal)
          if (newOps) sheetOps.set(id, newOps)
          cutInfo.delete(id) // the cut edge no longer matches the new geometry
          set((s2) => ({
            layers: {
              ...s2.layers,
              [id]: { ...s2.layers[id], width: newSource.width, height: newSource.height, transform: clone(identity) },
            },
            bakeToken: { ...s2.bakeToken, [id]: (s2.bakeToken[id] ?? 0) + 1 },
          }))
        },
        undo() {
          sourceBitmaps.set(id, prevSource)
          if (prevOriginal) originalBitmaps.set(id, prevOriginal); else originalBitmaps.delete(id)
          if (prevOps) sheetOps.set(id, prevOps); else sheetOps.delete(id)
          if (prevCutInfo) cutInfo.set(id, prevCutInfo); else cutInfo.delete(id)
          set((s2) => ({
            layers: {
              ...s2.layers,
              [id]: { ...s2.layers[id], width: prevWidth, height: prevHeight, transform: clone(prevTransform) },
            },
            bakeToken: { ...s2.bakeToken, [id]: (s2.bakeToken[id] ?? 0) + 1 },
          }))
        },
        redo() { this.execute() },
      }
      dispatch(cmd)
    },

    updateIntensity: (id, v) => {
      patchActive(id, 'Intensity', (l) => ({ effects: { ...clone(l.effects), intensity: v } }))
    },
    updatePaper: (id, patch) => {
      patchActive(id, 'Paper', (l) => ({ effects: { ...clone(l.effects), paper: { ...l.effects.paper, ...patch } } }))
    },
    updatePrinter: (id, patch) => {
      patchActive(id, 'Printer', (l) => ({ effects: { ...clone(l.effects), printer: { ...l.effects.printer, ...patch } } }))
    },
    updateDamage: (id, patch) => {
      patchActive(id, 'Damage', (l) => ({ effects: { ...clone(l.effects), damage: { ...l.effects.damage, ...patch } } }))
    },
    updateScanner: (id, patch) => {
      patchActive(id, 'Scanner', (l) => ({ effects: { ...clone(l.effects), scanner: { ...l.effects.scanner, ...patch } } }))
    },
    setPrepress: (id, m) => {
      patchActive(id, 'Prepress mode', (l) => ({ effects: { ...clone(l.effects), prepress: m } }))
    },
    setScannerMode: (id, m) => {
      patchActive(id, 'Scanner mode', (l) => ({ effects: { ...clone(l.effects), scannerMode: m } }))
    },
    setColorMode: (id, m) => {
      patchActive(id, 'Colour mode', (l) => ({ effects: { ...clone(l.effects), colorMode: m } }))
    },
    setPaperColor: (id, hex) => {
      patchActive(id, 'Paper colour', (l) => ({ effects: { ...clone(l.effects), paperColor: hex } }))
    },
    setTint: (id, hex) => {
      patchActive(id, 'Tint', (l) => ({ effects: { ...clone(l.effects), tint: hex } }))
    },
    // Recolour the exposed paper interior of a cut edge. For a layer that was
    // cut we re-run the tear with the new colour (regenCutSource); for anything
    // else it is a plain effect change. Both are reversible.
    setEdgeColor: (id, hex) => {
      const targets = editTargets(id)
      const items = targets
        .map((tid) => ({ tid, before: get().layers[tid]?.effects.edgeColor }))
        .filter((it): it is { tid: string; before: string } => it.before !== undefined)
      if (items.length === 0) return
      const setColor = (tid: string, c: string) =>
        set((s) => ({ layers: { ...s.layers, [tid]: { ...s.layers[tid], effects: { ...s.layers[tid].effects, edgeColor: c } } } }))
      dispatch({
        label: 'Edge colour',
        execute() { for (const it of items) { setColor(it.tid, hex); regenCutSource(it.tid, hex); bump(it.tid) } },
        undo() { for (const it of items) { setColor(it.tid, it.before); regenCutSource(it.tid, it.before); bump(it.tid) } },
        redo() { this.execute() },
      })
    },
    setPaperType: (id, t) => {
      patchActive(id, 'Paper type', (l) => ({ effects: { ...clone(l.effects), paperType: t } }))
    },
    setPrinterType: (id, t) => {
      patchActive(id, 'Printer type', (l) => ({ effects: { ...clone(l.effects), printerType: t } }))
    },
    toggleEngine: (id, engine) => {
      // Toggle relative to the active layer's current state, then apply the SAME
      // resulting value to every group member so the group stays in sync.
      const primary = get().layers[id]
      if (!primary) return
      const value = !primary.effects.engines[engine]
      patchActive(id, 'Toggle engine', (l) => ({ effects: { ...clone(l.effects), engines: { ...l.effects.engines, [engine]: value } } }))
    },
    setSeed: (id, seed) => {
      patchActive(id, 'Seed', () => ({ seed }))
    },

    // Final-stage adjustment layers. Each is toggled and tuned independently and
    // only ever affects the final compositing pass, never an earlier stage.
    toggleFinalAdjustment: (id, adjId) => {
      const primary = get().layers[id]
      if (!primary) return
      const primaryCurrent = normalizeFinal(primary.effects.final)[adjId]
      if (!primaryCurrent) return
      const value = !primaryCurrent.enabled
      patchActive(id, 'Toggle final', (l) => {
        const final = normalizeFinal(l.effects.final)
        const current = final[adjId]
        if (!current) return { effects: clone(l.effects) }
        return { effects: { ...clone(l.effects), final: { ...final, [adjId]: { ...current, enabled: value } } } }
      })
    },
    updateFinalAdjustment: (id, adjId, patch) => {
      patchActive(id, 'Final adjust', (l) => {
        const final = normalizeFinal(l.effects.final)
        const current = final[adjId]
        if (!current) return { effects: clone(l.effects) }
        return { effects: { ...clone(l.effects), final: { ...final, [adjId]: { ...current, values: { ...current.values, ...patch } } } } }
      })
    },

    applyPreset: (id, presetId) => {
      const preset = PRESETS.find((p) => p.id === presetId)
      if (!preset) return
      patchActive(id, 'Apply preset', (l) => ({
        effects: {
          ...clone(l.effects), // keep tint / edge colour
          intensity: preset.intensity, prepress: preset.prepress, colorMode: preset.colorMode,
          paperType: preset.paperType, printerType: preset.printerType,
          paper: { ...preset.paper }, printer: { ...preset.printer }, damage: { ...preset.damage }, scanner: { ...preset.scanner },
          // a template is a full look — turn every stage on
          engines: { paper: true, printer: true, damage: true, scanner: true },
        },
        seed: preset.seed,
      }))
    },

    // Re-roll ONE template in place: keep the chosen template selected and keep
    // its style-defining choices (prepress / colour / paper / printer type and
    // intensity), but generate a fresh VARIATION of its engine parameters around
    // the template's own base values. The look stays recognisably the same
    // template; only its dialled-in amounts and seed change. Fully undoable and
    // group-aware like applyPreset.
    randomizeTemplate: (id, presetId) => {
      const preset = PRESETS.find((p) => p.id === presetId)
      if (!preset) return
      patchActive(id, 'Randomize template', (l) => {
        const seed = Math.floor(Math.random() * 100000)
        const rng = makeRng(seed)
        return {
          effects: {
            ...clone(l.effects), // keep tint / edge colour
            // style identity of the template — never randomized
            intensity: preset.intensity, prepress: preset.prepress, colorMode: preset.colorMode,
            paperType: preset.paperType, printerType: preset.printerType,
            // a new variation of the template's parameters
            paper: varyFrom(PAPER_SCHEMA, preset.paper, rng),
            printer: varyFrom(PRINTER_SCHEMA, preset.printer, rng),
            damage: varyFrom(DAMAGE_SCHEMA, preset.damage, rng),
            scanner: varyFrom(SCANNER_SCHEMA, preset.scanner, rng),
            engines: { paper: true, printer: true, damage: true, scanner: true },
          },
          seed,
        }
      })
    },

    saveCurrentPreset: (id, name) => {
      const layer = get().layers[id]
      if (!layer) return
      const preset: SavedPreset = { id: newId(), name: name || `Custom ${get().savedPresets.length + 1}`, effects: clone(layer.effects), seed: layer.seed }
      const next = [...get().savedPresets, preset]
      localStorage.setItem('savedPresets', JSON.stringify(next))
      set({ savedPresets: next })
    },

    importPreset: (name, effects, seed) => {
      const preset: SavedPreset = { id: newId(), name, effects: clone(effects), seed }
      const next = [...get().savedPresets, preset]
      localStorage.setItem('savedPresets', JSON.stringify(next))
      set({ savedPresets: next })
    },

    applySavedPreset: (id, presetId) => {
      const preset = get().savedPresets.find((p) => p.id === presetId)
      if (!preset) return
      patchActive(id, 'Apply saved preset', () => ({ effects: clone(preset.effects), seed: preset.seed }))
    },

    renamePreset: (presetId, name) => {
      const next = get().savedPresets.map((p) => (p.id === presetId ? { ...p, name } : p))
      localStorage.setItem('savedPresets', JSON.stringify(next))
      set({ savedPresets: next })
    },

    deletePreset: (presetId) => {
      const next = get().savedPresets.filter((p) => p.id !== presetId)
      localStorage.setItem('savedPresets', JSON.stringify(next))
      set({ savedPresets: next })
    },

    randomize: (id) => {
      // Each target gets its own independent random look (own seed) so group
      // members don't come out identical.
      patchActive(id, 'Randomize', (l) => {
        const seed = Math.floor(Math.random() * 100000)
        const rng = makeRng(seed)
        return {
          effects: {
            ...clone(l.effects),
            paper: randomizeFrom(PAPER_SCHEMA, rng),
            printer: randomizeFrom(PRINTER_SCHEMA, rng),
            damage: randomizeFrom(DAMAGE_SCHEMA, rng),
            scanner: randomizeFrom(SCANNER_SCHEMA, rng),
            engines: { paper: true, printer: true, damage: true, scanner: true },
          },
          seed,
        }
      })
    },

    toggleVisible: (id) => {
      const l = get().layers[id]
      dispatch(patchLayer(id, 'Visibility', { visible: l.visible }, { visible: !l.visible }))
    },

    toggleLocked: (id) => {
      const l = get().layers[id]
      dispatch(patchLayer(id, 'Lock', { locked: l.locked }, { locked: !l.locked }))
    },

    renameLayer: (id, name) => {
      const l = get().layers[id]
      if (!l) return
      const next = name.trim() || l.name
      if (next === l.name) return
      dispatch(patchLayer(id, 'Rename', { name: l.name }, { name: next }))
    },

    // Groups are organisational only (left panel) — they never touch the render
    // pipeline, so they live outside the undo history like `collapsed`.
    createGroup: () => {
      const g: LayerGroup = { id: newId(), name: `Group ${get().groups.length + 1}`, collapsed: false }
      set((s) => ({ groups: [...s.groups, g] }))
    },
    renameGroup: (gid, name) => {
      set((s) => ({ groups: s.groups.map((g) => (g.id === gid ? { ...g, name } : g)) }))
    },
    deleteGroup: (gid) => {
      set((s) => {
        const layerGroups = { ...s.layerGroups }
        for (const k of Object.keys(layerGroups)) if (layerGroups[k] === gid) delete layerGroups[k]
        return {
          groups: s.groups.filter((g) => g.id !== gid),
          layerGroups,
          activeGroupId: s.activeGroupId === gid ? null : s.activeGroupId,
        }
      })
    },
    toggleGroupCollapsed: (gid) => {
      set((s) => ({ groups: s.groups.map((g) => (g.id === gid ? { ...g, collapsed: !g.collapsed } : g)) }))
    },
    setLayerGroup: (id, gid) => {
      set((s) => {
        const layerGroups = { ...s.layerGroups }
        if (gid) layerGroups[id] = gid
        else delete layerGroups[id]
        return { layerGroups }
      })
    },
    setGroupVisible: (gid, visible) => {
      set((s) => {
        const layers = { ...s.layers }
        const bakeToken = { ...s.bakeToken }
        for (const id of Object.keys(s.layerGroups)) {
          if (s.layerGroups[id] === gid && layers[id]) {
            layers[id] = { ...layers[id], visible }
            bakeToken[id] = (bakeToken[id] ?? 0) + 1
          }
        }
        return { layers, bakeToken }
      })
    },

    // Delete as a reversible command: keeps bitmaps alive for undo.
    removeLayer: (id) => {
      // The canvas itself is a Layer for rendering convenience, but it isn't
      // a layer the person created — it's the document. Deleting it would
      // leave the project with no base to draw on, so it's a no-op here
      // rather than something reachable through undo/redo history.
      if (get().layers[id]?.isCanvas) return
      const before = clone(get().layers[id])
      const index = get().layerOrder.indexOf(id)
      const wasActive = get().activeLayerId === id
      const cmd: Command = {
        label: 'Delete layer',
        execute() {
          set((s) => {
            const layers = { ...s.layers }; delete layers[id]
            return { layers, layerOrder: s.layerOrder.filter((x) => x !== id), activeLayerId: wasActive ? null : s.activeLayerId }
          })
        },
        undo() {
          set((s) => {
            const order = [...s.layerOrder]
            order.splice(Math.min(index, order.length), 0, id)
            return { layers: { ...s.layers, [id]: clone(before) }, layerOrder: order, activeLayerId: id, bakeToken: { ...s.bakeToken, [id]: (s.bakeToken[id] ?? 0) + 1 } }
          })
        },
        redo() { this.execute() },
      }
      dispatch(cmd)
    },

    // Flatten several layers into one new layer, on top, without touching
    // the originals. Composites each source layer's current baked pixels
    // (falling back to its raw source if it was never rendered, e.g. it was
    // hidden) at its own transform, in stacking order, onto a document-sized
    // canvas — the same math cropLayerToCanvas uses to "burn in" a transform.
    mergeLayers: (ids) => {
      const s = get()
      const doc = s.doc
      if (!doc) return
      // Keep only real, currently visible layers, in bottom->top stacking
      // order — invisible ones are skipped since they contribute nothing to
      // what's actually seen, matching what the person expects to happen.
      const targets = s.layerOrder.filter((lid) => ids.includes(lid) && s.layers[lid]?.visible)
      if (targets.length < 2) return

      const docW = Math.max(1, Math.round(doc.width))
      const docH = Math.max(1, Math.round(doc.height))
      const canvas = document.createElement('canvas')
      canvas.width = docW
      canvas.height = docH
      const ctx = canvas.getContext('2d')!
      ctx.imageSmoothingEnabled = true
      for (const lid of targets) {
        const l = s.layers[lid]
        const baked = getLayerBakedCanvas(lid) ?? sourceBitmaps.get(lid)
        if (!baked) continue
        const t = l.transform
        ctx.save()
        ctx.translate(t.x, t.y)
        ctx.rotate((t.rotation * Math.PI) / 180)
        ctx.scale(t.scaleX, t.scaleY)
        ctx.drawImage(baked, 0, 0, l.width, l.height)
        ctx.restore()
      }

      const newId_ = newId()
      const topIndex = Math.max(...targets.map((lid) => s.layerOrder.indexOf(lid)))
      const insertAt = topIndex + 1
      const layer: Layer = {
        id: newId_, name: `Merged ${++counter}`, kind: 'blank', visible: true, locked: false,
        width: docW, height: docH,
        transform: { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 },
        effects: freshEffects(), seed: Math.floor(Math.random() * 100000),
        edgeStyle: 'torn',
      }
      const prevActive = s.activeLayerId

      const cmd: Command = {
        label: 'Merge layers',
        execute() {
          originalBitmaps.set(newId_, canvas)
          sourceBitmaps.set(newId_, canvas)
          set((s2) => {
            const order = [...s2.layerOrder]
            order.splice(Math.min(insertAt, order.length), 0, newId_)
            return {
              layers: { ...s2.layers, [newId_]: clone(layer) },
              layerOrder: order,
              activeLayerId: newId_,
              bakeToken: { ...s2.bakeToken, [newId_]: (s2.bakeToken[newId_] ?? 0) + 1 },
            }
          })
        },
        undo() {
          originalBitmaps.delete(newId_)
          sourceBitmaps.delete(newId_)
          sheetOps.delete(newId_)
          set((s2) => {
            const layers = { ...s2.layers }; delete layers[newId_]
            return {
              layers,
              layerOrder: s2.layerOrder.filter((x) => x !== newId_),
              activeLayerId: prevActive,
            }
          })
        },
        redo() { this.execute() },
      }
      dispatch(cmd)
    },

    toggleCollapsed: (key) => {
      const next = { ...get().collapsed, [key]: !get().collapsed[key] }
      localStorage.setItem('collapsed', JSON.stringify(next))
      set({ collapsed: next })
    },
    setHelp: (key) => set({ helpKey: key }),

    // Record one physical workshop stroke as a reversible op. execute() appends
    // it to the layer's ordered op list; undo() pops it. The renderer replays
    // the whole list from the printed base, so order is preserved losslessly.
    addSheetOp: (layerId, op) => {
      get().addSheetOps([{ layerId, op }])
    },

    addSheetOps: (entries) => {
      if (entries.length === 0) return
      const cmd: Command = {
        label: `Workshop: ${entries[0].op.tool}`,
        execute() {
          for (const entry of entries) {
            const arr = sheetOps.get(entry.layerId) ?? []
            arr.push(entry.op)
            sheetOps.set(entry.layerId, arr)
            bump(entry.layerId)
          }
        },
        undo() {
          for (let i = entries.length - 1; i >= 0; i--) {
            const entry = entries[i]
            const arr = sheetOps.get(entry.layerId)
            if (arr && arr.length) { arr.pop(); sheetOps.set(entry.layerId, arr) }
            bump(entry.layerId)
          }
        },
        redo() { this.execute() },
      }
      dispatch(cmd)
    },

    // Applied-ops stack — Photoshop-style: an already-committed tool op stays
    // fully configured and can be switched off or re-tuned at any time. The
    // op array itself is the single source of truth (see effectiveOps in
    // engine/tools/registry.ts, applied at every bake/export site); toggling
    // or editing here just swaps the stored array and bumps bakeToken so the
    // incremental cache replays it from the material baseline.
    toggleSheetOp: (layerId, index) => {
      const before = sheetOps.get(layerId)
      if (!before || !before[index]) return
      const beforeArr = before.slice()
      const after = before.slice()
      after[index] = { ...after[index], enabled: after[index].enabled === false }
      const cmd: Command = {
        label: `Toggle: ${before[index].tool}`,
        execute() { sheetOps.set(layerId, after); bump(layerId) },
        undo() { sheetOps.set(layerId, beforeArr); bump(layerId) },
        redo() { this.execute() },
      }
      dispatch(cmd)
    },

    updateSheetOpParameters: (layerId, index, patch) => {
      const before = sheetOps.get(layerId)
      if (!before || !before[index]) return
      const beforeArr = before.slice()
      const after = before.slice()
      after[index] = { ...after[index], parameters: { ...after[index].parameters, ...patch } }
      const cmd: Command = {
        label: `Adjust: ${before[index].tool}`,
        execute() { sheetOps.set(layerId, after); bump(layerId) },
        undo() { sheetOps.set(layerId, beforeArr); bump(layerId) },
        redo() { this.execute() },
      }
      dispatch(cmd)
    },

    removeSheetOp: (layerId, index) => {
      const before = sheetOps.get(layerId)
      if (!before || !before[index]) return
      const beforeArr = before.slice()
      const after = before.slice()
      after.splice(index, 1)
      const cmd: Command = {
        label: `Remove: ${before[index].tool}`,
        execute() { sheetOps.set(layerId, after); bump(layerId) },
        undo() { sheetOps.set(layerId, beforeArr); bump(layerId) },
        redo() { this.execute() },
      }
      dispatch(cmd)
    },

    undo: () => { set((s) => ({ history: histUndo(s.history) })); syncFlags() },
    redo: () => { set((s) => ({ history: histRedo(s.history) })); syncFlags() },
    jumpHistory: (appliedCount) => {
      let history = get().history
      const target = Math.max(0, Math.min(appliedCount, history.past.length + history.future.length))
      while (history.past.length > target) history = histUndo(history)
      while (history.past.length < target && history.future.length > 0) history = histRedo(history)
      set({ history })
      syncFlags()
    },

    bump,
  }
})

// hydrate saved presets
try {
  const raw = localStorage.getItem('savedPresets')
  if (raw) {
    const parsed: SavedPreset[] = JSON.parse(raw)
    // Backfill engine toggles for presets saved before the field existed.
    for (const p of parsed) {
      if (p.effects && !p.effects.engines) p.effects.engines = { paper: true, printer: true, damage: true, scanner: true }
      if (p.effects && !p.effects.prepress) p.effects.prepress = 'fullColor'
      if (p.effects && !p.effects.scannerMode) p.effects.scannerMode = 'home'
      if (p.effects && !p.effects.paperColor) p.effects.paperColor = '#ffffff'
      if (p.effects) p.effects.final = normalizeFinal(p.effects.final)
    }
    useStore.setState({ savedPresets: parsed })
  }
} catch { /* ignore */ }

if (typeof window !== 'undefined') (window as unknown as { __store: typeof useStore }).__store = useStore

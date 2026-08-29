// Full project save / load.
//
// A project file is a self-contained JSON document that captures EVERYTHING
// needed to reopen the editor in exactly the state it was left in — the canvas,
// every layer and group, masks, the ordered workshop operations, the print /
// scan / final settings, all tool parameters, the viewport, the UI selection,
// the language and the complete undo/redo history.
//
// Pixel data (a layer's original + working bitmaps and each cut edge's
// source/mask) is stored losslessly as PNG data URLs. Identical bitmaps are
// stored once and referenced by key, so the file never duplicates pixels.
//
// History is preserved by walking the existing, already-reversible command
// stack at save time and snapshotting the full state at every position. On load
// those positions are replayed as plain state swaps, so undo / redo / history
// jumps keep working across a save/load with no recomputation.

import type {
  DocumentMeta, EdgeStyle, Layer, LayerGroup, SheetOp, ToolId, CutMode,
  Command, PhysicalToolId, ToolParameterValues,
} from '@/domain/types'
import type { Lang } from '@/i18n'
import type { CropBounds } from '@/engine/cut'
import { useStore, originalBitmaps, sourceBitmaps, cutInfo, sheetOps } from '@/state/store'
import { useUi } from '@/state/ui'
import { useI18n } from '@/i18n'
import { triggerDownload } from '@/shared/zip'

const FORMAT = 'nevma-project'
const VERSION = 1

type Bitmap = HTMLCanvasElement | HTMLImageElement

interface CutInfoData {
  sourceKey: string
  maskKey: string
  width: number
  height: number
  invert: boolean
  style: EdgeStyle
  seed: number
  crop?: CropBounds
}

interface Snapshot {
  layerOrder: string[]
  layers: Record<string, Layer>
  activeLayerId: string | null
  activeGroupId: string | null
  originals: Record<string, string> // layerId -> bitmap key
  sources: Record<string, string>   // layerId -> bitmap key
  cutInfo: Record<string, CutInfoData>
  sheetOps: Record<string, string[]> // layerId -> op keys
}

interface ProjectFile {
  format: typeof FORMAT
  version: number
  savedAt: string
  doc: DocumentMeta | null
  settings: {
    activeTool: ToolId
    cutMode: CutMode
    edgeStyle: EdgeStyle
    lockAspect: boolean
    viewport: { x: number; y: number; scale: number }
    groups: LayerGroup[]
    layerGroups: Record<string, string>
    savedPresets: unknown[]
    collapsed: Record<string, boolean>
  }
  ui: {
    topStage: string
    workshopTool: string
    toolParameters: Record<PhysicalToolId, ToolParameterValues>
  }
  lang: Lang
  images: Record<string, string> // key -> PNG data URL
  ops: Record<string, SheetOp>   // key -> op
  history: {
    labels: string[]
    position: number
    snapshots: Snapshot[]
  }
}

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v))

// ---------------------------------------------------------------------------
// Bitmap <-> PNG data URL
// ---------------------------------------------------------------------------

function bitmapToCanvas(bmp: Bitmap): HTMLCanvasElement {
  if (bmp instanceof HTMLCanvasElement) return bmp
  const w = 'naturalWidth' in bmp ? bmp.naturalWidth : (bmp as HTMLImageElement).width
  const h = 'naturalHeight' in bmp ? bmp.naturalHeight : (bmp as HTMLImageElement).height
  const c = document.createElement('canvas')
  c.width = Math.max(1, w)
  c.height = Math.max(1, h)
  c.getContext('2d')!.drawImage(bmp, 0, 0)
  return c
}

function bitmapToDataURL(bmp: Bitmap): string {
  return bitmapToCanvas(bmp).toDataURL('image/png')
}

function dataURLToCanvas(url: string): Promise<HTMLCanvasElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const c = document.createElement('canvas')
      c.width = img.naturalWidth
      c.height = img.naturalHeight
      c.getContext('2d')!.drawImage(img, 0, 0)
      resolve(c)
    }
    img.onerror = () => reject(new Error('Failed to decode project bitmap'))
    img.src = url
  })
}

// ---------------------------------------------------------------------------
// Save
// ---------------------------------------------------------------------------

export function serializeProject(): ProjectFile {
  const images: Record<string, string> = {}
  const bmpKeys = new Map<Bitmap, string>()
  let bmpN = 0
  const keyForBitmap = (bmp: Bitmap): string => {
    const existing = bmpKeys.get(bmp)
    if (existing) return existing
    const key = `b${bmpN++}`
    bmpKeys.set(bmp, key)
    images[key] = bitmapToDataURL(bmp)
    return key
  }

  const ops: Record<string, SheetOp> = {}
  const opKeys = new Map<SheetOp, string>()
  let opN = 0
  const keyForOp = (op: SheetOp): string => {
    const existing = opKeys.get(op)
    if (existing) return existing
    const key = `o${opN++}`
    opKeys.set(op, key)
    ops[key] = clone(op)
    return key
  }

  const snapshotNow = (): Snapshot => {
    const s = useStore.getState()
    const originals: Record<string, string> = {}
    const sources: Record<string, string> = {}
    const cuts: Record<string, CutInfoData> = {}
    const opsRefs: Record<string, string[]> = {}
    for (const id of s.layerOrder) {
      const orig = originalBitmaps.get(id)
      if (orig) originals[id] = keyForBitmap(orig)
      const src = sourceBitmaps.get(id)
      if (src) sources[id] = keyForBitmap(src)
      const ci = cutInfo.get(id)
      if (ci) {
        cuts[id] = {
          sourceKey: keyForBitmap(ci.source),
          maskKey: keyForBitmap(ci.mask),
          width: ci.width, height: ci.height, invert: ci.invert,
          style: ci.style, seed: ci.seed, crop: ci.crop,
        }
      }
      const list = sheetOps.get(id)
      if (list && list.length) opsRefs[id] = list.map(keyForOp)
    }
    return {
      layerOrder: [...s.layerOrder],
      layers: clone(s.layers),
      activeLayerId: s.activeLayerId,
      activeGroupId: s.activeGroupId,
      originals, sources, cutInfo: cuts, sheetOps: opsRefs,
    }
  }

  // Walk the full command stack, snapshotting every history position. The store
  // commands are reversible, so this is a lossless traversal that we rewind at
  // the end back to where the user actually is.
  const start = useStore.getState()
  const startPos = start.history.past.length
  const total = start.history.past.length + start.history.future.length
  const labels = [...start.history.past, ...start.history.future].map((c) => c.label)

  while (useStore.getState().history.past.length > 0) useStore.getState().undo()
  const snapshots: Snapshot[] = [snapshotNow()]
  for (let i = 0; i < total; i++) {
    useStore.getState().redo()
    snapshots.push(snapshotNow())
  }
  // rewind to the user's original position
  while (useStore.getState().history.past.length > startPos) useStore.getState().undo()

  const ui = useUi.getState()
  return {
    format: FORMAT,
    version: VERSION,
    savedAt: new Date().toISOString(),
    doc: start.doc,
    settings: {
      activeTool: start.activeTool,
      cutMode: start.cutMode,
      edgeStyle: start.edgeStyle,
      lockAspect: start.lockAspect,
      viewport: { ...start.viewport },
      groups: clone(start.groups),
      layerGroups: clone(start.layerGroups),
      savedPresets: clone(start.savedPresets),
      collapsed: clone(start.collapsed),
    },
    ui: {
      topStage: ui.topStage,
      workshopTool: ui.workshopTool,
      toolParameters: clone(ui.toolParameters),
    },
    lang: useI18n.getState().lang,
    images,
    ops,
    history: { labels, position: startPos, snapshots },
  }
}

export function saveProject(): void {
  const project = serializeProject()
  const name = (project.doc?.name || 'project').replace(/[^\w.-]+/g, '_')
  const blob = new Blob([JSON.stringify(project)], { type: 'application/json' })
  triggerDownload(blob, `${name}.nevma`)
}

// ---------------------------------------------------------------------------
// Load
// ---------------------------------------------------------------------------

export async function loadProjectFromText(text: string): Promise<void> {
  const data = JSON.parse(text) as ProjectFile
  if (data.format !== FORMAT) throw new Error('Not a Nevma project file')

  // Decode every unique bitmap once.
  const registry = new Map<string, HTMLCanvasElement>()
  await Promise.all(
    Object.entries(data.images).map(async ([key, url]) => {
      registry.set(key, await dataURLToCanvas(url))
    }),
  )

  const applySnapshot = (snap: Snapshot) => {
    originalBitmaps.clear()
    sourceBitmaps.clear()
    cutInfo.clear()
    sheetOps.clear()
    for (const id of snap.layerOrder) {
      const ok = snap.originals[id]
      if (ok && registry.has(ok)) originalBitmaps.set(id, registry.get(ok)!)
      const sk = snap.sources[id]
      if (sk && registry.has(sk)) sourceBitmaps.set(id, registry.get(sk)!)
      const ci = snap.cutInfo[id]
      if (ci && registry.has(ci.sourceKey) && registry.has(ci.maskKey)) {
        cutInfo.set(id, {
          source: registry.get(ci.sourceKey)!,
          mask: registry.get(ci.maskKey)!,
          width: ci.width, height: ci.height, invert: ci.invert,
          style: ci.style, seed: ci.seed, crop: ci.crop,
        })
      }
      const opKeys = snap.sheetOps[id]
      if (opKeys && opKeys.length) sheetOps.set(id, opKeys.map((k) => clone(data.ops[k])))
    }
    const prev = useStore.getState().bakeToken
    const bakeToken: Record<string, number> = {}
    for (const id of snap.layerOrder) bakeToken[id] = (prev[id] ?? 0) + 1
    useStore.setState({
      layers: clone(snap.layers),
      layerOrder: [...snap.layerOrder],
      activeLayerId: snap.activeLayerId,
      activeGroupId: snap.activeGroupId,
      bakeToken,
    })
  }

  // Rebuild the history as state-swap commands between adjacent snapshots.
  const snaps = data.history.snapshots
  const commands: Command[] = []
  for (let i = 1; i < snaps.length; i++) {
    const after = snaps[i]
    const before = snaps[i - 1]
    const label = data.history.labels[i - 1] ?? 'Step'
    commands.push({
      label,
      execute() { applySnapshot(after) },
      undo() { applySnapshot(before) },
      redo() { applySnapshot(after) },
    })
  }
  const pos = Math.max(0, Math.min(data.history.position, commands.length))
  const past = commands.slice(0, pos)
  const future = commands.slice(pos)

  // Restore language + UI first (no history impact), then scalar settings.
  useI18n.getState().setLang(data.lang)
  useUi.setState({
    topStage: data.ui.topStage as ReturnType<typeof useUi.getState>['topStage'],
    workshopTool: data.ui.workshopTool as ReturnType<typeof useUi.getState>['workshopTool'],
    toolParameters: clone(data.ui.toolParameters),
  })
  useStore.setState({
    doc: data.doc,
    activeTool: data.settings.activeTool,
    cutMode: data.settings.cutMode,
    edgeStyle: data.settings.edgeStyle,
    lockAspect: data.settings.lockAspect,
    viewport: { ...data.settings.viewport },
    groups: clone(data.settings.groups),
    layerGroups: clone(data.settings.layerGroups),
    savedPresets: clone(data.settings.savedPresets) as ReturnType<typeof useStore.getState>['savedPresets'],
    collapsed: clone(data.settings.collapsed),
  })

  // Materialize the exact position the user saved at.
  applySnapshot(snaps[pos])
  useStore.setState({
    history: { past, future },
    canUndo: past.length > 0,
    canRedo: future.length > 0,
  })
}

export async function loadProjectFromFile(file: File): Promise<void> {
  const text = await file.text()
  await loadProjectFromText(text)
}

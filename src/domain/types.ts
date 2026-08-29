// Pure domain types. No React, no WebGL.

import type {
  PaperParams, PrinterParams, DamageParams, ScannerParams, PaperType, PrinterType,
} from './params'

export interface Transform {
  x: number
  y: number
  scaleX: number
  scaleY: number
  rotation: number // degrees
}

export type EdgeStyle = 'scissors' | 'torn' | 'worn'

/** Cut tool sub-mode: freeform lasso or Bezier pen. */
export type CutMode = 'lasso' | 'pen'

/** Physical engines that can be independently switched on/off per layer. */
export type EngineId = 'paper' | 'printer' | 'damage' | 'scanner'

/** How a layer's colour is presented. */
export type ColorMode = 'color' | 'bw' | 'tint'

/** Prepress colour preparation applied BEFORE the print simulation. */
export type PrepressMode = 'fullColor' | 'cmykOffset' | 'grayscale' | 'blackInk' | 'newspaper' | 'risograph'

/** How the printed sheet is captured. 'none' = no scanner pass at all. */
export type ScannerMode = 'none' | 'home' | 'pro' | 'phone'

/** On/off switch for every physical engine. Disabled = fully skipped in the pipeline. */
export interface EngineToggles {
  paper: boolean
  printer: boolean
  damage: boolean
  scanner: boolean
}

/**
 * Stored state of ONE Final-stage adjustment layer on a given image layer:
 * whether it is switched on, plus the current value of each of its controls.
 * The adjustment behaviour itself lives in engine/final; this is only data.
 */
export interface FinalAdjustmentValues {
  enabled: boolean
  values: Record<string, number>
}

/** All Final adjustment layers of an image layer, keyed by adjustment id. */
export type FinalParams = Record<string, FinalAdjustmentValues>

export interface LayerEffects {
  intensity: number // master 0..1: how strongly the physical layer shows
  prepress: PrepressMode // colour preparation before the print simulation
  colorMode: ColorMode
  tint: string      // hex, used when colorMode === 'tint'
  edgeColor: string // hex, colour of the cut edge / paper interior
  paperColor: string // hex, base colour of the paper stock
  paperType: PaperType
  printerType: PrinterType
  scannerMode: ScannerMode
  paper: PaperParams
  printer: PrinterParams
  damage: DamageParams
  scanner: ScannerParams
  engines: EngineToggles // per-engine master on/off
  final: FinalParams // independent final-stage correction layers
}

/**
 * Every station in the Workshop. The Workshop tools no longer push global
 * "filter" sliders — each is a real, ordered, destructive physical operation
 * applied to the current pixel state of the sheet (see engine/sheet).
 */
export type WorkshopToolId =
  | 'move' | 'cut' | 'pen' | 'sandpaper' | 'water' | 'knife'
  | 'scratches' | 'marker' | 'pencil' | 'brush' | 'tape' | 'glue'
  | 'patch' | 'burn' | 'pins' | 'dirt'

export type PhysicalToolId = Exclude<WorkshopToolId, 'move' | 'cut' | 'pen'>

export type ToolParameterValue = number | string | boolean
export type ToolParameterValues = Record<string, ToolParameterValue>

export interface ReferenceBinding {
  profileId: string
  revision: number
}

/**
 * A single recorded physical action on a layer's sheet. Ops are replayed in
 * order from the printed base, so their sequence changes the result:
 * print -> water -> sandpaper differs from print -> sandpaper -> water.
 */
export interface SheetOp {
  tool: PhysicalToolId
  points: number[]
  parameters: ToolParameterValues
  seed: number
  paperType: PaperType
  elapsedMs?: number
  reference?: ReferenceBinding
  /** Photoshop-style toggle: when false the op is skipped during replay but
   *  stays in the stack, fully configured, so it can be switched back on.
   *  Undefined counts as enabled (older/loaded projects predate this field). */
  enabled?: boolean
}

export type LayerKind = 'base' | 'fragment' | 'blank'

/** Canvas orientation for a new document. */
export type Orientation = 'landscape' | 'portrait'

/**
 * The project canvas ("document"). It defines the working resolution the tools,
 * export and final image are relative to — like a Photoshop document. Layers are
 * placed on top of it; it never touches the render pipeline of a single layer.
 */
export interface DocumentMeta {
  name: string
  width: number
  height: number
  background: 'white' | 'transparent'
}

/** A user-created organisational group for layers (left panel only). */
export interface LayerGroup {
  id: string
  name: string
  collapsed: boolean
}

export interface Layer {
  id: string
  name: string
  kind?: LayerKind
  /** True only for the single background layer created by createDocument —
   *  the document's canvas itself, rendered as a Layer for convenience. It
   *  always stays at the bottom of the stack: never draggable, never
   *  deletable (see LayersPanel + store.ts's removeLayer/reorderLayers).
   *  Any other layer (including later 'base'-kind image layers added via
   *  addImageLayer) is a normal, fully manipulable layer. */
  isCanvas?: boolean
  visible: boolean
  locked: boolean
  width: number
  height: number
  transform: Transform
  effects: LayerEffects
  seed: number
  edgeStyle: EdgeStyle
}

/** A reversible action. execute() applies it; undo() reverts; redo() re-applies. */
export interface Command {
  label: string
  execute(): void
  undo(): void
  redo(): void
  /** When set, a command pushed shortly after another command with the same
   *  key (see history.ts's COALESCE_WINDOW_MS) is merged into that command's
   *  undo step instead of becoming its own entry. This keeps a continuous
   *  slider drag — which fires one onChange, and one command, per tick — as
   *  a single undo step instead of dozens. */
  coalesceKey?: string
}

export type ToolId = 'select' | 'pan' | 'zoom' | 'lasso' | 'brush'

export interface Viewport {
  x: number
  y: number
  scale: number
}

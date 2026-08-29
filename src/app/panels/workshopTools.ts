import type { TKey } from '@/i18n/dict'
import type { ToolId, CutMode, WorkshopToolId } from '@/domain/types'

export type { WorkshopToolId }

export interface WorkshopTool {
  id: WorkshopToolId
  labelKey: TKey
  descKey: TKey
  icon: string
  /** When set, selecting the tool also switches the canvas interaction. */
  canvasTool?: ToolId
  cutMode?: CutMode
  /** false = station is present in the UI but has no processing engine yet. */
  active: boolean
}

/**
 * The workshop tool that is genuinely active is derived from the real canvas
 * interaction (`activeTool`) — never from a second, independently-stored value.
 * This guarantees exactly one active tool at a time: when a pure navigation
 * tool (Hand/Zoom) is selected, no workshop tool is active, so the previous
 * one is fully disabled. Returns null when navigation owns the canvas.
 */
export function activeWorkshopToolId(
  activeTool: ToolId,
  cutMode: CutMode,
  workshopTool: WorkshopToolId,
): WorkshopToolId | null {
  switch (activeTool) {
    case 'select': return 'move'
    case 'lasso': return cutMode === 'pen' ? 'pen' : 'cut'
    case 'brush': return workshopTool
    default: return null // pan / zoom: navigation only
  }
}

export const WORKSHOP_TOOLS: WorkshopTool[] = [
  { id: 'move', labelKey: 'twMove', descKey: 'twMoveDesc', icon: '↖', canvasTool: 'select', active: true },
  { id: 'cut', labelKey: 'twCut', descKey: 'twCutDesc', icon: '✂', canvasTool: 'lasso', cutMode: 'lasso', active: true },
  { id: 'pen', labelKey: 'twPen', descKey: 'twPenDesc', icon: '✒', canvasTool: 'lasso', cutMode: 'pen', active: true },
  { id: 'sandpaper', labelKey: 'twSandpaper', descKey: 'twSandpaperDesc', icon: '🪵', canvasTool: 'brush', active: true },
  { id: 'water', labelKey: 'twWater', descKey: 'twWaterDesc', icon: '💧', canvasTool: 'brush', active: true },
  { id: 'knife', labelKey: 'twKnife', descKey: 'twKnifeDesc', icon: '🔪', canvasTool: 'brush', active: true },
  { id: 'scratches', labelKey: 'twScratches', descKey: 'twScratchesDesc', icon: '➰', canvasTool: 'brush', active: true },
  { id: 'marker', labelKey: 'twMarker', descKey: 'twMarkerDesc', icon: '🖊', canvasTool: 'brush', active: true },
  { id: 'pencil', labelKey: 'twPencil', descKey: 'twPencilDesc', icon: '✏', canvasTool: 'brush', active: true },
  { id: 'brush', labelKey: 'twBrush', descKey: 'twBrushDesc', icon: '🖌', canvasTool: 'brush', active: true },
  { id: 'tape', labelKey: 'twTape', descKey: 'twTapeDesc', icon: '🧵', canvasTool: 'brush', active: true },
  { id: 'glue', labelKey: 'twGlue', descKey: 'twGlueDesc', icon: '🧴', canvasTool: 'brush', active: true },
  { id: 'patch', labelKey: 'twPatch', descKey: 'twPatchDesc', icon: '🩹', canvasTool: 'brush', active: true },
  { id: 'burn', labelKey: 'twBurn', descKey: 'twBurnDesc', icon: '🔥', canvasTool: 'brush', active: true },
  { id: 'pins', labelKey: 'twPins', descKey: 'twPinsDesc', icon: '📌', canvasTool: 'brush', active: true },
  { id: 'dirt', labelKey: 'twDirt', descKey: 'twDirtDesc', icon: '🌫', canvasTool: 'brush', active: true },
]

import { create } from 'zustand'
import type { WorkshopToolId } from '@/app/panels/workshopTools'
import type { PhysicalToolId, ToolParameterValue, ToolParameterValues } from '@/domain/types'
import { createDefaultToolParameters } from '@/engine/tools/registry'
import { useStore } from './store'

/** Top-menu workflow stages. Purely a UI filter for the panels — it does
 *  not affect the render pipeline or any layer effect. */
export type TopStage = 'upload' | 'print' | 'workshop' | 'scan' | 'final'

const INTRO_STAGES: TopStage[] = ['upload', 'print', 'workshop', 'scan', 'final']

/** Per-stage "seen the intro card" flags, persisted the same way the rest of
 *  the purely-UI state is (`collapsed`, `savedPresets`) — a plain localStorage
 *  key per flag, so each stage can be reset independently if ever needed. */
function loadIntroSeen(): Record<TopStage, boolean> {
  const out = {} as Record<TopStage, boolean>
  for (const stage of INTRO_STAGES) {
    out[stage] = localStorage.getItem(`nevma_intro_${stage}_seen`) === '1'
  }
  return out
}

interface UiState {
  topStage: TopStage
  setTopStage: (s: TopStage) => void
  // Contextual "what is this stage" card shown once per stage on first visit.
  introSeen: Record<TopStage, boolean>
  markIntroSeen: (stage: TopStage) => void
  // "? Help" panel — lists all stages, shows the description of whichever is selected.
  helpOpen: boolean
  setHelpOpen: (v: boolean) => void
  // Ephemeral hold-to-preview flag for the "Original" button. When true the
  // viewport shows the pristine loaded source instead of the processed output.
  // Purely a display switch — never touches history, layers, tools or ops.
  showOriginal: boolean
  setShowOriginal: (v: boolean) => void
  workshopTool: WorkshopToolId
  setWorkshopTool: (t: WorkshopToolId) => void
  toolParameters: Record<PhysicalToolId, ToolParameterValues>
  setToolParameter: (tool: PhysicalToolId, key: string, value: ToolParameterValue) => void
  // Whether the "New project" dialog is open. Purely UI.
  newProjectOpen: boolean
  setNewProjectOpen: (v: boolean) => void
  // Photoshop-style smart guides: the canvas-space x/y of the center/edge
  // line currently being snapped to while dragging a layer, or null. Purely
  // a rendering hint for the Viewport overlay — never touches history.
  dragGuides: { x: number | null; y: number | null }
  setDragGuides: (g: { x: number | null; y: number | null }) => void
}

export const useUi = create<UiState>((set) => ({
  topStage: 'upload',
  setTopStage: (topStage) => set((s) => {
    // Leaving the workshop: put whatever physical tool was in hand back
    // down. Otherwise the canvas tool stays "armed" in Print/Scan/etc — the
    // person picked up a pencil/knife in the workshop, wandered off to
    // another stage, and it's still live, ready to draw on the next click.
    if (s.topStage === 'workshop' && topStage !== 'workshop') {
      useStore.getState().setTool('select')
      return { topStage, workshopTool: 'move' }
    }
    return { topStage }
  }),
  introSeen: loadIntroSeen(),
  markIntroSeen: (stage) => {
    localStorage.setItem(`nevma_intro_${stage}_seen`, '1')
    set((s) => ({ introSeen: { ...s.introSeen, [stage]: true } }))
  },
  helpOpen: false,
  setHelpOpen: (helpOpen) => set({ helpOpen }),
  showOriginal: false,
  setShowOriginal: (showOriginal) => set({ showOriginal }),
  workshopTool: 'move',
  setWorkshopTool: (workshopTool) => set({ workshopTool }),
  toolParameters: createDefaultToolParameters(),
  setToolParameter: (tool, key, value) => set((s) => ({
    toolParameters: {
      ...s.toolParameters,
      [tool]: { ...s.toolParameters[tool], [key]: value },
    },
  })),
  newProjectOpen: false,
  setNewProjectOpen: (newProjectOpen) => set({ newProjectOpen }),
  dragGuides: { x: null, y: null },
  setDragGuides: (dragGuides) => set({ dragGuides }),
}))

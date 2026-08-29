import { useEffect } from 'react'
import { WinTitleBar } from '@/app/panels/WinTitleBar'
import { TopBar } from '@/app/panels/TopBar'
import { NewProjectModal } from '@/app/panels/NewProjectModal'
import { StageIntro } from '@/app/panels/StageIntro'
import { LayersPanel } from '@/app/panels/LayersPanel'
import { ToolsPanel } from '@/app/panels/ToolsPanel'
import { ToolRail } from '@/app/panels/ToolRail'
import { RightPanel } from '@/app/panels/RightPanel'
import { HistoryDrawer } from '@/app/panels/HistoryDrawer'
import { Viewport } from '@/app/Viewport'
import { useStore } from '@/state/store'
import { useUi } from '@/state/ui'

/** The editor workspace — everything that used to be the whole app. Kept
 *  free of community/account UI on purpose: this screen is the tool, not
 *  the social layer around it. */
export function Editor() {
  const topStage = useUi((s) => s.topStage)

  // Global navigation and history shortcuts work independently of the stage.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      const tag = target?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || target?.isContentEditable) return
      const mod = e.ctrlKey || e.metaKey
      // e.code identifies the physical key regardless of the active keyboard
      // layout (Cyrillic, etc.) — e.key returns the mapped character, which
      // is why these silently did nothing under a non-Latin layout.
      if (mod && e.code === 'KeyZ') {
        e.preventDefault()
        if (e.shiftKey) useStore.getState().redo()
        else useStore.getState().undo()
      } else if (mod && e.code === 'KeyY') {
        e.preventDefault()
        useStore.getState().redo()
      } else if (!mod && !e.altKey && e.shiftKey && e.code === 'KeyZ') {
        // Shift+Z (no Ctrl) — redo, mirrors Ctrl+Shift+Z.
        e.preventDefault()
        useStore.getState().redo()
      } else if (!mod && !e.altKey && e.shiftKey) {
        if (e.code === 'KeyH' || e.code === 'KeyV') {
          e.preventDefault()
          useUi.getState().setWorkshopTool('move')
          useStore.getState().setTool(e.code === 'KeyH' ? 'pan' : 'select')
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div className="app">
      <NewProjectModal />
      <StageIntro />
      <WinTitleBar />
      <TopBar />
      <div className="global-tool-rail"><ToolRail /></div>
      <div className="col-left">
        <div className={`left-stack ${topStage === 'workshop' ? 'with-workshop' : ''}`}>
          {topStage === 'workshop' && <div className="workshop-pane"><ToolsPanel /></div>}
          <div className="layers-pane"><LayersPanel /></div>
        </div>
      </div>
      <div className="stage-wrap"><Viewport /></div>
      <div className="col-right"><RightPanel /></div>
      <HistoryDrawer />
    </div>
  )
}

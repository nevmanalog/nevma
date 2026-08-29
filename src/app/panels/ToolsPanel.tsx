import { useStore } from '@/state/store'
import { useUi } from '@/state/ui'
import { useT } from '@/i18n'
import { WORKSHOP_TOOLS, activeWorkshopToolId, type WorkshopTool } from './workshopTools'

/** Workshop-only left panel: a vertical rack of tools. Selecting a tool
 *  drives the canvas interaction and the right-hand settings. */
export function ToolsPanel() {
  const workshopTool = useUi((s) => s.workshopTool)
  const setWorkshopTool = useUi((s) => s.setWorkshopTool)
  const setTool = useStore((s) => s.setTool)
  const setCutMode = useStore((s) => s.setCutMode)
  const activeTool = useStore((s) => s.activeTool)
  const cutMode = useStore((s) => s.cutMode)
  const t = useT()

  // The highlighted tool is derived from the real canvas interaction, so it
  // stays in sync when navigation (Hand/Zoom) takes over and never lights up
  // two tools at once.
  const activeId = activeWorkshopToolId(activeTool, cutMode, workshopTool)

  const pick = (tool: WorkshopTool) => {
    setWorkshopTool(tool.id)
    if (tool.canvasTool) {
      setTool(tool.canvasTool)
      if (tool.cutMode) setCutMode(tool.cutMode)
    } else {
      // Non-canvas stations still let you position layers with the pointer.
      setTool('select')
    }
  }

  return (
    <div className="panel tools-panel">
      <div className="panel-head"><span className="panel-title">{t('toolsTitle')}</span></div>
      <div className="tool-list">
        {WORKSHOP_TOOLS.map((tool) => (
          <button
            key={tool.id}
            className={`tool-row ${activeId === tool.id ? 'active' : ''} ${tool.active ? '' : 'muted'}`}
            data-tip={t(tool.descKey)}
            onClick={() => pick(tool)}
          >
            <span className="tool-row-icon">{tool.icon}</span>
            <span className="tool-row-label">{t(tool.labelKey)}</span>
            {!tool.active && <span className="tool-soon" data-tip={t('comingSoon')}>•</span>}
          </button>
        ))}
      </div>
    </div>
  )
}

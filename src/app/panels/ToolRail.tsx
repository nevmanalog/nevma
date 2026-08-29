import { useStore } from '@/state/store'
import { useUi } from '@/state/ui'
import type { ToolId } from '@/domain/types'
import { useT } from '@/i18n'
import type { TKey } from '@/i18n/dict'

const TOOLS: { id: ToolId; icon: string; titleKey: TKey; shortcut: string }[] = [
  { id: 'pan', icon: '✋', titleKey: 'toolPan', shortcut: '⇧H' },
  { id: 'select', icon: '↖', titleKey: 'toolSelect', shortcut: '⇧V' },
  { id: 'zoom', icon: '⌕', titleKey: 'toolZoom', shortcut: '⇧Z' },
]

/** Permanent global navigation rail shared by every workflow stage. */
export function ToolRail() {
  const activeTool = useStore((s) => s.activeTool)
  const setTool = useStore((s) => s.setTool)
  const setWorkshopTool = useUi((s) => s.setWorkshopTool)
  const t = useT()

  return (
    <div className="global-tools" aria-label="navigation tools">
      {TOOLS.map((tool) => (
        <button
          key={tool.id}
          className={`global-tool ${activeTool === tool.id ? 'active' : ''}`}
          data-tip={`${t(tool.titleKey)} (${tool.shortcut})`}
          onClick={() => {
            setWorkshopTool('move')
            setTool(tool.id)
          }}
        >
          <span className="global-tool-icon">{tool.icon}</span>
          <span className="global-tool-key">{tool.shortcut}</span>
        </button>
      ))}
    </div>
  )
}

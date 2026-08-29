import { useState } from 'react'
import { useUi, type TopStage } from '@/state/ui'
import { useT } from '@/i18n'
import type { TKey } from '@/i18n/dict'
import { STAGE_INTRO } from './StageIntro'

const ORDER: TopStage[] = ['upload', 'print', 'workshop', 'scan', 'final']

const SHORTCUTS: { keys: string; labelKey: TKey }[] = [
  { keys: 'Ctrl / \u2318 + Z', labelKey: 'scUndo' },
  { keys: 'Ctrl / \u2318 + Shift + Z', labelKey: 'scRedo' },
  { keys: 'Shift + V', labelKey: 'scMoveTool' },
  { keys: 'Shift + H', labelKey: 'scPanTool' },
  { keys: 'Space + drag', labelKey: 'scPanHold' },
  { keys: 'Wheel', labelKey: 'scZoom' },
  { keys: 'Backspace / Delete', labelKey: 'scDeletePenPoint' },
  { keys: 'Shift + Click', labelKey: 'scShiftSelectLayers' },
]

/** "? Help" — a small on-demand panel with the same per-stage explanations
 *  as the intro cards, so the text is never authored twice. Defaults to the
 *  stage the user is currently on. */
export function StageHelp() {
  const helpOpen = useUi((s) => s.helpOpen)
  const setHelpOpen = useUi((s) => s.setHelpOpen)
  const topStage = useUi((s) => s.topStage)
  const t = useT()
  const [selected, setSelected] = useState<TopStage>(topStage)

  const open = () => { setSelected(topStage); setHelpOpen(true) }
  const close = () => setHelpOpen(false)

  if (!helpOpen) {
    return <button className="help-stage-toggle" onClick={open}>{t('helpButton')}</button>
  }

  const info = STAGE_INTRO[selected]

  return (
    <>
      <button className="help-stage-toggle" onClick={open}>{t('helpButton')}</button>
      <div className="welcome-overlay" onClick={close}>
        <div className="stage-intro-card help-panel" onClick={(e) => e.stopPropagation()}>
          <button className="stage-intro-close" onClick={close} aria-label="Close">✕</button>
          <h2 className="stage-intro-title">{t('helpPanelTitle')}</h2>
          <p className="stage-intro-hint">{t('helpPanelHint')}</p>
          <div className="help-stage-list">
            {ORDER.map((stage, i) => (
              <button
                key={stage}
                className={`help-stage-item ${selected === stage ? 'active' : ''}`}
                onClick={() => setSelected(stage)}
              >
                <span className="stage-index">{i + 1}</span>
                {t(STAGE_INTRO[stage].titleKey)}
              </button>
            ))}
          </div>
          <div className="stage-intro-body help-stage-desc">
            {t(info.bodyKey).split('\n\n').map((para, i) => <p key={i}>{para}</p>)}
          </div>
          <div className="help-shortcuts">
            <h3 className="help-shortcuts-title">{t('helpShortcutsTitle')}</h3>
            <table className="help-shortcuts-table">
              <tbody>
                {SHORTCUTS.map((sc) => (
                  <tr key={sc.labelKey}>
                    <td className="help-shortcuts-keys">{sc.keys}</td>
                    <td>{t(sc.labelKey)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  )
}

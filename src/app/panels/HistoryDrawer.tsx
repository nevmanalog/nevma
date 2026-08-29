import { useState } from 'react'
import { useStore } from '@/state/store'
import { useT } from '@/i18n'

export function HistoryDrawer() {
  const [open, setOpen] = useState(false)
  const history = useStore((s) => s.history)
  const jumpHistory = useStore((s) => s.jumpHistory)
  const t = useT()
  const commands = [...history.past, ...history.future]
  const current = history.past.length

  return (
    <section className={`history-drawer ${open ? 'open' : ''}`}>
      <button
        className="history-toggle"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="start-pill"><span className="start-pill-icon" />{t('historyTitle')}</span>
        <span className="history-count">{current}/{commands.length}</span>
        <span className="history-chevron">{open ? '⌄' : '⌃'}</span>
      </button>
      {open && (
        <div className="history-list">
          <button
            className={`history-item ${current === 0 ? 'active' : ''}`}
            onClick={() => jumpHistory(0)}
          >
            <span className="history-index">0</span>
            <span>{t('historyStart')}</span>
          </button>
          {commands.map((command, index) => {
            const target = index + 1
            return (
              <button
                key={`${target}-${command.label}`}
                className={`history-item ${target === current ? 'active' : ''} ${target > current ? 'future' : ''}`}
                onClick={() => jumpHistory(target)}
              >
                <span className="history-index">{target}</span>
                <span className="history-label">{command.label}</span>
                {target === current && <span className="history-current">{t('historyCurrent')}</span>}
              </button>
            )
          })}
          {commands.length === 0 && <div className="history-empty">{t('historyEmpty')}</div>}
        </div>
      )}
    </section>
  )
}

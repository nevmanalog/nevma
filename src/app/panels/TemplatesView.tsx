import { useState } from 'react'
import { useStore } from '@/state/store'
import { PRESETS } from '@/domain/presets'
import { useT, useI18n } from '@/i18n'

export function TemplatesView() {
  const activeId = useStore((s) => s.activeLayerId)
  const applyPreset = useStore((s) => s.applyPreset)
  const randomizeTemplate = useStore((s) => s.randomizeTemplate)
  const t = useT()
  const lang = useI18n((s) => s.lang)
  const [expanded, setExpanded] = useState<string | null>(null)

  return (
    <div className="templates">
      {!activeId && <p className="hint">{t('selectLayer')}</p>}
      {PRESETS.map((p) => {
        const open = expanded === p.id
        return (
          <div key={p.id} className="template-card">
            <div className="tpl-head" onClick={() => setExpanded(open ? null : p.id)}>
              <span className="tpl-name">{t(p.nameKey)}</span>
              <span className="chev">{open ? '▾' : '▸'}</span>
            </div>
            {open && (
              <div className="tpl-body">
                <div className="tpl-row"><b>📄 {t('catPaper')}:</b> {p.desc.paper[lang]}</div>
                <div className="tpl-row"><b>🖨 {t('catPrinter')}:</b> {p.desc.print[lang]}</div>
                <div className="tpl-row"><b>💥 {t('catDamage')}:</b> {p.desc.aging[lang]}</div>
                <div className="tpl-row"><b>📡 {t('catScanner')}:</b> {p.desc.scanner[lang]}</div>
              </div>
            )}
            <div className="tpl-actions">
              <button className="tpl-apply" disabled={!activeId}
                onClick={() => activeId && applyPreset(activeId, p.id)}>
                {t('applyTemplate')} →
              </button>
              <button className="tpl-random" disabled={!activeId} data-tip={t('randomizeTemplateHint')}
                onClick={() => activeId && randomizeTemplate(activeId, p.id)}>
                🎲 {t('randomizeTemplate')}
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}

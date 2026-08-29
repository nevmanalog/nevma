import { useState } from 'react'
import { useT } from '@/i18n'
import { exportFinalImage, exportProjectLayers } from '@/engine/exportLayers'
import { SocialLinks } from './SocialLinks'
import { XpProgressBar } from './XpProgressBar'
import { useToast } from '@/state/toast'

export function ExportModal({ onClose }: { onClose: () => void }) {
  const t = useT()
  const showToast = useToast((s) => s.show)
  const [busy, setBusy] = useState<'final' | 'layers' | null>(null)

  const run = async (kind: 'final' | 'layers') => {
    if (busy) return
    setBusy(kind)
    try {
      if (kind === 'final') await exportFinalImage()
      else await exportProjectLayers()
      showToast(t('toastExported'))
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="welcome-overlay" onClick={onClose}>
      <div className="export-card" onClick={(e) => e.stopPropagation()}>
        <div className="export-card-head">
          <h2 className="np-title">{t('exportTitle')}</h2>
          <button className="export-close" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <button className="export-option" disabled={busy !== null} onClick={() => run('final')}>
          <span className="export-option-icon">🖼️</span>
          <span className="export-option-text">
            <span className="export-option-title">{busy === 'final' ? t('exporting') : t('exportFinalTitle')}</span>
            <span className="export-option-desc">{t('exportFinalDesc')}</span>
            {busy === 'final' && <XpProgressBar />}
          </span>
        </button>

        <button className="export-option" disabled={busy !== null} onClick={() => run('layers')}>
          <span className="export-option-icon">📦</span>
          <span className="export-option-text">
            <span className="export-option-title">{busy === 'layers' ? t('exporting') : t('exportLayersTitle')}</span>
            <span className="export-option-desc">{t('exportLayersDesc')}</span>
            {busy === 'layers' && <XpProgressBar />}
          </span>
        </button>

        <div className="export-support">
          <p>{t('supportLine1')}</p>
          <p>{t('supportLine2')}</p>
          <p className="export-support-phone">{t('supportPhone')}</p>
        </div>

        <SocialLinks variant="export" />
      </div>
    </div>
  )
}

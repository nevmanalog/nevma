import { useState } from 'react'
import { useStore } from '@/state/store'
import { useUi, type TopStage } from '@/state/ui'
import { useT } from '@/i18n'
import type { TKey } from '@/i18n/dict'
import { saveProject } from '@/engine/project'
import { openProjectDialog } from './projectActions'
import { StageHelp } from './StageHelp'
import { useRoute } from '@/state/route'
import logoUrl from '@/assets/nevma-logo.png'

const STAGES: { id: TopStage; icon: string; labelKey: TKey }[] = [
  { id: 'upload', icon: '↑', labelKey: 'stageUpload' },
  { id: 'print', icon: '🖨', labelKey: 'stagePrint' },
  { id: 'workshop', icon: '✂', labelKey: 'stageWorkshop' },
  { id: 'scan', icon: '📡', labelKey: 'stageScan' },
  { id: 'final', icon: '✦', labelKey: 'stageFinal' },
]

export function TopBar() {
  const undo = useStore((s) => s.undo)
  const redo = useStore((s) => s.redo)
  const canUndo = useStore((s) => s.canUndo)
  const canRedo = useStore((s) => s.canRedo)
  const lockAspect = useStore((s) => s.lockAspect)
  const setLockAspect = useStore((s) => s.setLockAspect)
  const topStage = useUi((s) => s.topStage)
  const setTopStage = useUi((s) => s.setTopStage)
  const showOriginal = useUi((s) => s.showOriginal)
  const setShowOriginal = useUi((s) => s.setShowOriginal)
  const setNewProjectOpen = useUi((s) => s.setNewProjectOpen)
  const t = useT()
  const navigate = useRoute((s) => s.navigate)
  const [saving, setSaving] = useState(false)

  const onSave = async () => {
    if (saving) return
    setSaving(true)
    try { await saveProject() } finally { setSaving(false) }
  }

  return (
    <div className="topbar">
      <img className="brand-logo" src={logoUrl} alt="Nevma" />

      <div className="topbar-file">
        <button className="tb-file" onClick={() => navigate('landing')} title={t('backToHome')}>🏠 {t('backToHome')}</button>
        <button className="tb-file" onClick={() => setNewProjectOpen(true)}>＋ {t('newProject')}</button>
        <button className="tb-file" disabled={saving} onClick={onSave}>💾 {saving ? t('saving') : t('saveProject')}</button>
        <button className="tb-file" onClick={() => openProjectDialog()}>📂 {t('openProject')}</button>
      </div>

      <nav className="stage-nav" aria-label="stages">
        {STAGES.map((st, i) => (
          <button
            key={st.id}
            className={`stage-btn ${topStage === st.id ? 'active' : ''}`}
            onClick={() => setTopStage(st.id)}
          >
            <span className="stage-index">{i + 1}</span>
            <span className="stage-icon">{st.icon}</span>
            <span className="stage-label">{t(st.labelKey)}</span>
          </button>
        ))}
      </nav>

      <div className="topbar-tools">
        <button
          className={`tb-original ${showOriginal ? 'on' : ''}`}
          data-tip={t('originalHint')}
          onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); setShowOriginal(true) }}
          onPointerUp={() => setShowOriginal(false)}
          onPointerCancel={() => setShowOriginal(false)}
          onLostPointerCapture={() => setShowOriginal(false)}
        >
          👁 {t('original')}
        </button>
        <button className="tb-icon" disabled={!canUndo} onClick={undo} data-tip="Ctrl+Z">↶</button>
        <button className="tb-icon" disabled={!canRedo} onClick={redo} data-tip="Ctrl+Shift+Z">↷</button>
        <label className={`tb-lock ${lockAspect ? 'on' : ''}`} data-tip={t('lockAspect')}>
          <input type="checkbox" checked={lockAspect} onChange={(e) => setLockAspect(e.target.checked)} />
          🔒
        </label>
        <StageHelp />
      </div>
    </div>
  )
}

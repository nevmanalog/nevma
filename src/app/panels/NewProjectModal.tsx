import { useState } from 'react'
import { useStore } from '@/state/store'
import { useUi } from '@/state/ui'
import { useT } from '@/i18n'
import type { Orientation } from '@/domain/types'
import { openProjectDialog, pickImage } from './projectActions'

interface Preset {
  key: string
  label: string
  w: number
  h: number
}

// Common canvas presets. Values are the landscape orientation; portrait simply
// swaps width/height.
const PRESETS: Preset[] = [
  { key: 'hd', label: 'Full HD · 1920×1080', w: 1920, h: 1080 },
  { key: '2k', label: '2K · 2560×1440', w: 2560, h: 1440 },
  { key: '4k', label: '4K · 3840×2160', w: 3840, h: 2160 },
  { key: 'a4', label: 'A4 300dpi · 3508×2480', w: 3508, h: 2480 },
  { key: 'a3', label: 'A3 300dpi · 4961×3508', w: 4961, h: 3508 },
  { key: 'sq', label: 'Square · 2048×2048', w: 2048, h: 2048 },
  { key: 'ig', label: 'Instagram · 1080×1350', w: 1350, h: 1080 },
]

export function NewProjectModal() {
  const doc = useStore((s) => s.doc)
  const open = useUi((s) => s.newProjectOpen)
  const setOpen = useUi((s) => s.setNewProjectOpen)
  const createDocument = useStore((s) => s.createDocument)
  const addImageLayer = useStore((s) => s.addImageLayer)
  const t = useT()

  const [presetKey, setPresetKey] = useState('hd')
  const [orientation, setOrientation] = useState<Orientation>('landscape')
  const [custom, setCustom] = useState(false)
  const [cw, setCw] = useState(1920)
  const [ch, setCh] = useState(1080)
  const [name, setName] = useState('Untitled')

  // Show on first run (no document yet) or whenever explicitly opened.
  const visible = open || !doc
  if (!visible) return null

  const preset = PRESETS.find((p) => p.key === presetKey) ?? PRESETS[0]
  const base = custom ? { w: cw, h: ch } : { w: preset.w, h: preset.h }
  const dims = orientation === 'portrait'
    ? { w: Math.min(base.w, base.h), h: Math.max(base.w, base.h) }
    : { w: Math.max(base.w, base.h), h: Math.min(base.w, base.h) }

  const close = () => setOpen(false)
  const create = () => {
    createDocument({ name, width: dims.w, height: dims.h })
    close()
  }
  const doImport = () => {
    pickImage((img, w, h) => {
      if (!useStore.getState().doc) {
        createDocument({ name, width: w, height: h })
      }
      addImageLayer(img, w, h)
      close()
    })
  }
  const doOpen = () => openProjectDialog(() => close())

  return (
    <div className="welcome-overlay">
      <div className="np-card">
        <div className="export-card-head" style={{ margin: '0 -20px 14px' }}>
          <h2 className="np-title">🖨 {t('npTitle')}</h2>
          {doc && <button className="export-close" onClick={close} aria-label="Close">✕</button>}
        </div>
        <p className="np-subtitle">{t('npSubtitle')}</p>

        <label className="np-field">
          <span className="np-label">{t('npName')}</span>
          <input className="np-input" value={name} onChange={(e) => setName(e.target.value)} />
        </label>

        <div className="np-field">
          <span className="np-label">{t('npResolution')}</span>
          <div className="np-presets">
            {PRESETS.map((p) => (
              <button
                key={p.key}
                className={`np-preset ${!custom && presetKey === p.key ? 'active' : ''}`}
                onClick={() => { setCustom(false); setPresetKey(p.key) }}
              >
                {p.label}
              </button>
            ))}
            <button className={`np-preset ${custom ? 'active' : ''}`} onClick={() => setCustom(true)}>
              {t('npCustom')}
            </button>
          </div>
        </div>

        {custom && (
          <div className="np-field np-row">
            <label className="np-num">
              <span className="np-label">{t('npWidth')}</span>
              <input type="number" min={1} max={16384} value={cw}
                onChange={(e) => setCw(Math.max(1, Math.min(16384, Number(e.target.value) || 1)))} />
            </label>
            <label className="np-num">
              <span className="np-label">{t('npHeight')}</span>
              <input type="number" min={1} max={16384} value={ch}
                onChange={(e) => setCh(Math.max(1, Math.min(16384, Number(e.target.value) || 1)))} />
            </label>
          </div>
        )}

        <div className="np-field">
          <span className="np-label">{t('npOrientation')}</span>
          <div className="np-seg">
            <button className={orientation === 'landscape' ? 'active' : ''} onClick={() => setOrientation('landscape')}>
              ▭ {t('npLandscape')}
            </button>
            <button className={orientation === 'portrait' ? 'active' : ''} onClick={() => setOrientation('portrait')}>
              ▯ {t('npPortrait')}
            </button>
          </div>
        </div>

        <div className="np-summary">{dims.w} × {dims.h} {t('npPx')}</div>

        <button className="np-create" onClick={create}>{t('npCreate')}</button>

        <div className="np-alts">
          <button className="np-link" onClick={doImport}>{t('npImport')}</button>
          <button className="np-link" onClick={doOpen}>{t('npOpen')}</button>
        </div>
      </div>
    </div>
  )
}

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { useStore, sheetOps, sourceBitmaps } from '@/state/store'
import { useUi } from '@/state/ui'
import {
  PAPER_SCHEMA, PRINTER_SCHEMA, SCANNER_SCHEMA,
  PAPER_TYPES, PRINTER_TYPES, COLOR_MODES, PREPRESS_MODES, SCANNER_MODES,
} from '@/domain/params'
import type { ParamSchema } from '@/domain/params'
import type { ColorMode, PrepressMode, ScannerMode, EngineId, EdgeStyle, PhysicalToolId, SheetOp, Layer } from '@/domain/types'
import { useT } from '@/i18n'
import type { TKey } from '@/i18n/dict'
import { Sliders, SingleSlider, HelpButton } from './parts'
import { TemplatesView } from './TemplatesView'
import { ExportModal } from './ExportModal'
import { useAuth } from '@/state/auth'
import { createPost } from '@/lib/community'
import { PublishModal } from '@/pages/community/PublishModal'
import { renderFinalImage } from '@/engine/exportLayers'
import { serializePostProjectSnapshot } from '@/engine/project'
import { canvasToPngBytes } from '@/shared/zip'
import { WORKSHOP_TOOLS, activeWorkshopToolId, type WorkshopToolId } from './workshopTools'
import { getPhysicalToolEngine } from '@/engine/tools/registry'
import { mergeParameters } from '@/engine/tools/core/parameters'
import { FINAL_ADJUSTMENTS, normalizeFinal } from '@/engine/final/registry'
import type { FinalAdjustment, FinalControlSpec } from '@/engine/final/contracts'
import { loadImageFile } from '@/shared/loadImage'
import { bakeBase } from '@/engine/gl/bakeAsync'
import type { LayerEffects } from '@/domain/types'

// Curated per-section slider subsets so each control appears in exactly one place.
const pick = (schema: ParamSchema, keys: readonly string[]): ParamSchema =>
  schema.filter((s) => keys.includes(s.key))
const PAPER_MAIN = ['yellowing', 'fibers', 'roughness', 'thickness', 'stains'] as const
const PRINTER_MAIN = ['dpi', 'halftone', 'colorShift', 'registration'] as const
const PRINTER_INK = ['inkDensity', 'dotGain', 'fade'] as const
const SCANNER_MAIN = ['exposure', 'blur', 'streaks', 'distortion', 'colorProblems'] as const

// ---------------------------------------------------------------------------
// Type dropdowns with a hover preview (paper type / printer type). A native
// <select>'s <option> elements render in an OS-level popup in most browsers,
// so they can't be hovered from JS — hence a from-scratch dropdown here
// instead of just adding a hover handler to the old <select>.
// ---------------------------------------------------------------------------

const PREVIEW_BOX = 220 // longest side, px — plenty to tell papers/printers
                         // apart at a glance, small enough to bake near-instantly

/** Renders the layer's current material with one field (paperType or
 *  printerType) swapped, at a small size — same "printed base" bake used
 *  everywhere else (see engine/bake.ts), just downscaled and only reached
 *  through the worker queue (bakeBase/bakeMaterialAsync) so a hover preview
 *  can never contend with the singleton main-thread WebGL renderer that live
 *  strokes use. Returns null if the layer has no source loaded yet. */
async function bakeTypePreview(
  activeId: string, effects: LayerEffects, seed: number, width: number, height: number,
): Promise<string | null> {
  const src = sourceBitmaps.get(activeId)
  if (!src || width <= 0 || height <= 0) return null
  const scale = Math.min(1, PREVIEW_BOX / Math.max(width, height))
  const w = Math.max(1, Math.round(width * scale))
  const h = Math.max(1, Math.round(height * scale))
  try {
    const canvas = await bakeBase({ source: src, width: w, height: h, effects, seed })
    return canvas.toDataURL()
  } catch (err) {
    console.error('[RightPanel] type preview bake failed:', err)
    return null
  }
}

function TypeSelect<T extends string>({
  value, options, onChange, getPreview, disabled,
}: {
  value: T
  options: { id: T; labelKey: TKey }[]
  onChange: (v: T) => void
  /** Bakes the preview for one option. The caller is expected to hand back a
   *  fresh closure whenever the layer's actual look changes (a new
   *  `activeId`/effects/seed) — see `PrintSettings` below — so this
   *  component's own per-option cache (`previews`) naturally goes stale
   *  along with it, just by virtue of being local state on a component
   *  whose key includes the layer id. */
  getPreview: (id: T) => Promise<string | null>
  disabled?: boolean
}) {
  const t = useT()
  const [open, setOpen] = useState(false)
  const [hoverId, setHoverId] = useState<T | null>(null)
  const [previews, setPreviews] = useState<Partial<Record<T, string>>>({})
  const [inFlight] = useState(() => new Set<T>())
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const [menuStyle, setMenuStyle] = useState<CSSProperties>({ visibility: 'hidden' })

  // Positions the portal'd menu against the trigger button in viewport
  // (`position: fixed`) coordinates — same reasoning and approach as
  // HelpButton's popover above: this control lives inside `.panel`, which
  // scrolls (`overflow-y: auto`), so an absolutely-positioned menu would get
  // clipped by that ancestor instead of floating over the whole app.
  useLayoutEffect(() => {
    if (!open) return
    const place = () => {
      const trigger = triggerRef.current?.getBoundingClientRect()
      const menu = menuRef.current
      if (!trigger || !menu) return
      const margin = 8
      const gap = 4
      const width = Math.min(360, window.innerWidth - margin * 2)
      const height = Math.min(menu.scrollHeight, window.innerHeight - margin * 2)
      const left = Math.min(window.innerWidth - width - margin, Math.max(margin, trigger.left))
      const fitsBelow = trigger.bottom + gap + height <= window.innerHeight - margin
      const top = fitsBelow ? trigger.bottom + gap : Math.max(margin, trigger.top - gap - height)
      setMenuStyle({ left, top, width, maxHeight: window.innerHeight - margin * 2, visibility: 'visible' })
    }
    place()
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => {
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const close = (ev: MouseEvent) => {
      if (triggerRef.current?.contains(ev.target as Node)) return
      if (menuRef.current?.contains(ev.target as Node)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  // Closing the dropdown drops the hover state so a stale preview panel
  // can't flash open on next hover of a different control.
  useEffect(() => { if (!open) setHoverId(null) }, [open])

  const handleHover = (id: T) => {
    setHoverId(id)
    if (previews[id] !== undefined || inFlight.has(id)) return
    inFlight.add(id)
    getPreview(id).then((url) => {
      inFlight.delete(id)
      if (url) setPreviews((p) => ({ ...p, [id]: url }))
    })
  }

  const activeLabel = options.find((o) => o.id === value)?.labelKey
  const previewUrl = hoverId ? previews[hoverId] : undefined

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className="select type-select-trigger"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
      >
        <span>{activeLabel ? t(activeLabel) : value}</span>
        <span className="type-select-caret">{open ? '▴' : '▾'}</span>
      </button>
      {open && createPortal(
        <div ref={menuRef} className="type-select-menu" style={menuStyle}>
          <div className="type-select-options">
            {options.map((opt) => (
              <div
                key={opt.id}
                className={`type-select-option ${opt.id === value ? 'active' : ''}`}
                onMouseEnter={() => handleHover(opt.id)}
                onClick={() => { onChange(opt.id); setOpen(false) }}
              >
                {t(opt.labelKey)}
              </div>
            ))}
          </div>
          <div className="type-select-preview">
            {hoverId && previewUrl && <img src={previewUrl} alt="" />}
            {hoverId && previewUrl === undefined && <div className="type-select-preview-loading">…</div>}
            {!hoverId && <div className="type-select-preview-hint">{t('typeSelectHoverHint')}</div>}
          </div>
        </div>,
        document.body,
      )}
    </>
  )
}

const EDGE_STYLES: { id: EdgeStyle; key: TKey }[] = [
  { id: 'scissors', key: 'edgeScissors' },
  { id: 'torn', key: 'edgeTorn' },
  { id: 'worn', key: 'edgeWorn' },
]

// ---------------------------------------------------------------------------
// Shared primitives
// ---------------------------------------------------------------------------

/** One iPhone-Settings-style accordion row. Only one is open at a time. */
function Acc({ id, icon, title, active, openId, setOpenId, children }: {
  id: string; icon: string; title: string; active?: boolean
  openId: string | null; setOpenId: (v: string | null) => void; children: ReactNode
}) {
  const open = openId === id
  return (
    <div className={`acc ${open ? 'open' : ''}`}>
      <button className="acc-head" onClick={() => setOpenId(open ? null : id)}>
        <span className="acc-icon">{icon}</span>
        <span className="acc-title">{title}</span>
        {active && <span className="acc-dot" title="on" />}
        <span className="acc-chev">{open ? '▾' : '▸'}</span>
      </button>
      {open && <div className="acc-body">{children}</div>}
    </div>
  )
}

/** Placeholder for stations/sections requested in the design but not yet
 *  backed by a processing engine (kept visible but inactive). */
function Inactive() {
  const t = useT()
  return (
    <div className="placeholder">
      <input type="range" min={0} max={100} defaultValue={50} disabled />
      <p className="hint">{t('comingSoon')}</p>
    </div>
  )
}

function OptHead({ labelKey, helpKey, paramKey }: { labelKey: TKey; helpKey: TKey; paramKey: string }) {
  const t = useT()
  return (
    <div className="opt-label" style={{ display: 'flex', alignItems: 'center', gap: 4, margin: '6px 0 4px' }}>
      {t(labelKey)}<HelpButton paramKey={paramKey} helpKey={helpKey} />
    </div>
  )
}

function EngineToggle({ activeId, engine }: { activeId: string; engine: EngineId }) {
  const on = useStore((s) => s.layers[activeId].effects.engines[engine])
  const toggleEngine = useStore((s) => s.toggleEngine)
  const t = useT()
  return (
    <label className="chk-row" onClick={(ev) => ev.stopPropagation()}>
      <input type="checkbox" checked={on} onChange={() => toggleEngine(activeId, engine)} />
      {t('engineEnabled')}
    </label>
  )
}

/** Colour mode + optional tint — reused by Print and Final. */
function ColorControls({ activeId }: { activeId: string }) {
  const e = useStore((s) => s.layers[activeId].effects)
  const setColorMode = useStore((s) => s.setColorMode)
  const setTint = useStore((s) => s.setTint)
  const t = useT()
  return (
    <>
      <OptHead labelKey="lblColorMode" helpKey="hColorMode" paramKey="sel.colorMode" />
      <select className="select" value={e.colorMode} onChange={(ev) => setColorMode(activeId, ev.target.value as ColorMode)}>
        {COLOR_MODES.map((c) => <option key={c.id} value={c.id}>{t(c.labelKey)}</option>)}
      </select>
      {e.colorMode === 'tint' && (
        <label className="color-row"><span className="lbl">{t('tintColor')}<HelpButton paramKey="sel.tint" helpKey="hTintColor" /></span>
          <input type="color" value={e.tint} onChange={(ev) => setTint(activeId, ev.target.value)} />
        </label>
      )}
    </>
  )
}

type SectionProps = { activeId: string; openId: string | null; setOpenId: (v: string | null) => void }

// ---------------------------------------------------------------------------
// Print
// ---------------------------------------------------------------------------

function PrintSettings({ activeId, openId, setOpenId }: SectionProps) {
  const e = useStore((s) => s.layers[activeId].effects)
  const width = useStore((s) => s.layers[activeId].width)
  const height = useStore((s) => s.layers[activeId].height)
  const seed = useStore((s) => s.layers[activeId].seed)
  const bakeToken = useStore((s) => s.bakeToken[activeId])
  const updatePaper = useStore((s) => s.updatePaper)
  const updatePrinter = useStore((s) => s.updatePrinter)
  const setPaperType = useStore((s) => s.setPaperType)
  const setPrinterType = useStore((s) => s.setPrinterType)
  const setPrepress = useStore((s) => s.setPrepress)
  const setPaperColor = useStore((s) => s.setPaperColor)
  const t = useT()
  const eng = e.engines
  return (
    <>
      <Acc id="paper" icon="📄" title={t('catPaper')} openId={openId} setOpenId={setOpenId}>
        <EngineToggle activeId={activeId} engine="paper" />
        {eng.paper && <>
          <OptHead labelKey="lblPaperType" helpKey="hPaperType" paramKey="sel.paperType" />
          <TypeSelect
            key={`${activeId}-paper-${bakeToken}`}
            value={e.paperType}
            options={PAPER_TYPES}
            onChange={(v) => setPaperType(activeId, v)}
            getPreview={(paperType) => bakeTypePreview(activeId, { ...e, paperType }, seed, width, height)}
          />
          <label className="color-row"><span className="lbl">{t('paperColor')}<HelpButton paramKey="sel.paperColor" helpKey="hPaperColor" /></span>
            <input type="color" value={e.paperColor} onChange={(ev) => setPaperColor(activeId, ev.target.value)} />
          </label>
          <Sliders schema={pick(PAPER_SCHEMA, PAPER_MAIN)} values={e.paper} onChange={(p) => updatePaper(activeId, p)} prefix="paper" />
        </>}
      </Acc>
      <Acc id="printer" icon="🖨" title={t('catPrinter')} openId={openId} setOpenId={setOpenId}>
        <EngineToggle activeId={activeId} engine="printer" />
        {eng.printer && <>
          <OptHead labelKey="prepressMode" helpKey="hPrepress" paramKey="sel.prepress" />
          <select className="select" value={e.prepress} onChange={(ev) => setPrepress(activeId, ev.target.value as PrepressMode)}>
            {PREPRESS_MODES.map((pm) => <option key={pm.id} value={pm.id}>{t(pm.labelKey)}</option>)}
          </select>
          <OptHead labelKey="lblPrinterType" helpKey="hPrinterType" paramKey="sel.printerType" />
          <TypeSelect
            key={`${activeId}-printer-${bakeToken}`}
            value={e.printerType}
            options={PRINTER_TYPES}
            onChange={(v) => setPrinterType(activeId, v)}
            getPreview={(printerType) => bakeTypePreview(activeId, { ...e, printerType }, seed, width, height)}
          />
          <Sliders schema={pick(PRINTER_SCHEMA, PRINTER_MAIN)} values={e.printer} onChange={(p) => updatePrinter(activeId, p)} prefix="printer" />
        </>}
      </Acc>
      <Acc id="ink" icon="🩸" title={t('catInk')} openId={openId} setOpenId={setOpenId}>
        <Sliders schema={pick(PRINTER_SCHEMA, PRINTER_INK)} values={e.printer} onChange={(p) => updatePrinter(activeId, p)} prefix="printer" />
      </Acc>
      <Acc id="color" icon="🎨" title={t('catColor')} openId={openId} setOpenId={setOpenId}>
        <ColorControls activeId={activeId} />
      </Acc>
    </>
  )
}

// ---------------------------------------------------------------------------
// Scan
// ---------------------------------------------------------------------------

function ScanSettings({ activeId, openId, setOpenId }: SectionProps) {
  const e = useStore((s) => s.layers[activeId].effects)
  const updateScanner = useStore((s) => s.updateScanner)
  const setScannerMode = useStore((s) => s.setScannerMode)
  const t = useT()
  const eng = e.engines
  const scanActive = e.scannerMode !== 'none'
  return (
    <>
      <Acc id="scanner" icon="📡" title={t('catScanner')} openId={openId} setOpenId={setOpenId}>
        <EngineToggle activeId={activeId} engine="scanner" />
        {eng.scanner && <>
          <OptHead labelKey="scannerMode" helpKey="hScannerMode" paramKey="sel.scannerMode" />
          <select className="select" value={e.scannerMode} onChange={(ev) => setScannerMode(activeId, ev.target.value as ScannerMode)}>
            {SCANNER_MODES.map((sm) => <option key={sm.id} value={sm.id}>{t(sm.labelKey)}</option>)}
          </select>
          {scanActive && <Sliders schema={pick(SCANNER_SCHEMA, SCANNER_MAIN)} values={e.scanner} onChange={(p) => updateScanner(activeId, p)} prefix="scanner" />}
        </>}
      </Acc>
      <Acc id="noise" icon="〰️" title={t('secNoise')} openId={openId} setOpenId={setOpenId}>
        <Sliders schema={pick(SCANNER_SCHEMA, ['noise'])} values={e.scanner} onChange={(p) => updateScanner(activeId, p)} prefix="scanner" />
      </Acc>
      <Acc id="dust" icon="✦" title={t('secDust')} openId={openId} setOpenId={setOpenId}>
        <Sliders schema={pick(SCANNER_SCHEMA, ['dust'])} values={e.scanner} onChange={(p) => updateScanner(activeId, p)} prefix="scanner" />
      </Acc>
      <Acc id="compression" icon="▦" title={t('secCompression')} openId={openId} setOpenId={setOpenId}>
        <Sliders schema={pick(SCANNER_SCHEMA, ['jpeg'])} values={e.scanner} onChange={(p) => updateScanner(activeId, p)} prefix="scanner" />
      </Acc>
      <Acc id="artifacts" icon="▚" title={t('secArtifacts')} openId={openId} setOpenId={setOpenId}>
        <Inactive />
      </Acc>
    </>
  )
}

// ---------------------------------------------------------------------------
// Final
// ---------------------------------------------------------------------------

/** Value formatter for a final-adjustment control. */
function fmtFinal(spec: FinalControlSpec, v: number): string {
  switch (spec.format) {
    case 'percent': return `${Math.round(v * 100)}%`
    case 'signedPercent': return `${v > 0 ? '+' : ''}${Math.round(v * 100)}%`
    case 'degrees': return `${Math.round(v)}°`
    case 'stops': return `${v > 0 ? '+' : ''}${v.toFixed(2)} EV`
    case 'level': return `${Math.round(v)}`
    default: return spec.step < 1 ? v.toFixed(2) : `${Math.round(v)}`
  }
}

/** One independent Final correction layer: enable toggle + its controls. */
function FinalAdjustmentSection({ activeId, adj, openId, setOpenId }: SectionProps & { adj: FinalAdjustment }) {
  const stored = useStore((s) => normalizeFinal(s.layers[activeId].effects.final)[adj.id])
  const toggleFinalAdjustment = useStore((s) => s.toggleFinalAdjustment)
  const updateFinalAdjustment = useStore((s) => s.updateFinalAdjustment)
  const t = useT()
  return (
    <Acc id={adj.id} icon={adj.icon} title={t(adj.labelKey)} active={stored.enabled} openId={openId} setOpenId={setOpenId}>
      <label className="chk-row" onClick={(ev) => ev.stopPropagation()}>
        <input type="checkbox" checked={stored.enabled} onChange={() => toggleFinalAdjustment(activeId, adj.id)} />
        {t('finEnabled')}
      </label>
      {stored.enabled && adj.controls.map((spec) => (
        <SingleSlider key={spec.key} labelKey={spec.labelKey} helpKey={spec.helpKey}
          paramKey={`final.${adj.id}.${spec.key}`}
          value={stored.values[spec.key] ?? spec.default}
          min={spec.min} max={spec.max} step={spec.step}
          onChange={(v) => updateFinalAdjustment(activeId, adj.id, { [spec.key]: v })}
          fmt={(v) => fmtFinal(spec, v)} />
      ))}
    </Acc>
  )
}

function FinalSettings({ activeId, openId, setOpenId }: SectionProps) {
  const layer = useStore((s) => s.layers[activeId])
  const updateIntensity = useStore((s) => s.updateIntensity)
  const setSeed = useStore((s) => s.setSeed)
  const randomize = useStore((s) => s.randomize)
  const saveCurrentPreset = useStore((s) => s.saveCurrentPreset)
  const applySavedPreset = useStore((s) => s.applySavedPreset)
  const renamePreset = useStore((s) => s.renamePreset)
  const deletePreset = useStore((s) => s.deletePreset)
  const savedPresets = useStore((s) => s.savedPresets)
  const t = useT()
  const e = layer.effects
  return (
    <>
      {FINAL_ADJUSTMENTS.map((adj) => (
        <FinalAdjustmentSection key={adj.id} adj={adj} activeId={activeId} openId={openId} setOpenId={setOpenId} />
      ))}
      <Acc id="color" icon="🎨" title={t('catColor')} openId={openId} setOpenId={setOpenId}>
        <ColorControls activeId={activeId} />
      </Acc>
      <Acc id="intensity" icon="✦" title={t('intensity')} openId={openId} setOpenId={setOpenId}>
        <SingleSlider labelKey="intensity" helpKey="intensityHelp" paramKey="intensity"
          value={e.intensity} min={0} max={1} step={0.01}
          onChange={(v) => updateIntensity(activeId, v)} fmt={(v) => `${Math.round(v * 100)}%`} />
      </Acc>
      <Acc id="finish" icon="🎲" title={t('secFinish')} openId={openId} setOpenId={setOpenId}>
        <div className="seed-row">
          <input type="number" value={layer.seed} onChange={(ev) => setSeed(activeId, parseInt(ev.target.value || '0', 10))} />
          <button onClick={() => randomize(activeId)} title={t('randomize')}>🎲</button>
        </div>
        <button className="wide-btn" onClick={() => {
          const name = window.prompt(t('savePreset'), t('customPreset'))
          if (name !== null) saveCurrentPreset(activeId, name)
        }}>💾 {t('savePreset')}</button>
        {savedPresets.length > 0 && (
          <div className="saved-preset-list">
            {savedPresets.map((p) => (
              <div key={p.id} className="saved-preset-row">
                <span className="saved-preset-name" onClick={() => applySavedPreset(activeId, p.id)}>{p.name}</span>
                <div className="saved-preset-actions">
                  <button className="icon-btn" data-tip={t('renamePreset')}
                    onClick={() => {
                      const n = window.prompt(t('renamePreset'), p.name)
                      if (n !== null) renamePreset(p.id, n)
                    }}>✏️</button>
                  <button className="icon-btn" data-tip={t('deletePreset')}
                    onClick={() => deletePreset(p.id)}>🗑</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Acc>
    </>
  )
}

// ---------------------------------------------------------------------------
// Workshop — only the selected tool's settings are shown
// ---------------------------------------------------------------------------

function ToolControls({ tool }: { tool: PhysicalToolId }) {
  const values = useUi((s) => s.toolParameters[tool])
  const setToolParameter = useUi((s) => s.setToolParameter)
  const t = useT()
  const engine = getPhysicalToolEngine(tool)
  if (!engine) return null
  const format = (kind: string | undefined, value: number) => {
    if (kind === 'pixels') return `${Math.round(value)} px`
    if (kind === 'percent') return `${Math.round(value * 100)}%`
    if (kind === 'degrees') return `${Math.round(value)}°`
    return value.toFixed(2)
  }
  return (
    <>
      {engine.controls.map((spec) => {
        if (spec.kind === 'color') {
          const value = typeof values[spec.key] === 'string' ? values[spec.key] as string : '#222222'
          return (
            <label className="color-row" key={spec.key}>
              <span className="lbl">{t(spec.labelKey)}<HelpButton paramKey={`${tool}.${spec.key}`} helpKey={spec.helpKey} /></span>
              <input type="color" value={value} onChange={(event) => setToolParameter(tool, spec.key, event.target.value)} />
            </label>
          )
        }
        const value = typeof values[spec.key] === 'number' ? values[spec.key] as number : 0
        return (
          <SingleSlider
            key={spec.key}
            labelKey={spec.labelKey}
            helpKey={spec.helpKey}
            paramKey={`${tool}.${spec.key}`}
            value={value}
            min={spec.min ?? 0}
            max={spec.max ?? 1}
            step={spec.step ?? 0.01}
            onChange={(next) => setToolParameter(tool, spec.key, next)}
            fmt={(next) => format(spec.format, next)}
          />
        )
      })}
    </>
  )
}

function WorkshopToolBody({ activeId, toolId, active }: { activeId: string; toolId: WorkshopToolId; active: boolean }) {
  const layer = useStore((s) => s.layers[activeId])
  const setEdgeStyle = useStore((s) => s.setEdgeStyle)
  const edgeStyle = useStore((s) => s.edgeStyle)
  const setEdgeColor = useStore((s) => s.setEdgeColor)
  const lockAspect = useStore((s) => s.lockAspect)
  const setLockAspect = useStore((s) => s.setLockAspect)
  const t = useT()
  const e = layer.effects

  if (!active) return <Inactive />

  if (toolId === 'move') {
    return (
      <label className="chk-row">
        <input type="checkbox" checked={lockAspect} onChange={(ev) => setLockAspect(ev.target.checked)} />
        {t('lockAspect')}
      </label>
    )
  }
  if (toolId === 'cut' || toolId === 'pen') {
    return (
      <>
        <div className="opt-label" style={{ margin: '0 0 4px' }}>{t('edgeStyle')}</div>
        <div className="opt-row">
          {EDGE_STYLES.map((s) => (
            <button key={s.id} className={`opt-btn ${edgeStyle === s.id ? 'active' : ''}`} onClick={() => setEdgeStyle(s.id)}>{t(s.key)}</button>
          ))}
        </div>
        <label className="color-row"><span className="lbl">{t('edgeColor')}<HelpButton paramKey="sel.edgeColor" helpKey="hEdgeColor" /></span>
          <input type="color" value={e.edgeColor} onChange={(ev) => setEdgeColor(activeId, ev.target.value)} />
        </label>
      </>
    )
  }
  const engine = getPhysicalToolEngine(toolId)
  return engine ? <ToolControls tool={engine.id} /> : null
}

// ---------------------------------------------------------------------------
// Applied tools stack — Photoshop-style: every committed workshop stroke stays
// listed after the fact, with an enable checkbox and its original controls, so
// it can be switched off or re-tuned without re-doing the stroke. Order is
// fixed (it's physically meaningful — see engine/sheet/render.ts), so this is
// a stack of switches/knobs, not a reorderable layer list.
// ---------------------------------------------------------------------------

function AppliedOpRow({ activeId, op, index, order, nested, isOpen, onToggleOpen }: {
  activeId: string; op: SheetOp; index: number; order?: number; nested?: boolean
  isOpen: boolean; onToggleOpen: () => void
}) {
  const toggleSheetOp = useStore((s) => s.toggleSheetOp)
  const updateSheetOpParameters = useStore((s) => s.updateSheetOpParameters)
  const removeSheetOp = useStore((s) => s.removeSheetOp)
  const renameSheetOp = useStore((s) => s.renameSheetOp)
  const t = useT()
  const tool = WORKSHOP_TOOLS.find((w) => w.id === op.tool)
  const engine = getPhysicalToolEngine(op.tool)
  const enabled = op.enabled !== false
  const defaultName = tool ? t(tool.labelKey) : op.tool
  const format = (kind: string | undefined, value: number) => {
    if (kind === 'pixels') return `${Math.round(value)} px`
    if (kind === 'percent') return `${Math.round(value * 100)}%`
    if (kind === 'degrees') return `${Math.round(value)}°`
    return value.toFixed(2)
  }

  // Local draft so typing doesn't push an undo entry per keystroke — only
  // committed (see commitLabel) on blur/Enter. Resynced whenever the stored
  // label changes from elsewhere (undo/redo, switching rows).
  const [labelDraft, setLabelDraft] = useState(op.label ?? '')
  useEffect(() => setLabelDraft(op.label ?? ''), [op.label])
  const commitLabel = () => {
    if (labelDraft.trim() !== (op.label ?? '')) renameSheetOp(activeId, index, labelDraft)
  }

  return (
    <div className={`acc applied-op ${nested ? 'applied-op-nested' : ''} ${isOpen ? 'open' : ''} ${enabled ? '' : 'disabled'}`}>
      <button className="acc-head" onClick={onToggleOpen}>
        {nested
          ? <span className="applied-op-order">#{order}</span>
          : <span className="acc-icon">{tool?.icon ?? '🔧'}</span>}
        <span className="acc-title">{op.label?.trim() || defaultName}{nested ? '' : (order ? ` #${order}` : '')}</span>
        {enabled && <span className="acc-dot" title="on" />}
        <span className="acc-chev">{isOpen ? '▾' : '▸'}</span>
      </button>
      {isOpen && (
        <div className="acc-body">
          <label className="op-rename-row" onClick={(ev) => ev.stopPropagation()}>
            <span className="lbl">{t('opRename')}</span>
            <input
              type="text"
              className="op-rename-input"
              value={labelDraft}
              placeholder={defaultName}
              maxLength={40}
              onChange={(ev) => setLabelDraft(ev.target.value)}
              onBlur={commitLabel}
              onKeyDown={(ev) => { if (ev.key === 'Enter') (ev.target as HTMLInputElement).blur() }}
            />
          </label>
          <label className="chk-row" onClick={(ev) => ev.stopPropagation()}>
            <input type="checkbox" checked={enabled} onChange={() => toggleSheetOp(activeId, index)} />
            {t('opEnabled')}
          </label>
          {enabled && engine && (() => {
            const values = mergeParameters(engine.defaults, op.parameters)
            return engine.controls.map((spec) => {
              if (spec.kind === 'color') {
                const value = typeof values[spec.key] === 'string' ? values[spec.key] as string : '#222222'
                return (
                  <label className="color-row" key={spec.key}>
                    <span className="lbl">{t(spec.labelKey)}<HelpButton paramKey={`${op.tool}.${spec.key}`} helpKey={spec.helpKey} /></span>
                    <input type="color" value={value}
                      onChange={(ev) => updateSheetOpParameters(activeId, index, { [spec.key]: ev.target.value })} />
                  </label>
                )
              }
              const value = typeof values[spec.key] === 'number' ? values[spec.key] as number : 0
              return (
                <SingleSlider
                  key={spec.key}
                  labelKey={spec.labelKey}
                  helpKey={spec.helpKey}
                  paramKey={`${op.tool}.${spec.key}`}
                  value={value}
                  min={spec.min ?? 0}
                  max={spec.max ?? 1}
                  step={spec.step ?? 0.01}
                  onChange={(next) => updateSheetOpParameters(activeId, index, { [spec.key]: next })}
                  fmt={(next) => format(spec.format, next)}
                />
              )
            })
          })()}
          <button className="wide-btn" onClick={(ev) => { ev.stopPropagation(); removeSheetOp(activeId, index) }}>
            🗑 {t('opRemove')}
          </button>
        </div>
      )}
    </div>
  )
}

/** One collapsible folder per tool — icon, name, count, and an "any enabled"
 *  dot. Expanding it reveals every individual stroke of that tool as its own
 *  sub-row (still independently switchable/tunable/removable), instead of
 *  every stroke sitting flat in the list. This is what keeps the panel short
 *  when a tool has been used many times: 11 marker strokes collapse into one
 *  "Маркер · 11" row until you actually want to touch one of them. */
function AppliedToolGroup({ activeId, tool, rows, isOpen, onToggle, openIndex, setOpenIndex }: {
  activeId: string
  tool: (typeof WORKSHOP_TOOLS)[number]
  rows: { op: SheetOp; index: number }[]
  isOpen: boolean
  onToggle: () => void
  openIndex: number | null
  setOpenIndex: (v: number | null) => void
}) {
  const t = useT()
  const enabledCount = rows.filter(({ op }) => op.enabled !== false).length
  return (
    <div className={`acc applied-group ${isOpen ? 'open' : ''}`}>
      <button className="acc-head" onClick={onToggle}>
        <span className="acc-icon">{tool.icon}</span>
        <span className="acc-title">{t(tool.labelKey)}</span>
        <span className="applied-group-count">{rows.length}</span>
        {enabledCount > 0 && <span className="acc-dot" title="on" />}
        <span className="acc-chev">{isOpen ? '▾' : '▸'}</span>
      </button>
      {isOpen && (
        <div className="acc-body applied-group-body">
          {rows.map(({ op, index }, i) => (
            <AppliedOpRow key={index} activeId={activeId} op={op} index={index} order={i + 1} nested
              isOpen={openIndex === index} onToggleOpen={() => setOpenIndex(openIndex === index ? null : index)} />
          ))}
        </div>
      )}
    </div>
  )
}

function AppliedToolsStack({ activeId }: { activeId: string }) {
  // sheetOps lives outside React state (like the bitmap maps); bakeToken is its
  // React-visible version counter, so subscribing to it re-reads the list on
  // every add/toggle/edit/remove — same pattern the viewport bake effect uses.
  useStore((s) => s.bakeToken[activeId])
  const ops = sheetOps.get(activeId) ?? []
  const [openIndex, setOpenIndex] = useState<number | null>(null)
  // Only one tool's folder open at a time (same accordion pattern as the
  // Paper/Printer/Ink/Color sections above) — this, not a flat filtered list,
  // is what stops the panel growing every time another stroke is added.
  // Reset whenever the active layer changes so switching layers never leaves
  // a stale folder open for a tool the new layer may not even have.
  const [openTool, setOpenTool] = useState<PhysicalToolId | null>(null)
  useEffect(() => { setOpenTool(null); setOpenIndex(null) }, [activeId])
  const t = useT()
  if (ops.length === 0) return null

  // One folder per tool actually used on this layer, in the workshop's fixed
  // station order (not first-use order) so the list doesn't jump around as
  // strokes are added.
  const usedTools = WORKSHOP_TOOLS.filter((w) => ops.some((op) => op.tool === w.id))
  const grouped = ops.map((op, index) => ({ op, index }))

  return (
    <div className="applied-ops-stack">
      <div className="opt-label applied-ops-title" style={{ margin: '0 0 4px' }}>
        {t('appliedToolsTitle')}
        <span className="applied-ops-total">{ops.length}</span>
      </div>
      {usedTools.map((w) => (
        <AppliedToolGroup
          key={w.id}
          activeId={activeId}
          tool={w}
          rows={grouped.filter(({ op }) => op.tool === w.id)}
          isOpen={openTool === w.id}
          onToggle={() => { setOpenTool((v) => (v === w.id ? null : (w.id as PhysicalToolId))); setOpenIndex(null) }}
          openIndex={openIndex}
          setOpenIndex={setOpenIndex}
        />
      ))}
    </div>
  )
}

function WorkshopToolSettings({ activeId }: { activeId: string }) {
  const workshopTool = useUi((s) => s.workshopTool)
  const activeTool = useStore((s) => s.activeTool)
  const cutMode = useStore((s) => s.cutMode)
  const t = useT()

  // Settings follow the genuinely-active canvas tool, so switching to Hand/Zoom
  // stops showing the previous tool's controls (no stale, double-active state).
  const currentId = activeWorkshopToolId(activeTool, cutMode, workshopTool)
  if (!currentId) return <p className="hint">{t('workshopNavActive')}</p>
  const tool = WORKSHOP_TOOLS.find((x) => x.id === currentId) ?? WORKSHOP_TOOLS[0]
  return (
    <div className="tool-settings">
      <div className="tool-settings-head">
        <span className="ts-icon">{tool.icon}</span>
        <span className="ts-name">{t(tool.labelKey)}</span>
      </div>
      <p className="hint ts-desc">{t(tool.descKey)}</p>
      <div className="ts-body">
        <WorkshopToolBody activeId={activeId} toolId={tool.id} active={tool.active} />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Upload
// ---------------------------------------------------------------------------

/** The Upload stage doesn't need a layer — it adds images & offers templates. */
function UploadPanel({ openId, setOpenId }: { openId: string | null; setOpenId: (v: string | null) => void }) {
  const addImageLayer = useStore((s) => s.addImageLayer)
  const t = useT()
  const loadFile = (file: File) => {
    loadImageFile(file, (source, w, h) => addImageLayer(source, w, h))
  }
  return (
    <>
      <p className="hint" style={{ padding: '0 2px 6px' }}>{t('uploadHint')}</p>
      <label className="wide-btn as-label">
        🖼️ {t('secBrowse')}
        <input type="file" accept="image/*" hidden
          onChange={(ev) => { const f = ev.target.files?.[0]; if (f) loadFile(f); ev.target.value = '' }} />
      </label>
      <Acc id="templates" icon="🗂" title={t('secTemplates')} openId={openId} setOpenId={setOpenId}>
        <TemplatesView />
      </Acc>
    </>
  )
}

// ---------------------------------------------------------------------------

const STAGE_TITLE: Record<string, TKey> = {
  upload: 'stageUpload', print: 'stagePrint', workshop: 'stageWorkshop', scan: 'stageScan', final: 'stageFinal',
}

export function RightPanel() {
  const topStage = useUi((s) => s.topStage)
  const activeId = useStore((s) => s.activeLayerId)
  const layerCount = useStore((s) => s.layerOrder.length)
  const [openId, setOpenId] = useState<string | null>(null)
  const [exportOpen, setExportOpen] = useState(false)
  const [publishOpen, setPublishOpen] = useState(false)
  const [publishBlob, setPublishBlob] = useState<Blob | null>(null)
  const [publishPreset, setPublishPreset] = useState<{ effects: Layer['effects']; seed: number } | null>(null)
  const [publishProjectSnapshot, setPublishProjectSnapshot] = useState<string | null>(null)
  const [preparingPublish, setPreparingPublish] = useState(false)
  const user = useAuth((s) => s.user)
  const openAuthModal = useAuth((s) => s.openAuthModal)
  const t = useT()

  const onPublishClick = async () => {
    if (!user) { openAuthModal(); return }
    if (preparingPublish) return
    setPreparingPublish(true)
    try {
      // Same render used by "Export -> Final image" (renderFinalImage),
      // just kept as a Blob in memory instead of triggering a download —
      // publishing and saving-to-device stay fully independent actions.
      const canvas = await renderFinalImage()
      const blob = canvas ? new Blob([await canvasToPngBytes(canvas) as BlobPart], { type: 'image/png' }) : null
      setPublishBlob(blob)
      // Snapshot the active layer's processing so viewers of the published
      // post can load this exact paper/printer/damage/scanner setup into
      // their own editor (see PostPresetChip) — same shape as a saved
      // preset (state/store.ts's SavedPreset), just without a name yet.
      const layer = activeId ? useStore.getState().layers[activeId] : null
      setPublishPreset(layer ? { effects: JSON.parse(JSON.stringify(layer.effects)), seed: layer.seed } : null)
      // Full layer snapshot (bitmaps, transforms, groups — everything
      // "Посмотреть проект" needs to reopen an editable copy laid out
      // exactly like this one) — see engine/project.ts. Stringified here
      // rather than in community.ts so this stays symmetric with publishBlob
      // above: RightPanel captures the editor-only data, community.ts just
      // uploads whatever it's handed.
      setPublishProjectSnapshot(JSON.stringify(serializePostProjectSnapshot()))
      setPublishOpen(true)
    } finally {
      setPreparingPublish(false)
    }
  }

  // Switching stages collapses everything (all sections closed by default).
  useEffect(() => { setOpenId(null) }, [topStage])

  return (
    <>
    <div className="panel inspector" onClick={() => useStore.getState().setHelp(null)}>
      <div className="stage-heading">{t(STAGE_TITLE[topStage])}</div>

      {topStage === 'upload' ? (
        <UploadPanel openId={openId} setOpenId={setOpenId} />
      ) : !activeId ? (
        <p className="hint">{t('emptyStage')}</p>
      ) : topStage === 'workshop' ? (
        <>
          <AppliedToolsStack activeId={activeId} />
          <WorkshopToolSettings activeId={activeId} />
        </>
      ) : topStage === 'print' ? (
        <PrintSettings activeId={activeId} openId={openId} setOpenId={setOpenId} />
      ) : topStage === 'scan' ? (
        <ScanSettings activeId={activeId} openId={openId} setOpenId={setOpenId} />
      ) : (
        <>
          <FinalSettings activeId={activeId} openId={openId} setOpenId={setOpenId} />
          {layerCount > 0 && (
            <div className="final-actions">
              <button className="export-btn" onClick={() => setExportOpen(true)}>
                📦 {t('exportZip')}
              </button>
              <button className="publish-btn" disabled={preparingPublish} onClick={onPublishClick}>
                🌐 {preparingPublish ? t('preparingPreview') : t('communityPublish')}
              </button>
            </div>
          )}
        </>
      )}
    </div>
    {exportOpen && <ExportModal onClose={() => setExportOpen(false)} />}
    {publishOpen && user && (
      <PublishModal
        previewBlob={publishBlob}
        onClose={() => setPublishOpen(false)}
        onPublish={async (title) => {
          await createPost(user.id, title, publishBlob, publishPreset, publishProjectSnapshot)
          setPublishOpen(false)
        }}
      />
    )}
    </>
  )
}

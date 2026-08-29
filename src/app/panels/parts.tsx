import {
  useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import { useStore } from '@/state/store'
import { useT } from '@/i18n'
import type { TKey } from '@/i18n/dict'
import type { ParamSchema } from '@/domain/params'

/** Collapsible section that remembers its open/closed state in localStorage. */
export function Section({ id, icon, titleKey, children }: {
  id: string; icon: string; titleKey: TKey; children: ReactNode
}) {
  const collapsed = useStore((s) => s.collapsed[id])
  const toggle = useStore((s) => s.toggleCollapsed)
  const t = useT()
  return (
    <div className="section">
      <button className="section-head" onClick={() => toggle(id)}>
        <span className="chev">{collapsed ? '▸' : '▾'}</span>
        <span className="sec-icon">{icon}</span>
        <span className="sec-title">{t(titleKey)}</span>
      </button>
      {!collapsed && <div className="section-body">{children}</div>}
    </div>
  )
}

/** Small ❔ button that toggles a help popover for a parameter. */
export function HelpButton({ paramKey, helpKey }: { paramKey: string; helpKey: TKey }) {
  const helpOpen = useStore((s) => s.helpKey)
  const setHelp = useStore((s) => s.setHelp)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const popoverRef = useRef<HTMLSpanElement>(null)
  const [position, setPosition] = useState<CSSProperties>({ visibility: 'hidden' })
  const t = useT()
  const open = helpOpen === paramKey

  useLayoutEffect(() => {
    if (!open) return
    const place = () => {
      const button = buttonRef.current?.getBoundingClientRect()
      const popover = popoverRef.current
      if (!button || !popover) return
      const margin = 8
      const gap = 6
      const width = Math.min(260, window.innerWidth - margin * 2)
      popover.style.width = `${width}px`
      const height = Math.min(popover.scrollHeight, window.innerHeight - margin * 2)
      const left = Math.min(
        window.innerWidth - width - margin,
        Math.max(margin, button.left + button.width / 2 - width / 2),
      )
      const fitsBelow = button.bottom + gap + height <= window.innerHeight - margin
      const top = fitsBelow
        ? button.bottom + gap
        : Math.max(margin, button.top - gap - height)
      setPosition({
        left,
        top,
        width,
        maxHeight: window.innerHeight - margin * 2,
        visibility: 'visible',
      })
    }
    place()
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => {
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
    }
  }, [open])

  return (
    <span className="help-wrap">
      <button
        ref={buttonRef}
        className="help-btn"
        onClick={(e) => { e.stopPropagation(); setHelp(open ? null : paramKey) }}
      >
        ❔
      </button>
      {open && createPortal(
        <span ref={popoverRef} className="help-pop" role="tooltip" style={position}>
          {t(helpKey)}
        </span>,
        document.body,
      )}
    </span>
  )
}

/** Auto-generated sliders from a schema, each with a help button. */
export function Sliders({ schema, values, onChange, prefix }: {
  schema: ParamSchema
  values: Record<string, number>
  onChange: (patch: Record<string, number>) => void
  prefix: string
}) {
  const t = useT()
  return (
    <>
      {schema.map((spec) => (
        <div className="slider-row" key={spec.key}>
          <label>
            <span className="lbl">
              {t(spec.labelKey)}
              <HelpButton paramKey={`${prefix}.${spec.key}`} helpKey={spec.helpKey} />
            </span>
            <span className="val">{values[spec.key]?.toFixed(2)}</span>
          </label>
          <input type="range" min={spec.min} max={spec.max} step={spec.step}
            value={values[spec.key]}
            onChange={(e) => onChange({ [spec.key]: parseFloat(e.target.value) })} />
        </div>
      ))}
    </>
  )
}

/** A slider bound to an external number (not a schema). */
export function SingleSlider({ labelKey, helpKey, paramKey, value, min, max, step, onChange, fmt }: {
  labelKey: TKey; helpKey?: TKey; paramKey: string; value: number
  min: number; max: number; step: number; onChange: (v: number) => void
  fmt?: (v: number) => string
}) {
  const t = useT()
  return (
    <div className="slider-row">
      <label>
        <span className="lbl">{t(labelKey)}{helpKey && <HelpButton paramKey={paramKey} helpKey={helpKey} />}</span>
        <span className="val">{fmt ? fmt(value) : value.toFixed(2)}</span>
      </label>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(parseFloat(e.target.value))} />
    </div>
  )
}

/** Local uncontrolled toggle used for simple show/hide. */
export function useToggle(initial = false) {
  return useState(initial)
}

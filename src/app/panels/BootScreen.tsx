import { useEffect, useRef, useState } from 'react'
import { useT, type TKey } from '@/i18n'

const TOTAL_BLOCKS = 20
const BLOCK_INTERVAL_MS = 90
const HOLD_MS = 260
const FADE_MS = 220

const STATUS_KEYS: TKey[] = ['bootStatus1', 'bootStatus2', 'bootStatus3', 'bootStatus4', 'bootStatus5']

/**
 * A Windows-98-style "boot" screen shown on every load, right at the
 * start. Purely decorative brand moment — picks one random status line and
 * holds it for the whole animation (rather than cycling), so it's short
 * and doesn't get old. Skips itself entirely under prefers-reduced-motion.
 */
export function BootScreen() {
  const t = useT()
  const [visible, setVisible] = useState(false)
  const [filled, setFilled] = useState(0)
  const [closing, setClosing] = useState(false)
  const [statusKey] = useState<TKey>(() => STATUS_KEYS[Math.floor(Math.random() * STATUS_KEYS.length)])
  const doneRef = useRef(false)

  useEffect(() => {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduceMotion) return
    setVisible(true)
  }, [])

  useEffect(() => {
    if (!visible || closing) return
    const id = window.setInterval(() => {
      setFilled((f) => {
        const next = f + 1
        if (next >= TOTAL_BLOCKS && !doneRef.current) {
          doneRef.current = true
          window.setTimeout(() => setClosing(true), HOLD_MS)
        }
        return Math.min(next, TOTAL_BLOCKS)
      })
    }, BLOCK_INTERVAL_MS)
    return () => window.clearInterval(id)
  }, [visible, closing])

  useEffect(() => {
    if (!closing) return
    const id = window.setTimeout(() => setVisible(false), FADE_MS)
    return () => window.clearTimeout(id)
  }, [closing])

  if (!visible) return null

  return (
    <div className={`boot-screen${closing ? ' boot-screen-closing' : ''}`} aria-hidden="true">
      <div className="boot-screen-scanlines" />
      <div className="boot-screen-brand">
        <span className="boot-screen-logo">NEVMA</span>
        <span className="boot-screen-version">VERSION 1.0</span>
      </div>
      <div className="boot-screen-progress">
        <div className="boot-screen-track">
          {Array.from({ length: TOTAL_BLOCKS }).map((_, i) => (
            <span key={i} className={`boot-screen-block${i < filled ? ' boot-screen-block-on' : ''}`} />
          ))}
        </div>
        <span className="boot-screen-status">{t(statusKey)}</span>
      </div>
      <span className="boot-screen-footer">nevma corporation</span>
    </div>
  )
}

import { useEffect, useRef, useState } from 'react'

const STORAGE_KEY = 'nevma-boot-seen-date'
const TOTAL_BLOCKS = 20
const BLOCK_INTERVAL_MS = 90
const HOLD_MS = 260
const FADE_MS = 220

const STATUSES = [
  'Прогреваем принтер...',
  'Заряжаем плёнку...',
  'Стряхиваем пыль со сканера...',
  'Мешаем проявитель...',
  'Точим ножницы...',
]

function shouldShowToday(): boolean {
  try {
    const today = new Date().toISOString().slice(0, 10)
    return localStorage.getItem(STORAGE_KEY) !== today
  } catch {
    // Storage unavailable (private mode, disabled cookies, etc.) — don't
    // block the app on it, just skip the boot screen entirely.
    return false
  }
}

function markShownToday() {
  try {
    localStorage.setItem(STORAGE_KEY, new Date().toISOString().slice(0, 10))
  } catch {
    // Nothing to do — it'll just show again next load, which is fine.
  }
}

/**
 * A one-shot, Windows-98-style "boot" screen shown once per day on first
 * load. Purely decorative brand moment — picks one random status line and
 * holds it for the whole animation (rather than cycling), so it's short,
 * doesn't get old, and gives people a small reason to check back tomorrow.
 * Skips itself entirely under prefers-reduced-motion.
 */
export function BootScreen() {
  const [visible, setVisible] = useState(false)
  const [filled, setFilled] = useState(0)
  const [closing, setClosing] = useState(false)
  const [statusText] = useState(() => STATUSES[Math.floor(Math.random() * STATUSES.length)])
  const doneRef = useRef(false)

  useEffect(() => {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduceMotion || !shouldShowToday()) return
    setVisible(true)
    markShownToday()
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
        <span className="boot-screen-status">{statusText}</span>
      </div>
      <span className="boot-screen-footer">nevma corporation</span>
    </div>
  )
}

import { useCallback, useEffect, useRef, useState, type MouseEvent as ReactMouseEvent, type RefObject } from 'react'

export interface Geometry {
  left: number
  top: number
  width: number
  height: number
}

const DEFAULT_WIDTH = 960
const DEFAULT_HEIGHT = 680
const DEFAULT_WIDTH_RATIO = 0.96
const DEFAULT_HEIGHT_RATIO = 0.92
const MIN_WIDTH = 360
const MIN_HEIGHT = 260

type ResizeDir = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw'

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

/**
 * Makes a floating "fake OS" window draggable (by its title bar) and
 * resizable (by its edges/corners) within a bounding container, and gives
 * back a reset so callers can snap it back to a centered default. Purely a
 * geometry/event hook — rendering the drag handle and resize edges is left
 * to the caller.
 */
export function useFloatingWindow(containerRef: RefObject<HTMLElement | null>) {
  const [geometry, setGeometry] = useState<Geometry | null>(null)
  const dragRef = useRef<{ startX: number; startY: number; origLeft: number; origTop: number } | null>(null)
  const resizeRef = useRef<{ dir: ResizeDir; startX: number; startY: number; orig: Geometry } | null>(null)

  const containerSize = useCallback((): { width: number; height: number } => {
    const rect = containerRef.current?.getBoundingClientRect()
    return rect ? { width: rect.width, height: rect.height } : { width: window.innerWidth, height: window.innerHeight }
  }, [containerRef])

  const defaultGeometry = useCallback((): Geometry => {
    const { width: cw, height: ch } = containerSize()
    const width = Math.min(DEFAULT_WIDTH, cw * DEFAULT_WIDTH_RATIO)
    const height = Math.min(DEFAULT_HEIGHT, ch * DEFAULT_HEIGHT_RATIO)
    return { left: (cw - width) / 2, top: (ch - height) / 2, width, height }
  }, [containerSize])

  const reset = useCallback(() => setGeometry(null), [])

  const ensure = useCallback((): Geometry => {
    let g = geometry
    if (!g) {
      g = defaultGeometry()
      setGeometry(g)
    }
    return g
  }, [geometry, defaultGeometry])

  // Drag ------------------------------------------------------------------

  const onDragMove = useCallback((e: MouseEvent) => {
    const d = dragRef.current
    if (!d) return
    const { width: cw } = containerSize()
    setGeometry((g) => {
      if (!g) return g
      const left = clamp(d.origLeft + (e.clientX - d.startX), -g.width + 120, cw - 120)
      const top = clamp(d.origTop + (e.clientY - d.startY), 0, window.innerHeight - 40)
      return { ...g, left, top }
    })
  }, [containerSize])

  const onDragEnd = useCallback(() => {
    dragRef.current = null
    window.removeEventListener('mousemove', onDragMove)
    window.removeEventListener('mouseup', onDragEnd)
  }, [onDragMove])

  const startDrag = useCallback((e: ReactMouseEvent) => {
    if (e.button !== 0) return
    e.preventDefault()
    const g = ensure()
    dragRef.current = { startX: e.clientX, startY: e.clientY, origLeft: g.left, origTop: g.top }
    window.addEventListener('mousemove', onDragMove)
    window.addEventListener('mouseup', onDragEnd)
  }, [ensure, onDragMove, onDragEnd])

  // Resize ------------------------------------------------------------------

  const onResizeMove = useCallback((e: MouseEvent) => {
    const r = resizeRef.current
    if (!r) return
    const dx = e.clientX - r.startX
    const dy = e.clientY - r.startY
    let { left, top, width, height } = r.orig
    if (r.dir.includes('e')) width = Math.max(MIN_WIDTH, r.orig.width + dx)
    if (r.dir.includes('s')) height = Math.max(MIN_HEIGHT, r.orig.height + dy)
    if (r.dir.includes('w')) {
      width = Math.max(MIN_WIDTH, r.orig.width - dx)
      left = r.orig.left + (r.orig.width - width)
    }
    if (r.dir.includes('n')) {
      height = Math.max(MIN_HEIGHT, r.orig.height - dy)
      top = r.orig.top + (r.orig.height - height)
    }
    setGeometry({ left, top, width, height })
  }, [])

  const onResizeEnd = useCallback(() => {
    resizeRef.current = null
    window.removeEventListener('mousemove', onResizeMove)
    window.removeEventListener('mouseup', onResizeEnd)
  }, [onResizeMove])

  const startResize = useCallback((dir: ResizeDir) => (e: ReactMouseEvent) => {
    if (e.button !== 0) return
    e.preventDefault()
    e.stopPropagation()
    const g = ensure()
    resizeRef.current = { dir, startX: e.clientX, startY: e.clientY, orig: g }
    window.addEventListener('mousemove', onResizeMove)
    window.addEventListener('mouseup', onResizeEnd)
  }, [ensure, onResizeMove, onResizeEnd])

  // Cleanup any listeners left dangling if the window unmounts mid-drag.
  useEffect(() => () => {
    window.removeEventListener('mousemove', onDragMove)
    window.removeEventListener('mouseup', onDragEnd)
    window.removeEventListener('mousemove', onResizeMove)
    window.removeEventListener('mouseup', onResizeEnd)
  }, [onDragMove, onDragEnd, onResizeMove, onResizeEnd])

  return { geometry, reset, startDrag, startResize }
}

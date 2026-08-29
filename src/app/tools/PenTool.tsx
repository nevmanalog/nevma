import { useEffect, useRef, useState } from 'react'
import { Line, Path, Circle, Group } from 'react-konva'
import type Konva from 'konva'

interface Props {
  // Fired automatically when the contour closes. Receives SCREEN-space points.
  onClose: (stagePoints: number[]) => void
}

// A single anchor with optional in/out bezier handles (absolute world coords).
interface Node {
  x: number
  y: number
  hIn: { x: number; y: number } | null
  hOut: { x: number; y: number } | null
}

type Drag =
  | { type: 'new'; index: number }
  | { type: 'anchor'; index: number }
  | { type: 'handleOut'; index: number }
  | { type: 'handleIn'; index: number }
  | null

const CLOSE_PX = 18   // screen px: how near a click must land on the first anchor to close
const HANDLE_PX = 9   // screen px: hit radius for grabbing a handle
const ANCHOR_PX = 9   // screen px: hit radius for grabbing an anchor
const SEG_STEPS = 24  // bezier samples per segment when turning the path into a polygon

const cpOut = (n: Node) => n.hOut ?? { x: n.x, y: n.y }
const cpIn = (n: Node) => n.hIn ?? { x: n.x, y: n.y }

// Cubic bezier point at t.
function cubic(p0: { x: number; y: number }, p1: { x: number; y: number }, p2: { x: number; y: number }, p3: { x: number; y: number }, t: number) {
  const u = 1 - t
  const a = u * u * u, b = 3 * u * u * t, c = 3 * u * t * t, d = t * t * t
  return { x: a * p0.x + b * p1.x + c * p2.x + d * p3.x, y: a * p0.y + b * p1.y + c * p2.y + d * p3.y }
}

/**
 * Photoshop-style Pen tool with AUTOMATIC cut on close.
 * - Click to drop a corner anchor.
 * - Click-drag to drop a smooth anchor (drags out mirrored bezier handles).
 * - Drag an anchor to move it; drag a handle to reshape the curve (mirrored).
 * - Double-click an anchor to delete it.
 * - Click the first anchor to close the contour — the cut fires immediately.
 */
export function PenTool({ onClose }: Props) {
  const [nodes, setNodes] = useState<Node[]>([])
  // Mirrors `nodes` synchronously. Konva dispatches its events straight to
  // whatever handler is currently attached, without waiting for React to
  // finish a render/commit cycle. On a fast pen/stylus two pointerdowns can
  // land close enough together that the closure captured by the *previous*
  // render's handleDown is still the one attached when the closing click
  // arrives — so that click would be tested against a `nodes` snapshot that
  // is missing the just-placed anchor, and the click meant to land on the
  // very first point of a small/fast shape can miss. Reading from this ref
  // instead of the closed-over state guarantees we always test against the
  // latest anchors.
  const nodesRef = useRef<Node[]>([])
  nodesRef.current = nodes
  const dragRef = useRef<Drag>(null)
  const firedRef = useRef(false)
  // Touch has no dblclick, so a second tap landing near the same spot within
  // this window is treated as a double-tap (mirrors onDblClick below).
  const lastTapRef = useRef<{ t: number; x: number; y: number } | null>(null)
  const DOUBLE_TAP_MS = 350

  const world = (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    const stage = e.target.getStage()!
    const screen = stage.getPointerPosition()!
    const p = stage.getAbsoluteTransform().copy().invert().point(screen)
    return { p, stage, scale: stage.scaleX() || 1 }
  }

  const reset = () => { setNodes([]); dragRef.current = null; firedRef.current = false }

  // Hotkey: Backspace / Delete removes the last placed anchor (undo last point).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      if (e.key === 'Backspace' || e.key === 'Delete') {
        e.preventDefault()
        dragRef.current = null
        firedRef.current = false
        setNodes((prev) => prev.slice(0, -1))
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // Build the open path string that we render while editing.
  const pathData = (ns: Node[]): string => {
    if (ns.length === 0) return ''
    let d = `M ${ns[0].x} ${ns[0].y}`
    for (let i = 1; i < ns.length; i++) {
      const c1 = cpOut(ns[i - 1]), c2 = cpIn(ns[i])
      d += ` C ${c1.x} ${c1.y} ${c2.x} ${c2.y} ${ns[i].x} ${ns[i].y}`
    }
    return d
  }

  // Sample the closed contour into a dense polygon, then map to screen space.
  const fire = (stage: Konva.Stage, ns: Node[]) => {
    if (firedRef.current || ns.length < 3) return
    firedRef.current = true
    const tf = stage.getAbsoluteTransform()
    const out: number[] = []
    const pushPt = (wp: { x: number; y: number }) => { const s = tf.point(wp); out.push(s.x, s.y) }
    for (let i = 0; i < ns.length; i++) {
      const a = ns[i], b = ns[(i + 1) % ns.length]
      const p1 = cpOut(a), p2 = cpIn(b)
      for (let s = 1; s <= SEG_STEPS; s++) pushPt(cubic(a, p1, p2, b, s / SEG_STEPS))
    }
    onClose(out)
    reset()
  }

  // Shared by mouse and touch: place/grab an anchor or handle. `deleteHit`
  // (true for a touch double-tap, mirroring onDblClick) removes the anchor
  // under the tap instead of starting a drag.
  const handleDown = (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>, deleteHit = false) => {
    const { p, stage, scale } = world(e)
    const tol = (px: number) => px / scale
    const near = (ax: number, ay: number, r: number) => (p.x - ax) ** 2 + (p.y - ay) ** 2 <= r * r
    const nodes = nodesRef.current

    if (deleteHit) {
      const dtol = ANCHOR_PX / scale
      for (let i = 0; i < nodes.length; i++) {
        if ((p.x - nodes[i].x) ** 2 + (p.y - nodes[i].y) ** 2 <= dtol * dtol) {
          setNodes((prev) => prev.filter((_, idx) => idx !== i))
          dragRef.current = null
          return
        }
      }
    }

    // 1) click on the first anchor closes the contour — checked first so a
    // closing click always wins, even if the start anchor also happens to
    // carry a handle nearby.
    if (nodes.length >= 3 && near(nodes[0].x, nodes[0].y, tol(CLOSE_PX))) { fire(stage, nodes); return }

    // 2) handles take priority so they stay grabbable on top of anchors
    for (let i = 0; i < nodes.length; i++) {
      const n = nodes[i]
      if (n.hOut && near(n.hOut.x, n.hOut.y, tol(HANDLE_PX))) { dragRef.current = { type: 'handleOut', index: i }; return }
      if (n.hIn && near(n.hIn.x, n.hIn.y, tol(HANDLE_PX))) { dragRef.current = { type: 'handleIn', index: i }; return }
    }

    // 3) click on an existing anchor -> move it
    for (let i = 0; i < nodes.length; i++) {
      if (near(nodes[i].x, nodes[i].y, tol(ANCHOR_PX))) { dragRef.current = { type: 'anchor', index: i }; return }
    }

    // 4) empty space -> add a new anchor (corner; becomes smooth if the user drags)
    setNodes((prev) => {
      const next = [...prev, { x: p.x, y: p.y, hIn: null, hOut: null }]
      dragRef.current = { type: 'new', index: next.length - 1 }
      return next
    })
  }

  const onMouseDown = (e: Konva.KonvaEventObject<MouseEvent>) => {
    if (e.evt.button !== 0) return
    handleDown(e)
  }

  const onMouseMove = (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    const d = dragRef.current
    if (!d) return
    const { p } = world(e)
    setNodes((prev) => {
      const next = prev.map((n) => ({ ...n }))
      const n = next[d.index]
      if (!n) return prev
      if (d.type === 'anchor') {
        const dx = p.x - n.x, dy = p.y - n.y
        n.x = p.x; n.y = p.y
        if (n.hIn) n.hIn = { x: n.hIn.x + dx, y: n.hIn.y + dy }
        if (n.hOut) n.hOut = { x: n.hOut.x + dx, y: n.hOut.y + dy }
      } else if (d.type === 'new' || d.type === 'handleOut') {
        n.hOut = { x: p.x, y: p.y }
        n.hIn = { x: 2 * n.x - p.x, y: 2 * n.y - p.y } // mirror for a smooth point
      } else if (d.type === 'handleIn') {
        n.hIn = { x: p.x, y: p.y }
        n.hOut = { x: 2 * n.x - p.x, y: 2 * n.y - p.y }
      }
      return next
    })
  }

  const onMouseUp = () => { dragRef.current = null }

  const onDblClick = (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    const { p, scale } = world(e)
    const tol = ANCHOR_PX / scale
    const nodes = nodesRef.current
    for (let i = 0; i < nodes.length; i++) {
      if ((p.x - nodes[i].x) ** 2 + (p.y - nodes[i].y) ** 2 <= tol * tol) {
        e.evt.preventDefault()
        setNodes((prev) => prev.filter((_, idx) => idx !== i))
        dragRef.current = null
        return
      }
    }
  }

  const onTouchStart = (e: Konva.KonvaEventObject<TouchEvent>) => {
    if (e.evt.touches.length !== 1) return
    e.evt.preventDefault()
    const touch = e.evt.touches[0]
    const now = performance.now()
    const last = lastTapRef.current
    const isDoubleTap = !!last && now - last.t < DOUBLE_TAP_MS
      && Math.hypot(touch.clientX - last.x, touch.clientY - last.y) < 24
    lastTapRef.current = { t: now, x: touch.clientX, y: touch.clientY }
    handleDown(e, isDoubleTap)
  }
  const onTouchMove = (e: Konva.KonvaEventObject<TouchEvent>) => {
    if (e.evt.touches.length !== 1) return
    e.evt.preventDefault()
    onMouseMove(e)
  }
  const onTouchEnd = () => { dragRef.current = null }

  return (
    <Group
      onMouseDown={onMouseDown} onMouseMove={onMouseMove} onMouseUp={onMouseUp} onDblClick={onDblClick}
      onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd} onTouchCancel={onTouchEnd}
    >
      {/* transparent catcher covering any pan/zoom range */}
      <Line points={[-100000, -100000, 100000, -100000, 100000, 100000, -100000, 100000]}
        closed fill="rgba(0,0,0,0.001)" />

      {/* dashed preview of the segment that will close the loop */}
      {nodes.length >= 2 && (
        <Line points={[nodes[nodes.length - 1].x, nodes[nodes.length - 1].y, nodes[0].x, nodes[0].y]}
          stroke="#e0913f" strokeWidth={1} dash={[4, 4]} opacity={0.5} />
      )}

      {/* the bezier contour so far */}
      {nodes.length >= 1 && (
        <Path data={pathData(nodes)} stroke="#e0913f" strokeWidth={1.5} />
      )}

      {/* handles (lines + dots) */}
      {nodes.map((n, i) => (
        <Group key={`h${i}`}>
          {n.hIn && <>
            <Line points={[n.x, n.y, n.hIn.x, n.hIn.y]} stroke="#7fbfff" strokeWidth={1} />
            <Circle x={n.hIn.x} y={n.hIn.y} radius={3.5} fill="#16161a" stroke="#7fbfff" strokeWidth={1.5} />
          </>}
          {n.hOut && <>
            <Line points={[n.x, n.y, n.hOut.x, n.hOut.y]} stroke="#7fbfff" strokeWidth={1} />
            <Circle x={n.hOut.x} y={n.hOut.y} radius={3.5} fill="#16161a" stroke="#7fbfff" strokeWidth={1.5} />
          </>}
        </Group>
      ))}

      {/* anchors; the first is highlighted as the close target */}
      {nodes.map((n, i) => (
        <Circle key={`a${i}`} x={n.x} y={n.y} radius={i === 0 && nodes.length >= 3 ? 6 : 4}
          fill={i === 0 ? '#e0913f' : '#16161a'} stroke="#e0913f" strokeWidth={1.5} />
      ))}
    </Group>
  )
}

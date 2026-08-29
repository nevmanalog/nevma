import { useRef, useState, type RefObject } from 'react'
import { Line, Group, Circle, Rect } from 'react-konva'
import type Konva from 'konva'
import type { ToolCursor } from '@/engine/tools/core/contracts'

interface Props {
  // Fired on release with the recorded SCREEN-space stroke points.
  onStroke: (stagePoints: number[], elapsedMs: number) => void
  cursor: ToolCursor
  // True while a navigation gesture (space-drag pan) owns the pointer; the
  // physical tool must not draw at the same time.
  navGesture: RefObject<boolean>
}

/**
 * Pointer input for physical tools. Press and drag to lay down a stroke; on
 * release the whole stroke is committed as one ordered, undoable operation.
 * A single click (no drag) commits a one-point stroke (used by pins etc.).
 * The hover cursor mirrors the active engine's own impact footprint.
 */
export function PhysicalToolInput({ onStroke, cursor: cursorSpec, navGesture }: Props) {
  const [preview, setPreview] = useState<number[]>([])
  const [hover, setHover] = useState<{ x: number; y: number } | null>(null)
  const screenRef = useRef<number[]>([])
  const drawingRef = useRef(false)
  const startedAtRef = useRef(0)
  const { radius, length, width, angle, color } = cursorSpec

  const coords = (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    const stage = e.target.getStage()!
    const s = stage.getPointerPosition()!
    return { s: [s.x, s.y], world: stage.getAbsoluteTransform().copy().invert().point(s) }
  }

  const begin = (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    const { s, world } = coords(e)
    drawingRef.current = true
    startedAtRef.current = performance.now()
    screenRef.current = [...s]
    setPreview([world.x, world.y])
  }

  const move = (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    const { s, world } = coords(e)
    setHover({ x: world.x, y: world.y })
    if (!drawingRef.current) return
    const sp = screenRef.current
    if (sp.length >= 2) {
      const dx = s[0] - sp[sp.length - 2]
      const dy = s[1] - sp[sp.length - 1]
      if (dx * dx + dy * dy < 9) return
    }
    screenRef.current = [...sp, s[0], s[1]]
    setPreview((prev) => [...prev, world.x, world.y])
  }

  const fire = () => {
    const pts = screenRef.current
    if (pts.length >= 2) onStroke([...pts], Math.max(1, performance.now() - startedAtRef.current))
    screenRef.current = []
    drawingRef.current = false
    setPreview([])
  }

  const renderCursor = (x: number, y: number) => {
    const c = color
    switch (cursorSpec.kind) {
      case 'pad':
        return <Rect x={x} y={y} width={length * 2} height={width * 2}
          offsetX={length} offsetY={width} rotation={angle} cornerRadius={radius * 0.3}
          stroke={c} strokeWidth={1} dash={[4, 4]} listening={false} />
      case 'sheet':
        return <Rect x={x} y={y} width={length * 2} height={width * 2}
          offsetX={length} offsetY={width} rotation={angle}
          stroke={c} strokeWidth={1} dash={[4, 4]} listening={false} />
      case 'band':
        return <Rect x={x} y={y} width={length * 2} height={width * 2}
          offsetX={length} offsetY={width} rotation={angle}
          stroke={c} strokeWidth={1} dash={[4, 4]} listening={false} />
      case 'chisel':
        return <Rect x={x} y={y} width={length * 2} height={Math.max(2, width * 2)}
          offsetX={length} offsetY={Math.max(1, width)} rotation={angle}
          stroke={c} strokeWidth={1} listening={false} />
      case 'wedge':
        return <Rect x={x} y={y} width={length * 2} height={width * 2}
          offsetX={length} offsetY={width} rotation={angle} cornerRadius={radius * 0.25}
          stroke={c} strokeWidth={1} dash={[4, 4]} listening={false} />
      case 'pencil':
        return (
          <Group listening={false}>
            <Circle x={x} y={y} radius={Math.max(1, radius * 0.5)} stroke={c} strokeWidth={1} dash={[3, 3]} />
            <Line points={[x, y, x + radius * 1.1, y - radius * 1.1, x + radius * 1.5, y - radius * 0.7]}
              closed stroke={c} strokeWidth={1} fill="rgba(224,145,63,0.15)" />
          </Group>
        )
      case 'bristle':
        return (
          <Group listening={false} x={x} y={y} rotation={angle}>
            <Circle radius={width} stroke={c} strokeWidth={1} dash={[3, 4]} />
            {[-0.6, -0.3, 0, 0.3, 0.6].map((o, k) => (
              <Line key={k} points={[-width, width * o, width, width * o]}
                stroke={c} strokeWidth={0.75} opacity={0.7} />
            ))}
          </Group>
        )
      case 'dots':
        return (
          <Group listening={false}>
            <Circle x={x} y={y} radius={radius} stroke={c} strokeWidth={1} dash={[3, 5]} />
            <Circle x={x - radius * 0.4} y={y - radius * 0.3} radius={radius * 0.12} fill={c} />
            <Circle x={x + radius * 0.35} y={y + radius * 0.25} radius={radius * 0.1} fill={c} />
            <Circle x={x + radius * 0.1} y={y - radius * 0.45} radius={radius * 0.08} fill={c} />
          </Group>
        )
      case 'cross':
        return (
          <Group listening={false}>
            <Line points={[x - length, y, x + length, y]} stroke={c} strokeWidth={1} />
            <Line points={[x, y - width, x, y + width]} stroke={c} strokeWidth={1} />
            <Circle x={x} y={y} radius={Math.max(1.5, radius * 0.16)} stroke={c} strokeWidth={1} />
          </Group>
        )
      default:
        return <Circle x={x} y={y} radius={radius} stroke={c} strokeWidth={1} dash={[4, 4]} listening={false} />
    }
  }

  return (
    <Group
      onMouseDown={(e) => {
        // Only the left button draws, and never while a pan gesture owns the
        // pointer — otherwise the sheet would be painted and panned at once.
        if (e.evt.button !== 0 || navGesture.current) return
        begin(e)
      }}
      onMouseMove={(e) => { move(e) }}
      onMouseUp={() => { if (drawingRef.current) fire() }}
      onMouseLeave={() => { if (drawingRef.current) fire(); setHover(null) }}
      onTouchStart={(e) => {
        // A single finger draws; a second finger hands off to the stage's
        // pinch-zoom/pan, so a stroke already underway is committed instead
        // of continuing under two fingers.
        if (navGesture.current) return
        if (e.evt.touches.length !== 1) { if (drawingRef.current) fire(); return }
        e.evt.preventDefault()
        begin(e)
      }}
      onTouchMove={(e) => {
        if (e.evt.touches.length !== 1) { if (drawingRef.current) fire(); return }
        e.evt.preventDefault()
        move(e)
      }}
      onTouchEnd={() => { if (drawingRef.current) fire(); setHover(null) }}
      onTouchCancel={() => { if (drawingRef.current) fire(); setHover(null) }}
    >
      {/* transparent catcher covering any pan/zoom range */}
      <Line points={[-100000, -100000, 100000, -100000, 100000, 100000, -100000, 100000]}
        closed fill="rgba(0,0,0,0.001)" />
      {cursorSpec.kind === 'sheet' && preview.length >= 4 ? (() => {
        const startX = preview[0]
        const startY = preview[1]
        const endX = preview[preview.length - 2]
        const endY = preview[preview.length - 1]
        const dx = endX - startX
        const dy = endY - startY
        const distance = Math.hypot(dx, dy)
        const halfLength = distance > 2 ? Math.max(2, distance * 0.5) : length
        return (
          <Rect
            x={(startX + endX) * 0.5}
            y={(startY + endY) * 0.5}
            width={halfLength * 2}
            height={width * 2}
            offsetX={halfLength}
            offsetY={width}
            rotation={distance > 2 ? Math.atan2(dy, dx) * 180 / Math.PI : angle}
            stroke={color}
            strokeWidth={1.5}
            dash={[5, 4]}
            opacity={0.65}
            listening={false}
          />
        )
      })() : preview.length >= 4 && (
        <Line points={preview} stroke={color} strokeWidth={1.5} opacity={0.5}
          lineCap="round" lineJoin="round" />
      )}
      {hover && renderCursor(hover.x, hover.y)}
    </Group>
  )
}

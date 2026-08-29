import { useRef, useState } from 'react'
import { Line, Group } from 'react-konva'
import type Konva from 'konva'

interface Props {
  // Fired automatically when the shape closes. Receives SCREEN-space points.
  onClose: (stagePoints: number[]) => void
}

const CLOSE_DIST = 18 // screen px: how near the pointer must get to the start to auto-close

/**
 * Freeform lasso with AUTOMATIC cut — no confirm button.
 * - Press and drag to draw.
 * - The cut fires when either:
 *     (a) you drag back near the start point (loop closes), or
 *     (b) you release the mouse (the path auto-closes to the start).
 */
export function LassoTool({ onClose }: Props) {
  const [localPoints, setLocalPoints] = useState<number[]>([])
  const screenRef = useRef<number[]>([])
  const drawingRef = useRef(false)
  const firedRef = useRef(false)

  const coords = (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    const stage = e.target.getStage()!
    const screen = stage.getPointerPosition()!
    const local = stage.getAbsoluteTransform().copy().invert().point(screen)
    return { screen: [screen.x, screen.y], local: [local.x, local.y] }
  }

  const reset = () => {
    setLocalPoints([])
    screenRef.current = []
    drawingRef.current = false
    firedRef.current = false
  }

  const begin = (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    reset()
    const { screen, local } = coords(e)
    drawingRef.current = true
    screenRef.current = [...screen]
    setLocalPoints([...local])
  }

  const drag = (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    if (!drawingRef.current) return
    const { screen, local } = coords(e)
    const sp = screenRef.current
    const n = localPoints.length
    if (n >= 2) {
      const dx = local[0] - localPoints[n - 2]
      const dy = local[1] - localPoints[n - 1]
      if (dx * dx + dy * dy < 12) return
    }
    screenRef.current = [...sp, screen[0], screen[1]]
    setLocalPoints((prev) => [...prev, local[0], local[1]])

    // auto-close when we return near the start after enough travel
    if (sp.length >= 12) {
      const ddx = screen[0] - sp[0]
      const ddy = screen[1] - sp[1]
      if (ddx * ddx + ddy * ddy < CLOSE_DIST * CLOSE_DIST) fire()
    }
  }

  const fire = () => {
    if (firedRef.current) return
    const pts = screenRef.current
    if (pts.length >= 6) {
      firedRef.current = true
      onClose([...pts])
    }
    reset()
  }

  return (
    <Group
      onMouseDown={(e) => { begin(e) }}
      onMouseMove={(e) => { drag(e) }}
      onMouseUp={() => {
        drawingRef.current = false
        fire() // release auto-closes the loop and cuts
      }}
      onTouchStart={(e) => {
        if (e.evt.touches.length !== 1) return
        e.evt.preventDefault()
        begin(e)
      }}
      onTouchMove={(e) => {
        if (e.evt.touches.length !== 1) { if (drawingRef.current) { drawingRef.current = false; fire() }; return }
        e.evt.preventDefault()
        drag(e)
      }}
      onTouchEnd={() => {
        drawingRef.current = false
        fire() // lifting the finger auto-closes the loop and cuts
      }}
    >
      {/* transparent catcher covering any pan/zoom range */}
      <Line points={[-100000, -100000, 100000, -100000, 100000, 100000, -100000, 100000]}
        closed fill="rgba(0,0,0,0.001)" />
      {localPoints.length >= 4 && (
        <Line points={localPoints} closed
          stroke="#e0913f" strokeWidth={1.5} dash={[6, 4]}
          fill="rgba(224,145,63,0.15)" />
      )}
    </Group>
  )
}

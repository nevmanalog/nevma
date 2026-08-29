import { useEffect, useRef, useState } from 'react'
import { Stage, Layer as KLayer, Image as KImage, Rect, Transformer } from 'react-konva'
import Konva from 'konva'
import { useStore, sourceBitmaps, originalBitmaps, sheetOps } from '@/state/store'
import { useUi } from '@/state/ui'
import { bakeBase } from '@/engine/gl/bakeAsync'
import { renderLayerCached, dropLayerCache, getCachedMaterialState } from '@/engine/sheet/cache'
import { cutSelection } from '@/engine/cut'
import { LassoTool } from './tools/LassoTool'
import { PenTool } from './tools/PenTool'
import { PhysicalToolInput } from './tools/PhysicalToolInput'
import { useT } from '@/i18n'
import { getPhysicalToolEngine, effectiveOps } from '@/engine/tools/registry'
import { referenceDevelopment } from '@/engine/reference/development'
import type { SheetOp } from '@/domain/types'
import { snapAndClampPosition, layerContainsPoint } from '@/shared/bounds'
import { loadImageFile } from '@/shared/loadImage'

// Screen-space snap distance (px) — converted to document units per layer by
// dividing by the current zoom, so snapping feels consistent at any zoom.
const SNAP_PX = 8

function LayerNode({ id }: { id: string }) {
  const layer = useStore((s) => s.layers[id])
  const token = useStore((s) => s.bakeToken[id])
  const showOriginal = useUi((s) => s.showOriginal)
  const activeTool = useStore((s) => s.activeTool)
  const activeId = useStore((s) => s.activeLayerId)
  const lockAspect = useStore((s) => s.lockAspect)
  const setActive = useStore((s) => s.setActiveLayer)
  const commitTransform = useStore((s) => s.commitTransform)
  const doc = useStore((s) => s.doc)
  const viewportScale = useStore((s) => s.viewport.scale)
  const setDragGuides = useUi((s) => s.setDragGuides)
  const beforeTransform = useRef(layer?.transform)

  const [baked, setBaked] = useState<HTMLCanvasElement | null>(null)
  const imgRef = useRef<Konva.Image>(null)
  const trRef = useRef<Konva.Transformer>(null)

  useEffect(() => {
    const src = sourceBitmaps.get(id)
    if (!src || !layer) return
    let cancelled = false
    const h = setTimeout(() => {
      // Materialize through the incremental cache: the printed base + aged
      // material baseline are reused unless effects/seed/source change, and a
      // new stroke only replays the appended op and recomposites its region.
      // The heavy full rebuilds run off the main thread (worker pool), so this
      // resolves asynchronously; incremental strokes resolve synchronously.
      const ops = effectiveOps(sheetOps.get(id) ?? [])
      renderLayerCached(
        id, src, layer.effects, layer.seed, layer.width, layer.height, ops,
        () => bakeBase({
          source: src, width: layer.width, height: layer.height,
          effects: layer.effects, seed: layer.seed,
        }),
      ).then((out) => {
        if (cancelled) return
        // The cache reuses one output canvas across incremental updates, so its
        // reference is stable; set it once, then force Konva to redraw the pixels.
        setBaked((prev) => (prev === out ? prev : out))
        imgRef.current?.getLayer()?.batchDraw()
      }).catch(() => { /* stale/cancelled render */ })
    }, 50)
    return () => { cancelled = true; clearTimeout(h) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, token])

  // Free the layer's cached buffers when the node unmounts.
  useEffect(() => () => dropLayerCache(id), [id])

  const locked = !!layer?.locked
  const selectable = activeTool === 'select'
  const editable = selectable && !locked

  useEffect(() => {
    const tr = trRef.current
    if (!tr) return
    if (activeId === id && editable && imgRef.current) tr.nodes([imgRef.current])
    else tr.nodes([])
    tr.getLayer()?.batchDraw()
  }, [activeId, id, editable, baked])

  // Layer may vanish (undo/delete) before this node unmounts.
  if (!layer || !layer.visible || !baked) return null

  // Hold-to-preview: swap the shown source to the pristine loaded original.
  // Already-decoded bitmap, so the switch is instant with no re-render or
  // effect recompute; falls back to the processed output if unavailable.
  const displayImage = (showOriginal ? originalBitmaps.get(id) : null) ?? baked

  return (
    <>
      <KImage
        ref={imgRef}
        image={displayImage}
        x={layer.transform.x} y={layer.transform.y}
        scaleX={layer.transform.scaleX} scaleY={layer.transform.scaleY}
        rotation={layer.transform.rotation}
        draggable={editable}
        shadowColor="#000"
        shadowBlur={layer.kind === 'fragment' ? 22 : 0}
        shadowOpacity={layer.kind === 'fragment' ? 0.55 : 0}
        shadowOffsetX={layer.kind === 'fragment' ? 8 : 0}
        shadowOffsetY={layer.kind === 'fragment' ? 12 : 0}
        onMouseDown={() => selectable && setActive(id)}
        onTap={() => selectable && setActive(id)}
        onDragStart={() => { beforeTransform.current = { ...layer.transform } }}
        onDragMove={(ev) => {
          // Snap to the canvas' center lines/edges, like Photoshop's smart
          // guides. Cut fragments are also kept fully on the canvas as they
          // drag; regular image layers are left free to hang off the edge
          // (use the align bar to line them back up).
          if (!doc) return
          const n = ev.target
          const threshold = SNAP_PX / Math.max(0.0001, viewportScale)
          const isFragment = layer.kind === 'fragment'
          const { x, y, guides } = snapAndClampPosition(
            n.x(), n.y(), layer.width, layer.height, n.rotation(),
            n.scaleX(), n.scaleY(), doc.width, doc.height, threshold,
            isFragment,
          )
          n.x(x); n.y(y)
          setDragGuides(guides)
        }}
        onDragEnd={(ev) => {
          const before = beforeTransform.current ?? layer.transform
          // commitTransform is the single source of truth for clamping: it
          // pulls cut fragments fully back onto the canvas and leaves image
          // layers free to hang off the edge.
          commitTransform(id, before, { ...before, x: ev.target.x(), y: ev.target.y() })
          setDragGuides({ x: null, y: null })
        }}
        onTransformStart={() => { beforeTransform.current = { ...layer.transform } }}
        onTransformEnd={(ev) => {
          const n = ev.target
          const before = beforeTransform.current ?? layer.transform
          const after = { x: n.x(), y: n.y(), scaleX: n.scaleX(), scaleY: n.scaleY(), rotation: n.rotation() }
          commitTransform(id, before, after)
        }}
      />
      <Transformer ref={trRef} rotateEnabled keepRatio={lockAspect}
        anchorStroke="#e0913f" anchorFill="#16161a" borderStroke="#e0913f" />
    </>
  )
}

function AlignIcon({ kind }: { kind: 'left' | 'centerH' | 'right' | 'top' | 'centerV' | 'bottom' }) {
  // A canvas outline with a small solid square showing where the layer
  // lands — much clearer at a glance than the old glyph combos, and every
  // shape here is plain rects so it renders identically everywhere.
  const rects: Record<typeof kind, { x: number; y: number }> = {
    left: { x: 1, y: 4.5 },
    centerH: { x: 4.5, y: 4.5 },
    right: { x: 8, y: 4.5 },
    top: { x: 4.5, y: 1 },
    centerV: { x: 4.5, y: 4.5 },
    bottom: { x: 4.5, y: 8 },
  }
  const r = rects[kind]
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <rect x="1" y="1" width="12" height="12" rx="0.5" stroke="currentColor" strokeWidth="1.1" opacity="0.55" />
      <rect x={r.x} y={r.y} width="4.5" height="4.5" rx="0.5" fill="currentColor" />
    </svg>
  )
}

export function Viewport() {
  const layerOrder = useStore((s) => s.layerOrder)
  const activeTool = useStore((s) => s.activeTool)
  const activeId = useStore((s) => s.activeLayerId)
  const layerGroups = useStore((s) => s.layerGroups)
  const edgeStyle = useStore((s) => s.edgeStyle)
  const layers = useStore((s) => s.layers)
  const cutMode = useStore((s) => s.cutMode)
  const viewport = useStore((s) => s.viewport)
  const setViewport = useStore((s) => s.setViewport)
  const doc = useStore((s) => s.doc)
  const fitRequest = useStore((s) => s.fitRequest)
  const addImageLayer = useStore((s) => s.addImageLayer)
  const commitCut = useStore((s) => s.commitCut)
  const addSheetOps = useStore((s) => s.addSheetOps)
  const setActive = useStore((s) => s.setActiveLayer)
  const setTool = useStore((s) => s.setTool)
  const bump = useStore((s) => s.bump)
  const toolParameters = useUi((s) => s.toolParameters)
  const workshopTool = useUi((s) => s.workshopTool)
  const dragGuides = useUi((s) => s.dragGuides)
  const alignLayer = useStore((s) => s.alignLayer)
  const fitLayerToCanvas = useStore((s) => s.fitLayerToCanvas)
  const fillLayerToCanvas = useStore((s) => s.fillLayerToCanvas)
  const cropLayerToCanvas = useStore((s) => s.cropLayerToCanvas)
  const t = useT()

  const [size, setSize] = useState({ w: 800, h: 600 })
  const [dragOver, setDragOver] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)
  const stageRef = useRef<Konva.Stage>(null)
  const spaceRef = useRef(false)
  const panRef = useRef<{ active: boolean; sx: number; sy: number; ox: number; oy: number }>({ active: false, sx: 0, sy: 0, ox: 0, oy: 0 })
  // Two-finger touch gesture state: pinch-to-zoom combined with two-finger pan,
  // the standard mobile equivalent of scroll-wheel zoom + middle-mouse pan.
  const pinchRef = useRef<{ dist: number; cx: number; cy: number } | null>(null)

  useEffect(() => {
    const measure = () => { const el = wrapRef.current; if (el) setSize({ w: el.clientWidth, h: el.clientHeight }) }
    measure()
    const ro = new ResizeObserver(measure)
    if (wrapRef.current) ro.observe(wrapRef.current)
    window.addEventListener('resize', measure)
    return () => { ro.disconnect(); window.removeEventListener('resize', measure) }
  }, [])

  useEffect(() => referenceDevelopment.subscribe(() => {
    for (const id of useStore.getState().layerOrder) bump(id)
  }), [bump])

  // Fit a freshly created document to the viewport (once per creation). Loading
  // a project does not bump fitRequest, so the saved viewport is preserved.
  const lastFit = useRef(0)
  useEffect(() => {
    if (fitRequest === lastFit.current) return
    if (!doc || size.w < 2 || size.h < 2) return
    lastFit.current = fitRequest
    const scale = Math.min(8, Math.max(0.1, Math.min(size.w / doc.width, size.h / doc.height) * 0.9))
    setViewport({ scale, x: (size.w - doc.width * scale) / 2, y: (size.h - doc.height * scale) / 2 })
  }, [fitRequest, doc, size.w, size.h, setViewport])

  // space bar for pan
  useEffect(() => {
    const down = (e: KeyboardEvent) => { if (e.code === 'Space' && !(e.target as HTMLElement)?.matches('input,textarea')) { spaceRef.current = true } }
    const up = (e: KeyboardEvent) => { if (e.code === 'Space') spaceRef.current = false }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up) }
  }, [])

  const loadFile = (file: File) => {
    loadImageFile(file, (source, w, h) => addImageLayer(source, w, h))
  }
  const onDrop = (ev: React.DragEvent) => {
    ev.preventDefault(); setDragOver(false)
    const file = Array.from(ev.dataTransfer.files).find((f) => f.type.startsWith('image/'))
    if (file) loadFile(file)
  }

  // Topmost visible, unlocked layer whose (rotation-aware) rectangle
  // contains the given document-space point, or null if none does. Locked
  // layers are skipped — double-clicking one wouldn't let you move it — so a
  // movable layer underneath can still be reached.
  const pickLayerAt = (x: number, y: number): string | null => {
    for (let i = layerOrder.length - 1; i >= 0; i--) {
      const id = layerOrder[i]
      const layer = layers[id]
      if (!layer || !layer.visible || layer.locked) continue
      if (layerContainsPoint(layer.transform, layer.width, layer.height, x, y)) return id
    }
    return null
  }

  // Double-click/double-tap anywhere on the canvas: jump straight to the
  // select tool with the layer under the cursor active and ready to drag —
  // a quick way to grab a layer without reaching for the toolbar first.
  // Exception: while a physical tool (pencil, pins, knife, etc.) is in hand,
  // fast repeated dabs/clicks are a normal way to use that tool, and the
  // browser can mistake two of them in quick succession for a double-click.
  // Bailing out here keeps the tool in hand instead of silently swapping to
  // the select tool and grabbing a layer mid-stroke.
  const onDblClickCanvas = () => {
    if (activeTool === 'brush') return
    const stage = stageRef.current
    const screen = stage?.getPointerPosition()
    if (!stage || !screen) return
    const p = stage.getAbsoluteTransform().copy().invert().point(screen)
    const id = pickLayerAt(p.x, p.y)
    if (id) {
      setTool('select')
      setActive(id)
    }
  }

  const zoomAt = (factor: number, cx: number, cy: number) => {
    const old = viewport.scale
    const ns = Math.min(8, Math.max(0.1, old * factor))
    const wx = (cx - viewport.x) / old
    const wy = (cy - viewport.y) / old
    setViewport({ scale: ns, x: cx - wx * ns, y: cy - wy * ns })
  }
  const onWheel = (e: Konva.KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault()
    const pos = stageRef.current?.getPointerPosition() ?? { x: size.w / 2, y: size.h / 2 }
    zoomAt(e.evt.deltaY < 0 ? 1.12 : 0.89, pos.x, pos.y)
  }

  // ---- Touch equivalents of the mouse-only gestures above ----
  // One finger: pans with the pan tool, tap-zooms with the zoom tool, or is
  // left alone so the active drawing tool (brush/lasso/pen) or Konva's own
  // draggable/Transformer handling (select tool) can use it.
  // Two fingers, always available regardless of the active tool: pinch to
  // zoom and drag to pan at once, like any touch image editor.
  const touchDist = (t: TouchList) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY)
  const touchCenter = (t: TouchList) => {
    const rect = wrapRef.current?.getBoundingClientRect()
    return {
      x: (t[0].clientX + t[1].clientX) / 2 - (rect?.left ?? 0),
      y: (t[0].clientY + t[1].clientY) / 2 - (rect?.top ?? 0),
    }
  }
  const onTouchStart = (e: Konva.KonvaEventObject<TouchEvent>) => {
    const touches = e.evt.touches
    if (touches.length === 2) {
      e.evt.preventDefault()
      panRef.current.active = false
      const c = touchCenter(touches)
      pinchRef.current = { dist: touchDist(touches), cx: c.x, cy: c.y }
      return
    }
    if (touches.length === 1) {
      const touch = touches[0]
      if (panMode) {
        e.evt.preventDefault()
        panRef.current = { active: true, sx: touch.clientX, sy: touch.clientY, ox: viewport.x, oy: viewport.y }
        return
      }
      if (zoomMode) {
        e.evt.preventDefault()
        const pos = stageRef.current?.getPointerPosition() ?? { x: size.w / 2, y: size.h / 2 }
        zoomAt(1.25, pos.x, pos.y)
        return
      }
      if (e.target === e.target.getStage() && activeTool === 'select') setActive(null)
    }
  }
  const onTouchMove = (e: Konva.KonvaEventObject<TouchEvent>) => {
    const touches = e.evt.touches
    if (touches.length === 2) {
      e.evt.preventDefault()
      const dist = touchDist(touches)
      const center = touchCenter(touches)
      if (pinchRef.current) {
        setViewport({ x: viewport.x + (center.x - pinchRef.current.cx), y: viewport.y + (center.y - pinchRef.current.cy) })
        zoomAt(dist / pinchRef.current.dist, center.x, center.y)
      }
      pinchRef.current = { dist, cx: center.x, cy: center.y }
      return
    }
    if (touches.length === 1 && panRef.current.active) {
      e.evt.preventDefault()
      const touch = touches[0]
      const p = panRef.current
      setViewport({ x: p.ox + (touch.clientX - p.sx), y: p.oy + (touch.clientY - p.sy) })
    }
  }
  const onTouchEnd = (e: Konva.KonvaEventObject<TouchEvent>) => {
    if (e.evt.touches.length < 2) pinchRef.current = null
    if (e.evt.touches.length === 0) panRef.current.active = false
  }

  const toLocal = (layerId: string, sx: number, sy: number) => {
    const layer = layers[layerId]
    const wx = (sx - viewport.x) / viewport.scale
    const wy = (sy - viewport.y) / viewport.scale
    const tf = new Konva.Transform()
    tf.translate(layer.transform.x, layer.transform.y)
    tf.rotate((layer.transform.rotation * Math.PI) / 180)
    tf.scale(layer.transform.scaleX, layer.transform.scaleY)
    return tf.copy().invert().point({ x: wx, y: wy })
  }

  const handleAutoCut = (stagePoints: number[]) => {
    if (!activeId) return
    const layer = layers[activeId]
    const src = sourceBitmaps.get(activeId)
    if (!layer || !src) return
    const localPts: number[] = []
    for (let i = 0; i < stagePoints.length; i += 2) {
      const p = toLocal(activeId, stagePoints[i], stagePoints[i + 1])
      localPts.push(p.x, p.y)
    }
    const layerEdgeColor = layer.effects.edgeColor
    const { fragment, donor, mask, crop } = cutSelection(src, layer.width, layer.height, localPts, edgeStyle, layer.seed, layerEdgeColor)
    const tf = new Konva.Transform()
    tf.translate(layer.transform.x, layer.transform.y)
    tf.rotate((layer.transform.rotation * Math.PI) / 180)
    tf.scale(layer.transform.scaleX, layer.transform.scaleY)
    const worldPos = tf.point({ x: fragment.offsetX, y: fragment.offsetY })
    commitCut(activeId, donor, fragment.canvas, `${t('fragment')} (${edgeStyle})`, worldPos.x, worldPos.y, edgeStyle, mask, crop)
  }

  // Commit one physical-tool stroke to the active layer as an ordered op.
  const handleStroke = (stagePoints: number[], elapsedMs: number) => {
    if (useStore.getState().activeTool !== 'brush') return
    if (!activeId) return
    const engine = getPhysicalToolEngine(workshopTool)
    if (!engine) return

    // Group mode: apply the same physical stroke to every unlocked member,
    // re-projected into each layer's own local coordinates, as ONE history step.
    const groupId = useStore.getState().activeGroupId
    if (groupId) {
      const members = layerOrder.filter(
        (lid) => layerGroups[lid] === groupId && layers[lid] && !layers[lid].locked,
      )
      if (members.length > 0) {
        const baseSeed = Math.floor(Math.random() * 1e6)
        const entries: { layerId: string; op: SheetOp }[] = []
        members.forEach((tid, idx) => {
          const target = layers[tid]
          const pts: number[] = []
          for (let i = 0; i < stagePoints.length; i += 2) {
            const p = toLocal(tid, stagePoints[i], stagePoints[i + 1])
            pts.push(p.x, p.y)
          }
          entries.push({
            layerId: tid,
            op: {
              tool: engine.id,
              points: pts,
              parameters: { ...toolParameters[engine.id] },
              seed: baseSeed + idx * 7919,
              paperType: target.effects.paperType,
              elapsedMs,
              reference: referenceDevelopment.binding(engine.id),
            },
          })
        })
        addSheetOps(entries)
        return
      }
    }

    const layer = layers[activeId]
    if (!layer) return
    const local: number[] = []
    for (let i = 0; i < stagePoints.length; i += 2) {
      const p = toLocal(activeId, stagePoints[i], stagePoints[i + 1])
      local.push(p.x, p.y)
    }
    const activeOp: SheetOp = {
      tool: engine.id,
      points: local,
      parameters: { ...toolParameters[engine.id] },
      seed: Math.floor(Math.random() * 1e6),
      paperType: layer.effects.paperType,
      elapsedMs,
      reference: referenceDevelopment.binding(engine.id),
    }
    const entries: { layerId: string; op: SheetOp }[] = [{ layerId: activeId, op: activeOp }]
    const activeIndex = layerOrder.indexOf(activeId)
    const contactIndex = engine.id === 'glue' ? activeIndex + 1 : activeIndex - 1
    const contactId = layerOrder[contactIndex]
    const contactLayer = contactId ? layers[contactId] : null
    if (contactLayer?.visible && (engine.id === 'water' || engine.id === 'burn' || engine.id === 'glue')) {
      const activeMaterial = getCachedMaterialState(activeId)
      const contactPoints: number[] = []
      for (let i = 0; i < stagePoints.length; i += 2) {
        const activePoint = toLocal(activeId, stagePoints[i], stagePoints[i + 1])
        const targetPoint = toLocal(contactId, stagePoints[i], stagePoints[i + 1])
        if (
          targetPoint.x < 0 || targetPoint.y < 0
          || targetPoint.x >= contactLayer.width || targetPoint.y >= contactLayer.height
        ) continue
        if (engine.id === 'water') {
          if (!activeMaterial) continue
          const outside = (
            activePoint.x < 0 || activePoint.y < 0
            || activePoint.x >= activeMaterial.w || activePoint.y >= activeMaterial.h
          )
          if (!outside) {
            const sx = Math.floor(activePoint.x)
            const sy = Math.floor(activePoint.y)
            if (activeMaterial.rgba[(sy * activeMaterial.w + sx) * 4 + 3] !== 0) continue
          }
        }
        contactPoints.push(targetPoint.x, targetPoint.y)
      }
      if (contactPoints.length >= 2) {
        const transfer = engine.id === 'glue' ? 0.32 : engine.id === 'burn' ? 0.28 : 0.68
        entries.push({
          layerId: contactId,
          op: {
            ...activeOp,
            points: contactPoints,
            parameters: {
              ...activeOp.parameters,
              pressure: Number(activeOp.parameters.pressure ?? 0.5) * transfer,
            },
            seed: activeOp.seed + 7919,
            paperType: contactLayer.effects.paperType,
          },
        })
      }
    }
    addSheetOps(entries)
  }

  const physicalEngine = getPhysicalToolEngine(workshopTool)
  const toolCursor = physicalEngine ? physicalEngine.cursor(toolParameters[physicalEngine.id]) : null

  const empty = layerOrder.length === 0
  const panMode = activeTool === 'pan'
  const zoomMode = activeTool === 'zoom'
  const stageCursor = panRef.current.active ? 'grabbing' : panMode ? 'grab' : zoomMode ? 'zoom-in' : 'default'

  return (
    <div ref={wrapRef} className="stage-area"
      onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
      onDragLeave={() => setDragOver(false)}
      onDrop={onDrop}
    >
      <Stage
        ref={stageRef}
        width={size.w} height={size.h}
        x={viewport.x} y={viewport.y}
        scaleX={viewport.scale} scaleY={viewport.scale}
        onWheel={onWheel}
        onMouseDown={(e) => {
          const evt = e.evt
          // middle-mouse or space+drag or pan tool -> start panning
          if (evt.button === 1 || spaceRef.current || panMode) {
            evt.preventDefault()
            panRef.current = { active: true, sx: evt.clientX, sy: evt.clientY, ox: viewport.x, oy: viewport.y }
            return
          }
          if (zoomMode && evt.button === 0) {
            const pos = stageRef.current?.getPointerPosition() ?? { x: size.w / 2, y: size.h / 2 }
            zoomAt(evt.altKey ? 0.8 : 1.25, pos.x, pos.y)
            return
          }
          if (e.target === e.target.getStage() && activeTool === 'select') setActive(null)
        }}
        onMouseMove={(e) => {
          if (panRef.current.active) {
            const p = panRef.current
            setViewport({ x: p.ox + (e.evt.clientX - p.sx), y: p.oy + (e.evt.clientY - p.sy) })
          }
        }}
        onMouseUp={() => { panRef.current.active = false }}
        onMouseLeave={() => { panRef.current.active = false }}
        onDblClick={onDblClickCanvas}
        onDblTap={onDblClickCanvas}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onTouchCancel={onTouchEnd}
        style={{ cursor: stageCursor, touchAction: 'none' }}
      >
        {doc && (
          <KLayer listening={false}>
            <Rect
              x={0} y={0} width={doc.width} height={doc.height}
              fill="#ffffff"
              stroke="rgba(0,0,0,0.35)" strokeWidth={1 / viewport.scale}
              shadowColor="#000" shadowBlur={24 / viewport.scale} shadowOpacity={0.35}
              shadowOffsetY={6 / viewport.scale}
            />
          </KLayer>
        )}
        <KLayer>
          {layerOrder.map((id) => <LayerNode key={id} id={id} />)}
        </KLayer>
        {activeTool === 'lasso' && (
          <KLayer>
            {cutMode === 'pen'
              ? <PenTool onClose={handleAutoCut} />
              : <LassoTool onClose={handleAutoCut} />}
          </KLayer>
        )}
        {activeTool === 'brush' && activeId && toolCursor && (
          <KLayer>
            <PhysicalToolInput onStroke={handleStroke} cursor={toolCursor} navGesture={spaceRef} />
          </KLayer>
        )}
        {doc && (dragGuides.x !== null || dragGuides.y !== null) && (
          <KLayer listening={false}>
            {dragGuides.x !== null && (
              <Rect x={dragGuides.x} y={-4000} width={1 / viewport.scale} height={8000}
                fill="#e0913f" opacity={0.9} />
            )}
            {dragGuides.y !== null && (
              <Rect x={-4000} y={dragGuides.y} width={8000} height={1 / viewport.scale}
                fill="#e0913f" opacity={0.9} />
            )}
          </KLayer>
        )}
      </Stage>

      {empty && (
        <div className={`stage-hint ${dragOver ? 'drag-over' : ''}`}>
          <div>
            <div style={{ fontSize: 40, marginBottom: 8 }}>🖼️</div>
            {t('dropHere')}<br />
            <label style={{ color: 'var(--accent)', cursor: 'pointer', textDecoration: 'underline' }}>
              {t('orBrowse')}
              <input type="file" accept="image/*" hidden
                onChange={(e) => { const f = e.target.files?.[0]; if (f) loadFile(f); e.target.value = '' }} />
            </label>
          </div>
        </div>
      )}

      {!empty && activeTool === 'lasso' && <div className="tool-banner">{t(cutMode === 'pen' ? 'penHint' : 'lassoHint')}</div>}
      {!empty && activeTool === 'brush' && (
        activeId
          ? <div className="tool-banner">{t('brushHint')}</div>
          : <div className="tool-banner tool-banner-alert">{t('brushSelectHint')}</div>
      )}
      {!empty && activeTool === 'select' && <div className="tool-banner subtle">{t('navHint')}</div>}
      {!empty && activeTool === 'select' && activeId && layers[activeId] && !layers[activeId].locked && (
        <div className="align-bar">
          <button className="icon-btn" data-tip={t('alignLeft')} onClick={() => alignLayer(activeId, 'left')}><AlignIcon kind="left" /></button>
          <button className="icon-btn" data-tip={t('alignCenterH')} onClick={() => alignLayer(activeId, 'centerH')}><AlignIcon kind="centerH" /></button>
          <button className="icon-btn" data-tip={t('alignRight')} onClick={() => alignLayer(activeId, 'right')}><AlignIcon kind="right" /></button>
          <span className="align-sep" />
          <button className="icon-btn" data-tip={t('alignTop')} onClick={() => alignLayer(activeId, 'top')}><AlignIcon kind="top" /></button>
          <button className="icon-btn" data-tip={t('alignCenterV')} onClick={() => alignLayer(activeId, 'centerV')}><AlignIcon kind="centerV" /></button>
          <button className="icon-btn" data-tip={t('alignBottom')} onClick={() => alignLayer(activeId, 'bottom')}><AlignIcon kind="bottom" /></button>
          <span className="align-sep" />
          <button className="icon-btn" data-tip={t('fitToCanvas')} onClick={() => fitLayerToCanvas(activeId)}>{t('fitToCanvasShort')}</button>
          <button className="icon-btn" data-tip={t('fillCanvas')} onClick={() => fillLayerToCanvas(activeId)}>{t('fillCanvasShort')}</button>
          <button className="icon-btn" data-tip={t('cropToCanvas')} onClick={() => cropLayerToCanvas(activeId)}>{t('cropToCanvasShort')}</button>
        </div>
      )}
      <div className="zoom-badge">{Math.round(viewport.scale * 100)}%</div>
    </div>
  )
}

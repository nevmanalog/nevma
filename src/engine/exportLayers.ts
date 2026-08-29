// Export every layer as its own PNG, positioned on a shared canvas the size of
// the whole composition, so all PNGs line up when stacked ("same place as in
// the workspace"). Bundled into a ZIP.

import Konva from 'konva'
import { useStore, sourceBitmaps, sheetOps } from '@/state/store'
import { bakeBase } from './gl/bakeAsync'
import { renderLayerCached } from './sheet/cache'
import { effectiveOps } from './tools/registry'
import { makeZip, canvasToPngBytes, triggerDownload } from '@/shared/zip'

// Materialize one layer's final, full-quality pixels (printed base + workshop
// ops + Final adjustments) exactly as shown in the viewport.
async function bakeLayer(id: string) {
  const s = useStore.getState()
  const l = s.layers[id]
  const src = sourceBitmaps.get(id)
  if (!l || !src) return null
  const baked = await renderLayerCached(
    id, src, l.effects, l.seed, l.width, l.height, effectiveOps(sheetOps.get(id) ?? []),
    () => bakeBase({ source: src, width: l.width, height: l.height, effects: l.effects, seed: l.seed }),
  )
  return { layer: l, baked }
}

export async function exportLayersZip() {
  const s = useStore.getState()
  const ids = s.layerOrder
  if (ids.length === 0) return

  // Shared canvas = the original document/canvas bounds, NOT the union of
  // layer AABBs. Layer transforms (l.transform.x/y) are already expressed in
  // this same document space (origin at the canvas's top-left, see
  // clampTransformToCanvas / alignedTransform in state/store.ts), so drawing
  // every layer onto a canvas sized to the document and placed at its exact
  // transform reproduces precisely where it sat on the Nevma canvas. That
  // means every exported PNG shares the same dimensions and origin as the
  // original document, so dragging them into Photoshop as layers (which
  // stacks new layers at 0,0) snaps them right back into place — and the
  // canvas/grid size Photoshop reports on import will match the exported
  // file size, since it *is* the document size.
  const W = Math.max(1, Math.ceil(s.doc?.width ?? 0))
  const H = Math.max(1, Math.ceil(s.doc?.height ?? 0))
  const boxes: Record<string, HTMLCanvasElement> = {}

  for (const id of ids) {
    const l = s.layers[id]
    const src = sourceBitmaps.get(id)
    if (!src) continue
    // Materialize each layer at full resolution through the shared incremental
    // cache + worker pool. When the layer is already rendered in the viewport
    // this returns the cached, final-applied canvas instantly; otherwise it is
    // built in parallel off the main thread. Either way it is byte-for-byte the
    // full-quality composited + Final result shown on screen.
    const baked = await renderLayerCached(
      id, src, l.effects, l.seed, l.width, l.height, effectiveOps(sheetOps.get(id) ?? []),
      () => bakeBase({ source: src, width: l.width, height: l.height, effects: l.effects, seed: l.seed }),
    )
    boxes[id] = baked
  }

  const files: { name: string; data: Uint8Array }[] = []
  let i = 0

  for (const id of ids) {
    const l = s.layers[id]
    const baked = boxes[id]
    if (!baked) continue
    const canvas = document.createElement('canvas')
    canvas.width = W; canvas.height = H
    const ctx = canvas.getContext('2d')!
    ctx.save()
    // place each layer at its exact original position on the document canvas
    ctx.translate(l.transform.x, l.transform.y)
    ctx.rotate((l.transform.rotation * Math.PI) / 180)
    ctx.scale(l.transform.scaleX, l.transform.scaleY)
    ctx.drawImage(baked, 0, 0)
    ctx.restore()
    const safe = (l.name || `layer-${i}`).replace(/[^\w.-]+/g, '_')
    files.push({ name: `${String(++i).padStart(2, '0')}_${safe}.png`, data: await canvasToPngBytes(canvas) })
  }

  triggerDownload(makeZip(files), 'print-simulator-layers.zip')
}

// ---------------------------------------------------------------------------
// Final image — flatten every visible layer onto the document canvas at its
// original resolution and hand back a lossless PNG.
// ---------------------------------------------------------------------------

export async function renderFinalImage(): Promise<HTMLCanvasElement | null> {
  const s = useStore.getState()
  const ids = s.layerOrder
  if (ids.length === 0) return null

  const baked: Record<string, HTMLCanvasElement> = {}
  for (const id of ids) {
    const out = await bakeLayer(id)
    if (out) baked[id] = out.baked
  }

  // Prefer the document bounds (the true working resolution); fall back to the
  // union of all layer AABBs when there is no document.
  let W: number, H: number, offX: number, offY: number
  if (s.doc) {
    W = s.doc.width; H = s.doc.height; offX = 0; offY = 0
  } else {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    for (const id of ids) {
      const l = s.layers[id]
      if (!baked[id]) continue
      const tf = new Konva.Transform()
      tf.translate(l.transform.x, l.transform.y)
      tf.rotate((l.transform.rotation * Math.PI) / 180)
      tf.scale(l.transform.scaleX, l.transform.scaleY)
      for (const c of [{ x: 0, y: 0 }, { x: l.width, y: 0 }, { x: l.width, y: l.height }, { x: 0, y: l.height }].map((p) => tf.point(p))) {
        minX = Math.min(minX, c.x); minY = Math.min(minY, c.y); maxX = Math.max(maxX, c.x); maxY = Math.max(maxY, c.y)
      }
    }
    if (!isFinite(minX)) return null
    W = Math.ceil(maxX - minX); H = Math.ceil(maxY - minY); offX = -minX; offY = -minY
  }

  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, W); canvas.height = Math.max(1, H)
  const ctx = canvas.getContext('2d')!
  // Bottom-to-top compositing, matching the viewport stacking order.
  for (const id of ids) {
    const l = s.layers[id]
    if (!l.visible || !baked[id]) continue
    ctx.save()
    ctx.translate(l.transform.x + offX, l.transform.y + offY)
    ctx.rotate((l.transform.rotation * Math.PI) / 180)
    ctx.scale(l.transform.scaleX, l.transform.scaleY)
    ctx.drawImage(baked[id], 0, 0)
    ctx.restore()
  }
  return canvas
}

export async function exportFinalImage() {
  const canvas = await renderFinalImage()
  if (!canvas) return
  const name = (useStore.getState().doc?.name || 'nevma').replace(/[^\w.-]+/g, '_')
  const bytes = await canvasToPngBytes(canvas)
  triggerDownload(new Blob([bytes as BlobPart], { type: 'image/png' }), `${name}.png`)
}

// ---------------------------------------------------------------------------
// Project layers — each layer as its own PNG, organised into group folders,
// with a manifest.json that records names, positions, transforms and group
// membership. Every PNG is canvas-sized (matching the document/grid) and the
// layer is baked into it at its exact original position, so the files snap
// straight back into place if dragged into Photoshop as layers — the
// manifest is then just a readable record of the same info, not the only
// source of truth for alignment.
// ---------------------------------------------------------------------------

export async function exportProjectLayers() {
  const s = useStore.getState()
  const ids = s.layerOrder
  if (ids.length === 0) return

  const groupName = (gid: string | undefined): string | null => {
    if (!gid) return null
    return s.groups.find((g) => g.id === gid)?.name ?? null
  }
  const safe = (v: string) => v.replace(/[^\w.-]+/g, '_')

  // Canvas/grid for every exported layer matches the document size, so the
  // exported files line up exactly as they did on the original Nevma canvas.
  const W = Math.max(1, Math.ceil(s.doc?.width ?? 0))
  const H = Math.max(1, Math.ceil(s.doc?.height ?? 0))

  const files: { name: string; data: Uint8Array }[] = []
  const manifest: {
    document: typeof s.doc
    layers: {
      file: string; name: string; group: string | null
      x: number; y: number; scaleX: number; scaleY: number; rotation: number
      width: number; height: number; visible: boolean; opacity: number
    }[]
  } = { document: s.doc, layers: [] }

  let i = 0
  for (const id of ids) {
    const out = await bakeLayer(id)
    if (!out) continue
    const { layer: l, baked } = out

    // Place the baked layer onto a full-document-sized canvas at its exact
    // original transform, matching what exportLayersZip does — same origin,
    // same size, so it aligns to the same place as on the original canvas.
    const canvas = document.createElement('canvas')
    canvas.width = W; canvas.height = H
    const ctx = canvas.getContext('2d')!
    ctx.save()
    ctx.translate(l.transform.x, l.transform.y)
    ctx.rotate((l.transform.rotation * Math.PI) / 180)
    ctx.scale(l.transform.scaleX, l.transform.scaleY)
    ctx.drawImage(baked, 0, 0)
    ctx.restore()

    const gname = groupName(s.layerGroups[id])
    const folder = gname ? `${safe(gname)}/` : ''
    const index = String(++i).padStart(2, '0')
    const file = `${folder}${index}_${safe(l.name || `layer-${i}`)}.png`
    files.push({ name: file, data: await canvasToPngBytes(canvas) })
    manifest.layers.push({
      file, name: l.name, group: gname,
      x: l.transform.x, y: l.transform.y,
      scaleX: l.transform.scaleX, scaleY: l.transform.scaleY, rotation: l.transform.rotation,
      width: l.width, height: l.height, visible: l.visible, opacity: 1,
    })
  }

  files.push({ name: 'manifest.json', data: new TextEncoder().encode(JSON.stringify(manifest, null, 2)) })
  const name = (s.doc?.name || 'nevma').replace(/[^\w.-]+/g, '_')
  triggerDownload(makeZip(files), `${name}-layers.zip`)
}

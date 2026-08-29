import { useEffect, useRef, useState } from 'react'
import { useStore, sourceBitmaps } from '@/state/store'
import { useT } from '@/i18n'

/** Small live thumbnail rendered from the layer's working pixels. */
function Thumb({ id, token }: { id: string; token: number | undefined }) {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    const src = sourceBitmaps.get(id)
    if (!src) { setUrl(null); return }
    const sw = 'naturalWidth' in src ? src.naturalWidth : src.width
    const sh = 'naturalHeight' in src ? src.naturalHeight : src.height
    if (!sw || !sh) { setUrl(null); return }
    const box = 40
    const scale = Math.min(box / sw, box / sh)
    const dw = Math.max(1, Math.round(sw * scale))
    const dh = Math.max(1, Math.round(sh * scale))
    const c = document.createElement('canvas')
    c.width = box; c.height = box
    const ctx = c.getContext('2d')
    if (!ctx) { setUrl(null); return }
    ctx.drawImage(src, 0, 0, sw, sh, (box - dw) / 2, (box - dh) / 2, dw, dh)
    setUrl(c.toDataURL())
  }, [id, token])
  return <div className="thumb">{url && <img src={url} alt="" />}</div>
}

export function LayersPanel() {
  const layerOrder = useStore((s) => s.layerOrder)
  const layers = useStore((s) => s.layers)
  const bakeToken = useStore((s) => s.bakeToken)
  const activeId = useStore((s) => s.activeLayerId)
  const activeGroupId = useStore((s) => s.activeGroupId)
  const setActive = useStore((s) => s.setActiveLayer)
  const setActiveGroup = useStore((s) => s.setActiveGroup)
  const toggleVisible = useStore((s) => s.toggleVisible)
  const toggleLocked = useStore((s) => s.toggleLocked)
  const renameLayer = useStore((s) => s.renameLayer)
  const removeLayer = useStore((s) => s.removeLayer)
  const reorderLayers = useStore((s) => s.reorderLayers)
  const groups = useStore((s) => s.groups)
  const layerGroups = useStore((s) => s.layerGroups)
  const createGroup = useStore((s) => s.createGroup)
  const addBlankLayer = useStore((s) => s.addBlankLayer)
  const mergeLayers = useStore((s) => s.mergeLayers)
  const renameGroup = useStore((s) => s.renameGroup)
  const deleteGroup = useStore((s) => s.deleteGroup)
  const toggleGroupCollapsed = useStore((s) => s.toggleGroupCollapsed)
  const setLayerGroup = useStore((s) => s.setLayerGroup)
  const setGroupVisible = useStore((s) => s.setGroupVisible)
  const t = useT()

  // The panel lists top-most layer first; layerOrder is bottom->top.
  const ordered = [...layerOrder].reverse()
  const collapsedGroups = new Set(groups.filter((g) => g.collapsed).map((g) => g.id))
  const visibleRows = ordered.filter((id) => {
    const g = layerGroups[id]
    return !(g && collapsedGroups.has(g))
  })

  // Checkbox multi-select, just for "Merge layers" — separate from activeId
  // (single-select, drives the right-hand settings panel). Pruned whenever a
  // ticked layer stops existing (deleted, or merged away by undo/redo).
  const [selected, setSelected] = useState<Set<string>>(new Set())
  useEffect(() => {
    setSelected((prev) => {
      const next = new Set([...prev].filter((id) => layers[id]))
      return next.size === prev.size ? prev : next
    })
  }, [layers])
  const toggleSelected = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
    selectAnchorRef.current = id
  }
  // Shift+click on a layer row selects the whole range between the last
  // clicked layer (the "anchor") and the one just clicked, same as
  // file managers / Photoshop. Anchor updates on every plain or shift click.
  const selectAnchorRef = useRef<string | null>(null)
  const selectRange = (id: string) => {
    // Anchor stays put across repeated shift+clicks, so the user can grow
    // or shrink the same range — it only moves on a plain click.
    const anchor = selectAnchorRef.current ?? id
    const from = visibleRows.indexOf(anchor)
    const to = visibleRows.indexOf(id)
    if (from === -1 || to === -1) {
      setSelected((prev) => new Set(prev).add(id))
    } else {
      const [start, end] = from <= to ? [from, to] : [to, from]
      const range = visibleRows.slice(start, end + 1)
      setSelected((prev) => {
        const next = new Set(prev)
        range.forEach((rid) => next.add(rid))
        return next
      })
    }
    selectAnchorRef.current = anchor
  }
  const canMerge = selected.size >= 2
  const onMerge = () => {
    if (!canMerge) return
    mergeLayers([...selected])
    setSelected(new Set())
  }

  const [dragId, setDragId] = useState<string | null>(null)
  const [overId, setOverId] = useState<string | null>(null)
  // Touch has no native drag-and-drop, so the drag handle tracks the finger
  // itself and finds the row underneath it on every move.
  const touchDragRef = useRef<string | null>(null)
  const longPressRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const drop = (targetId: string) => {
    // Belt-and-braces alongside the canvas row not being draggable/a drop
    // target in the JSX: dragId can only be a canvas id if some future code
    // path sets it directly, and targetId can be the canvas row via the
    // touch path (rowIdAt just finds whatever's under the finger). Either
    // way, the canvas never moves.
    if (!dragId || dragId === targetId || layers[dragId]?.isCanvas || layers[targetId]?.isCanvas) {
      setDragId(null); setOverId(null); return
    }
    const display = [...ordered]
    const from = display.indexOf(dragId)
    const to = display.indexOf(targetId)
    if (from === -1 || to === -1) { setDragId(null); setOverId(null); return }
    display.splice(from, 1)
    display.splice(to, 0, dragId)
    reorderLayers([...display].reverse()) // back to bottom->top for the store
    setDragId(null)
    setOverId(null)
  }

  const rowIdAt = (x: number, y: number) => {
    const el = document.elementFromPoint(x, y)?.closest<HTMLElement>('[data-layer-id]')
    return el?.dataset.layerId ?? null
  }

  const onHandleTouchStart = (id: string) => (e: React.TouchEvent) => {
    e.preventDefault()
    touchDragRef.current = id
    setDragId(id)
  }
  const onHandleTouchMove = (e: React.TouchEvent) => {
    if (!touchDragRef.current) return
    e.preventDefault()
    const t = e.touches[0]
    setOverId(rowIdAt(t.clientX, t.clientY))
  }
  const onHandleTouchEnd = (e: React.TouchEvent) => {
    if (!touchDragRef.current) return
    const t = e.changedTouches[0]
    const target = rowIdAt(t.clientX, t.clientY)
    touchDragRef.current = null
    if (target) drop(target)
    else { setDragId(null); setOverId(null) }
  }

  // Long-press stands in for double-click-to-rename on touch devices.
  const bindLongPress = (onFire: () => void) => ({
    onTouchStart: (e: React.TouchEvent) => {
      e.stopPropagation()
      longPressRef.current = setTimeout(onFire, 500)
    },
    onTouchEnd: () => { if (longPressRef.current) clearTimeout(longPressRef.current) },
    onTouchMove: () => { if (longPressRef.current) clearTimeout(longPressRef.current) },
  })

  const groupMembers = (gid: string) => Object.keys(layerGroups).filter((id) => layerGroups[id] === gid && layers[id])
  const groupAllVisible = (gid: string) => {
    const m = groupMembers(gid)
    return m.length > 0 && m.every((id) => layers[id].visible)
  }

  return (
    <div className="panel layers-panel">
      <div className="panel-head">
        <span className="panel-title">{t('layers')}</span>
        <div className="panel-head-actions">
          <button className="ghost-btn" onClick={addBlankLayer}>＋ {t('newLayer')}</button>
          <button className="ghost-btn" onClick={createGroup}>＋ {t('newGroup')}</button>
        </div>
      </div>

      {canMerge && (
        <div className="merge-bar">
          <span className="merge-bar-text">{t('layersSelected')} {selected.size}</span>
          <button className="merge-bar-cancel" data-tip={t('cancelSelection')} onClick={() => setSelected(new Set())}>✕</button>
          <button className="merge-bar-btn" data-tip={t('mergeLayersHint')} onClick={onMerge}>▣ {t('mergeLayers')}</button>
        </div>
      )}

      <div className="layers-scroll">
      {ordered.length === 0 && <p className="hint">{t('layersEmpty')}</p>}

      {groups.map((g) => {
        const count = groupMembers(g.id).length
        const allVisible = groupAllVisible(g.id)
        return (
          <div key={g.id} className={`group-head ${activeGroupId === g.id ? 'active' : ''}`}
            onClick={() => setActiveGroup(g.id)}>
            <button className="chev-btn" onClick={(ev) => { ev.stopPropagation(); toggleGroupCollapsed(g.id) }}>{g.collapsed ? '▸' : '▾'}</button>
            <span className="group-name" data-tip={t('renameGroupPrompt')}
              onDoubleClick={(ev) => { ev.stopPropagation(); const n = window.prompt(t('renameGroupPrompt'), g.name); if (n !== null) renameGroup(g.id, n.trim() || g.name) }}
              {...bindLongPress(() => { const n = window.prompt(t('renameGroupPrompt'), g.name); if (n !== null) renameGroup(g.id, n.trim() || g.name) })}>
              {g.name}
            </span>
            <span className="group-count">{count}</span>
            <button className="icon-btn" data-tip={allVisible ? t('hideLayer') : t('showLayer')}
              onClick={(ev) => { ev.stopPropagation(); setGroupVisible(g.id, !allVisible) }}>{allVisible ? '👁' : '🚫'}</button>
            <button className="icon-btn" data-tip={t('deleteLayer')} onClick={(ev) => { ev.stopPropagation(); deleteGroup(g.id) }}>🗑</button>
          </div>
        )
      })}

      {visibleRows.map((id) => {
        const l = layers[id]
        const gid = layerGroups[id] ?? ''
        const isCanvas = Boolean(l.isCanvas)
        return (
          <div
            key={id}
            data-layer-id={id}
            className={`layer-item ${activeId === id ? 'active' : ''} ${overId === id && dragId ? 'drag-over' : ''} ${dragId === id ? 'dragging' : ''} ${gid ? 'in-group' : ''} ${isCanvas ? 'is-canvas' : ''}`}
            draggable={!isCanvas}
            onDragStart={() => { if (!isCanvas) setDragId(id) }}
            onDragOver={(ev) => { if (isCanvas) return; ev.preventDefault(); setOverId(id) }}
            onDragLeave={() => setOverId((cur) => (cur === id ? null : cur))}
            onDrop={(ev) => { ev.preventDefault(); drop(id) }}
            onDragEnd={() => { setDragId(null); setOverId(null) }}
            data-tip={isCanvas ? t('canvasLayerHint') : t('shiftSelectHint')}
            onClick={(ev) => {
              if (ev.shiftKey) {
                ev.preventDefault()
                selectRange(id)
              } else {
                selectAnchorRef.current = id
              }
              setActive(id)
            }}
          >
            <input
              type="checkbox"
              className="layer-select-chk"
              data-tip={t('selectForMerge')}
              checked={selected.has(id)}
              onClick={(ev) => ev.stopPropagation()}
              onChange={() => toggleSelected(id)}
            />
            {isCanvas ? (
              <span className="drag-handle drag-handle-disabled" data-tip={t('canvasLayerHint')}>⠿</span>
            ) : (
              <span className="drag-handle" data-tip={t('reorderHint')}
                onTouchStart={onHandleTouchStart(id)}
                onTouchMove={onHandleTouchMove}
                onTouchEnd={onHandleTouchEnd}
                onTouchCancel={() => { touchDragRef.current = null; setDragId(null); setOverId(null) }}
              >⠿</span>
            )}
            <Thumb id={id} token={bakeToken[id]} />
            <div className="name">
              <span className="name-text" data-tip={t('renameLayerPrompt')}
                onDoubleClick={(ev) => {
                  ev.stopPropagation()
                  const n = window.prompt(t('renameLayerPrompt'), l.name)
                  if (n !== null) renameLayer(id, n)
                }}
                {...bindLongPress(() => { const n = window.prompt(t('renameLayerPrompt'), l.name); if (n !== null) renameLayer(id, n) })}
              >{l.name}</span>
              <div className="kind">{l.kind === 'fragment' ? `${t('fragment')} · ${l.edgeStyle}` : l.kind === 'blank' ? t('blankLayer') : t('baseImage')}</div>
              {activeId === id && (
                <select className="group-select" value={gid}
                  onClick={(ev) => ev.stopPropagation()}
                  onChange={(ev) => setLayerGroup(id, ev.target.value || null)}>
                  <option value="">{t('ungrouped')}</option>
                  {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
              )}
            </div>
            <div className="layer-actions">
              <button className="icon-btn" data-tip={l.visible ? t('hideLayer') : t('showLayer')}
                onClick={(ev) => { ev.stopPropagation(); toggleVisible(id) }}>{l.visible ? '👁' : '🚫'}</button>
              <button className={`icon-btn ${l.locked ? 'on' : ''}`} data-tip={l.locked ? t('unlockLayer') : t('lockLayer')}
                onClick={(ev) => { ev.stopPropagation(); toggleLocked(id) }}>{l.locked ? '🔒' : '🔓'}</button>
              <button className="icon-btn" data-tip={isCanvas ? t('canvasLayerHint') : t('deleteLayer')}
                disabled={isCanvas}
                onClick={(ev) => { ev.stopPropagation(); if (!isCanvas) removeLayer(id) }}>🗑</button>
            </div>
          </div>
        )
      })}
      </div>
    </div>
  )
}

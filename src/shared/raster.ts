// CPU rasterization helpers: polygon -> soft mask canvas (cheap pseudo-SDF).

/** Bounding box of a flat [x0,y0,x1,y1,...] polygon. */
export function polygonBounds(points: number[]) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (let i = 0; i < points.length; i += 2) {
    minX = Math.min(minX, points[i])
    maxX = Math.max(maxX, points[i])
    minY = Math.min(minY, points[i + 1])
    maxY = Math.max(maxY, points[i + 1])
  }
  return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY }
}

/**
 * Rasterize a polygon (in image pixel coords) into a full-image-sized mask
 * canvas: white inside, black outside, then blurred to act as a pseudo-SDF.
 */
export function polygonToSoftMask(
  points: number[],
  width: number,
  height: number,
  blur = 4,
): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = width
  c.height = height
  const ctx = c.getContext('2d')!
  ctx.fillStyle = '#000'
  ctx.fillRect(0, 0, width, height)
  ctx.filter = `blur(${blur}px)`
  ctx.fillStyle = '#fff'
  ctx.beginPath()
  ctx.moveTo(points[0], points[1])
  for (let i = 2; i < points.length; i += 2) {
    ctx.lineTo(points[i], points[i + 1])
  }
  ctx.closePath()
  ctx.fill()
  ctx.filter = 'none'
  return c
}

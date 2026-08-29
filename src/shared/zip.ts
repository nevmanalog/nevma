// Minimal ZIP writer (store / no compression). PNGs are already compressed,
// so storing them raw keeps this dependency-free and correct.

interface Entry { name: string; data: Uint8Array; crc: number; offset: number }

const CRC_TABLE = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()

function crc32(buf: Uint8Array): number {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

const enc = new TextEncoder()

function u16(v: number) { return [v & 0xff, (v >>> 8) & 0xff] }
function u32(v: number) { return [v & 0xff, (v >>> 8) & 0xff, (v >>> 16) & 0xff, (v >>> 24) & 0xff] }

/** Build a ZIP archive Blob from a list of {name, bytes}. */
export function makeZip(files: { name: string; data: Uint8Array }[]): Blob {
  const parts: BlobPart[] = []
  const entries: Entry[] = []
  let offset = 0

  for (const f of files) {
    const nameBytes = enc.encode(f.name)
    const crc = crc32(f.data)
    const local = [
      ...u32(0x04034b50), ...u16(20), ...u16(0), ...u16(0), ...u16(0), ...u16(0),
      ...u32(crc), ...u32(f.data.length), ...u32(f.data.length),
      ...u16(nameBytes.length), ...u16(0),
    ]
    const header = new Uint8Array(local)
    parts.push(header as BlobPart, nameBytes as BlobPart, f.data as BlobPart)
    entries.push({ name: f.name, data: f.data, crc, offset })
    offset += header.length + nameBytes.length + f.data.length
  }

  const cdStart = offset
  let cdSize = 0
  for (const e of entries) {
    const nameBytes = enc.encode(e.name)
    const central = [
      ...u32(0x02014b50), ...u16(20), ...u16(20), ...u16(0), ...u16(0), ...u16(0), ...u16(0),
      ...u32(e.crc), ...u32(e.data.length), ...u32(e.data.length),
      ...u16(nameBytes.length), ...u16(0), ...u16(0), ...u16(0), ...u16(0), ...u32(0),
      ...u32(e.offset),
    ]
    const header = new Uint8Array(central)
    parts.push(header as BlobPart, nameBytes as BlobPart)
    cdSize += header.length + nameBytes.length
  }

  const end = new Uint8Array([
    ...u32(0x06054b50), ...u16(0), ...u16(0),
    ...u16(entries.length), ...u16(entries.length),
    ...u32(cdSize), ...u32(cdStart), ...u16(0),
  ])
  parts.push(end as BlobPart)
  return new Blob(parts as BlobPart[], { type: 'application/zip' })
}

export async function canvasToPngBytes(canvas: HTMLCanvasElement): Promise<Uint8Array> {
  const blob: Blob = await new Promise((res) => canvas.toBlob((b) => res(b!), 'image/png'))
  return new Uint8Array(await blob.arrayBuffer())
}

export function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}

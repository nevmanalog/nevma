// Minimal canvas/document stub so the engine (which calls document.createElement
// and 2D context methods) can run in plain Node under Vitest, without pulling in
// a real DOM. Mirrors the mock already used by bench/profile.ts and
// bench/verify.ts — kept in one place so engine tests don't each reinvent it.
// Call installFakeDom() once per test file, before importing anything from
// src/engine (module-level `document.createElement` calls happen at import
// time in a couple of places).

class FakeCtx {
  constructor(private w: number, private h: number) {}
  getImageData(_x: number, _y: number, w: number, h: number) {
    const data = new Uint8ClampedArray(w * h * 4)
    for (let i = 0; i < data.length; i += 4) {
      data[i] = (i * 7) & 255
      data[i + 1] = (i * 13) & 255
      data[i + 2] = (i * 17) & 255
      data[i + 3] = 255
    }
    return { data, width: w, height: h }
  }

  createImageData(w: number, h: number) {
    return { data: new Uint8ClampedArray(w * h * 4), width: w, height: h }
  }

  putImageData() {}
  drawImage() {}
  save() {}
  restore() {}
  translate() {}
  rotate() {}
  scale() {}
  clearRect() {}
}

class FakeCanvas {
  width = 0
  height = 0
  getContext() { return new FakeCtx(this.width, this.height) }
}

export function installFakeDom(): void {
  ;(globalThis as any).document = { createElement: () => new FakeCanvas() }
}

export function makeFakeCanvas(w: number, h: number): HTMLCanvasElement {
  const c = new FakeCanvas()
  c.width = w; c.height = h
  return c as unknown as HTMLCanvasElement
}

// expect(Array.from(bigTypedArray)).toEqual(Array.from(otherBigTypedArray)) is
// correct but painfully slow at engine scale (chai's deep-eql wasn't built for
// multi-million-element arrays). These do a plain indexed loop instead — the
// same approach bench/verify.ts used — and only build a diagnostic message if
// something actually differs, so passing checks stay cheap.

export function typedArraysEqual(
  a: { length: number; [i: number]: number },
  b: { length: number; [i: number]: number },
): true | string {
  if (a.length !== b.length) return `length mismatch: ${a.length} vs ${b.length}`
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return `differs at index ${i}: ${a[i]} vs ${b[i]}`
  }
  return true
}

export function assertTypedArraysEqual(
  a: { length: number; [i: number]: number },
  b: { length: number; [i: number]: number },
  label: string,
): void {
  const result = typedArraysEqual(a, b)
  if (result !== true) throw new Error(`${label}: ${result}`)
}

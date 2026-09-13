/** An image read from its container, before its orientation is applied. */
export type ParsedImage = {
  bytes: Uint8Array<ArrayBuffer>
  width: number
  height: number
  /** The recorded orientation, from 1 (upright) to 8. */
  orientation: number
}

export function invalid(format: string): never {
  throw new Error(`Invalid ${format}`)
}

export const text = (bytes: Uint8Array, from: number, length: number) =>
  String.fromCharCode(...bytes.subarray(from, from + length))

export const view = (bytes: Uint8Array) =>
  new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)

export function join(parts: readonly Uint8Array[]) {
  const result = new Uint8Array(
    parts.reduce((size, part) => size + part.length, 0)
  )
  let offset = 0
  for (const part of parts) {
    result.set(part, offset)
    offset += part.length
  }
  return result
}

/** The orientation (1 to 8) an EXIF block records, or 1 when it has none. */
export function exifOrientation(tiff: Uint8Array) {
  const data = view(tiff)
  const order = text(tiff, 0, 2)
  const little = order === "II"
  if (
    tiff.length < 8 ||
    (!little && order !== "MM") ||
    data.getUint16(2, little) !== 42
  )
    return 1
  const directory = data.getUint32(4, little)
  if (directory + 2 > tiff.length) return 1
  const end = directory + 2 + data.getUint16(directory, little) * 12
  for (let entry = directory + 2; entry < end; entry += 12) {
    if (entry + 12 > tiff.length) return 1
    if (data.getUint16(entry, little) === 0x0112) {
      const value = data.getUint16(entry + 8, little)
      return value >= 1 && value <= 8 ? value : 1
    }
  }
  return 1
}

/** An EXIF block recording only the orientation. */
export function orientationExif(orientation: number) {
  const tiff = new Uint8Array(26)
  const data = view(tiff)
  tiff.set([0x4d, 0x4d, 0, 42])
  data.setUint32(4, 8)
  data.setUint16(8, 1)
  data.setUint16(10, 0x0112)
  data.setUint16(12, 3)
  data.setUint32(14, 1)
  data.setUint16(18, orientation)
  return tiff
}

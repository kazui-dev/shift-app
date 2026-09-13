import { crc32 } from "node:zlib"

type Part = Uint8Array | readonly number[] | string

/** Bytes from byte arrays, numbers and ASCII text. */
export function bytes(...parts: Part[]) {
  const arrays = parts.map((part) =>
    typeof part === "string"
      ? Uint8Array.from(part, (character) => character.charCodeAt(0))
      : Uint8Array.from(part)
  )
  const result = new Uint8Array(
    arrays.reduce((size, part) => size + part.length, 0)
  )
  let offset = 0
  for (const part of arrays) {
    result.set(part, offset)
    offset += part.length
  }
  return result
}

/** An EXIF (TIFF) block with SHORT entries, big-endian unless `little`. */
export function exif(
  entries: [tag: number, value: number][],
  { little = false, count = entries.length } = {}
) {
  const tiff = new Uint8Array(14 + entries.length * 12)
  const data = new DataView(tiff.buffer)
  tiff.set(little ? [0x49, 0x49, 42, 0] : [0x4d, 0x4d, 0, 42])
  data.setUint32(4, 8, little)
  data.setUint16(8, count, little)
  entries.forEach(([tag, value], index) => {
    const entry = 10 + index * 12
    data.setUint16(entry, tag, little)
    data.setUint16(entry + 2, 3, little)
    data.setUint32(entry + 4, 1, little)
    data.setUint16(entry + 8, value, little)
  })
  return tiff
}

export const jpegSegment = (marker: number, body: Part) => {
  const content = bytes(body)
  const length = content.length + 2
  return bytes([0xff, marker, length >> 8, length & 0xff], content)
}
export const jpegFrame = (width: number, height: number) =>
  jpegSegment(0xc0, [
    8,
    height >> 8,
    height & 0xff,
    width >> 8,
    width & 0xff,
    1,
    1,
    0x11,
    0,
  ])
/** A scan header and data, with stuffed, restart and fill bytes. */
export const jpegScan = bytes(
  jpegSegment(0xda, [1, 1, 0, 0, 63, 0]),
  [0x12, 0xff, 0x00, 0x34, 0xff, 0xd0, 0x56, 0xff, 0xff]
)
export const jpegStart = [0xff, 0xd8]
export const jpegEnd = [0xff, 0xd9]
export const jpegExif = (orientation: number) =>
  jpegSegment(0xe1, bytes("Exif\0\0", exif([[0x0112, orientation]])))
export const jpeg = (width: number, height: number) =>
  bytes(jpegStart, jpegFrame(width, height), jpegScan, jpegEnd)

export const pngSignature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
export function pngChunk(type: string, body: Part) {
  const content = bytes(body)
  const chunk = bytes([0, 0, 0, 0], type, content, [0, 0, 0, 0])
  const data = new DataView(chunk.buffer)
  data.setUint32(0, content.length)
  data.setUint32(
    8 + content.length,
    crc32(chunk.subarray(4, 8 + content.length))
  )
  return chunk
}
export function pngHeader(width: number, height: number) {
  const body = new Uint8Array(13)
  new DataView(body.buffer).setUint32(0, width)
  new DataView(body.buffer).setUint32(4, height)
  body.set([8, 6, 0, 0, 0], 8)
  return pngChunk("IHDR", body)
}
export const png = (width: number, height: number) =>
  bytes(
    pngSignature,
    pngHeader(width, height),
    pngChunk("IDAT", [1, 2]),
    pngChunk("IEND", [])
  )

export function riffChunk(kind: string, body: Part) {
  const content = bytes(body)
  const chunk = bytes(
    kind,
    [0, 0, 0, 0],
    content,
    content.length % 2 ? [0] : []
  )
  new DataView(chunk.buffer).setUint32(4, content.length, true)
  return chunk
}
export function webpFile(...chunks: Uint8Array[]) {
  const file = bytes("RIFF", [0, 0, 0, 0], "WEBP", ...chunks)
  new DataView(file.buffer).setUint32(4, file.length - 8, true)
  return file
}
const uint24 = (value: number) => [
  value & 0xff,
  (value >> 8) & 0xff,
  (value >> 16) & 0xff,
]
export const webpHeader = (flags: number, width: number, height: number) =>
  riffChunk("VP8X", [
    flags,
    0,
    0,
    0,
    ...uint24(width - 1),
    ...uint24(height - 1),
  ])
export const vp8 = (width: number, height: number) =>
  riffChunk("VP8 ", [
    0,
    0,
    0,
    0x9d,
    0x01,
    0x2a,
    width & 0xff,
    width >> 8,
    height & 0xff,
    height >> 8,
  ])
export function vp8l(width: number, height: number) {
  const bits = (width - 1) | ((height - 1) << 14)
  return riffChunk("VP8L", [
    0x2f,
    bits & 0xff,
    (bits >> 8) & 0xff,
    (bits >> 16) & 0xff,
    (bits >>> 24) & 0xff,
  ])
}

export const gifScreen = (width: number, height: number, flags = 0) =>
  bytes("GIF89a", [
    width & 0xff,
    width >> 8,
    height & 0xff,
    height >> 8,
    flags,
    0,
    0,
  ])
export const gifApplication = (name: string, data: readonly number[]) =>
  bytes([0x21, 0xff, 11], name, [data.length], data, [0])

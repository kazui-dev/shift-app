import {
  exifOrientation,
  invalid,
  join,
  orientationExif,
  text,
  view,
  type ParsedImage,
} from "./image-bytes"

/** Chunks that decide how a still or animated WebP looks. */
const keptChunks = new Set(["VP8 ", "VP8L", "ALPH", "ICCP", "ANIM", "ANMF"])
/** The bytes that start a lossy image's first frame. */
const lossyStartCode = [0x9d, 0x01, 0x2a]

export function webp(input: Uint8Array): ParsedImage {
  const data = view(input)
  if (
    input.length < 12 ||
    text(input, 0, 4) !== "RIFF" ||
    text(input, 8, 4) !== "WEBP" ||
    data.getUint32(4, true) + 8 !== input.length
  )
    invalid("WebP")
  let header: Uint8Array | undefined
  const chunks: Uint8Array[] = []
  let recorded = 1
  for (let offset = 12; offset < input.length;) {
    if (offset + 8 > input.length) invalid("WebP")
    const size = data.getUint32(offset + 4, true)
    const end = offset + 8 + size + (size % 2)
    if (end > input.length) invalid("WebP")
    const kind = text(input, offset, 4)
    if (kind === "VP8X" && size === 10) header = input.slice(offset, end)
    else if (kind === "EXIF")
      recorded = exifOrientation(input.subarray(offset + 8, offset + 8 + size))
    else if (keptChunks.has(kind)) chunks.push(input.subarray(offset, end))
    offset = end
  }
  // Only the extended format can carry EXIF, so a simple image has no orientation.
  const orientation = header ? recorded : 1
  const [width, height] = header
    ? [1 + uint24(header, 12), 1 + uint24(header, 15)]
    : simpleSize(chunks[0])
  if (header)
    view(header).setUint8(
      8,
      (view(header).getUint8(8) & ~0x0c) | (orientation === 1 ? 0 : 0x08)
    )
  const bytes = join([
    input.subarray(0, 12),
    ...(header ? [header] : []),
    ...chunks,
    ...(orientation === 1 ? [] : [chunk("EXIF", orientationExif(orientation))]),
  ])
  view(bytes).setUint32(4, bytes.length - 8, true)
  return { bytes, width, height, orientation }
}

const uint24 = (bytes: Uint8Array, offset: number) =>
  view(bytes).getUint16(offset, true) + (view(bytes).getUint8(offset + 2) << 16)

/** The size a simple image records in its only image chunk. */
function simpleSize(image: Uint8Array | undefined): [number, number] {
  const kind = image ? text(image, 0, 4) : ""
  if (
    image &&
    kind === "VP8 " &&
    image.length >= 18 &&
    lossyStartCode.every((byte, index) => image[11 + index] === byte)
  )
    return [
      view(image).getUint16(14, true) & 0x3fff,
      view(image).getUint16(16, true) & 0x3fff,
    ]
  if (image && kind === "VP8L" && image.length >= 13 && image[8] === 0x2f) {
    const bits = view(image).getUint32(9, true)
    return [(bits & 0x3fff) + 1, ((bits >>> 14) & 0x3fff) + 1]
  }
  return invalid("WebP")
}

function chunk(kind: string, body: Uint8Array) {
  const result = new Uint8Array(8 + body.length + (body.length % 2))
  for (let index = 0; index < 4; index += 1)
    result[index] = kind.charCodeAt(index)
  view(result).setUint32(4, body.length, true)
  result.set(body, 8)
  return result
}

import {
  exifOrientation,
  invalid,
  join,
  orientationExif,
  text,
  view,
  type ParsedImage,
} from "./image-bytes"

const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
/** Chunks that decide how a PNG or APNG looks. */
const keptChunks = new Set([
  "IHDR",
  "PLTE",
  "IDAT",
  "IEND",
  "tRNS",
  "cHRM",
  "gAMA",
  "iCCP",
  "sBIT",
  "sRGB",
  "cICP",
  "mDCV",
  "cLLI",
  "bKGD",
  "pHYs",
  "acTL",
  "fcTL",
  "fdAT",
])

export function png(input: Uint8Array): ParsedImage {
  const data = view(input)
  if (signature.some((byte, index) => input[index] !== byte)) invalid("PNG")
  const chunks: Uint8Array[] = []
  let orientation = 1
  let offset = 8
  let type = ""
  while (type !== "IEND") {
    if (offset + 12 > input.length) invalid("PNG")
    const end = offset + 12 + data.getUint32(offset)
    if (end > input.length) invalid("PNG")
    type = text(input, offset + 4, 4)
    if (type === "eXIf")
      orientation = exifOrientation(input.subarray(offset + 8, end - 4))
    else if (keptChunks.has(type)) chunks.push(input.subarray(offset, end))
    offset = end
  }
  const [header, ...rest] = chunks
  if (!header || text(header, 4, 4) !== "IHDR" || header.length !== 25)
    invalid("PNG")
  const width = view(header).getUint32(8)
  const height = view(header).getUint32(12)
  if (!width || !height) invalid("PNG")
  return {
    bytes: join([
      input.subarray(0, 8),
      header,
      ...(orientation === 1
        ? []
        : [chunk("eXIf", orientationExif(orientation))]),
      ...rest,
    ]),
    width,
    height,
    orientation,
  }
}

function crc32(bytes: Uint8Array) {
  let crc = 0xffffffff
  for (const byte of bytes) {
    crc ^= byte
    for (let bit = 0; bit < 8; bit += 1)
      crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1
  }
  return (crc ^ 0xffffffff) >>> 0
}

function chunk(type: string, body: Uint8Array) {
  const result = new Uint8Array(12 + body.length)
  const data = view(result)
  data.setUint32(0, body.length)
  for (let index = 0; index < 4; index += 1)
    data.setUint8(4 + index, type.charCodeAt(index))
  result.set(body, 8)
  data.setUint32(8 + body.length, crc32(result.subarray(4, 8 + body.length)))
  return result
}

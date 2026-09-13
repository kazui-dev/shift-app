/** Formats kept as uploaded. HEIC, HEIF and AVIF are converted to JPEG first. */
const storedImageTypes = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
] as const
export type StoredImageType = (typeof storedImageTypes)[number]

export type StoredImage = {
  bytes: Uint8Array<ArrayBuffer>
  /** The displayed size, with the recorded orientation applied. */
  width: number
  height: number
}

type Parsed = StoredImage & { orientation: number }

export function isStoredImageType(value: string): value is StoredImageType {
  return storedImageTypes.some((type) => type === value)
}

/** Where an attachment's original lives in the bucket. */
export const chatImageKey = (roomId: string, attachmentId: string) =>
  `${roomId}/${attachmentId}`
/** Cache tags, so deleting an image or its room drops every cached size. */
export const chatImageTag = (attachmentId: string) =>
  `chat-image:${attachmentId}`
export const chatRoomTag = (roomId: string) => `chat-room:${roomId}`

/**
 * The image as stored: its pixels untouched, with location, camera, comments
 * and unknown metadata removed. The colour profile and orientation stay,
 * because they change how the image looks.
 */
export function storedImage(
  input: Uint8Array,
  type: StoredImageType
): StoredImage {
  const { bytes, width, height, orientation } = parsers[type](input)
  const turned = orientation >= 5
  return {
    bytes,
    width: turned ? height : width,
    height: turned ? width : height,
  }
}

const extensions: Record<StoredImageType, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
}
const imageExtension = /\.(jpe?g|png|webp|gif|heic|heif|avif|apng)$/i
/** Characters file systems reserve in names. */
const reservedCharacters = new Set([
  "/",
  "\\",
  ":",
  "*",
  "?",
  '"',
  "<",
  ">",
  "|",
])
const encoder = new TextEncoder()

/** Control characters and those file systems reserve. */
function unsafe(character: string) {
  const code = character.charCodeAt(0)
  return code < 0x20 || code === 0x7f || reservedCharacters.has(character)
}

/**
 * An uploaded name made safe to save as: unsafe characters removed, the
 * extension matching the stored format, at most 255 bytes. Empty when no name
 * remains.
 */
export function attachmentName(value: string, type: StoredImageType) {
  let safe = ""
  for (const character of value) if (!unsafe(character)) safe += character
  const name = safe.trim()
  const match = imageExtension.exec(name)
  const stem = (match ? name.slice(0, match.index) : name).trim()
  if (!stem) return ""
  const current = match?.[1]
  const extension = `.${current?.toLowerCase().replace("jpeg", "jpg") === extensions[type] ? current : extensions[type]}`
  let kept = ""
  for (const character of stem) {
    if (encoder.encode(kept + character + extension).length > 255) break
    kept += character
  }
  return kept + extension
}

/** The name an attachment saves as: its uploaded name, else when it was sent. */
export function attachmentFileName(
  name: string,
  type: StoredImageType,
  sentAt: number
) {
  if (name) return name
  const stamp = new Date(sentAt + 9 * 3_600_000)
    .toISOString()
    .slice(0, 19)
    .replace(/[-:]/g, "")
    .replace("T", "-")
  return `${stamp}.${extensions[type]}`
}

function invalid(format: string): never {
  throw new Error(`Invalid ${format}`)
}
const text = (bytes: Uint8Array, from: number, length: number) =>
  String.fromCharCode(...bytes.subarray(from, from + length))
const view = (bytes: Uint8Array) =>
  new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
function join(parts: readonly Uint8Array[]) {
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
function exifOrientation(tiff: Uint8Array) {
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
function orientationExif(orientation: number) {
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

const jpegFrames = new Set([
  0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf,
])
/** Bytes that continue scan data after 0xFF: stuffing, fill and restarts. */
const scanContinuations = new Set<number | undefined>([
  0x00, 0xff, 0xd0, 0xd1, 0xd2, 0xd3, 0xd4, 0xd5, 0xd6, 0xd7,
])

/**
 * Keeps the JFIF header, colour profile, Adobe colour transform, tables,
 * frames and scans up to the end of the primary image. Everything after it,
 * such as secondary images, is dropped with the rest of the metadata.
 */
function jpeg(input: Uint8Array): Parsed {
  const data = view(input)
  if (input[0] !== 0xff || input[1] !== 0xd8) invalid("JPEG")
  const kept: Uint8Array[] = []
  let header: Uint8Array | undefined
  let orientation = 1
  let width = 0
  let height = 0
  let offset = 2
  while (input[offset + 1] !== 0xd9) {
    if (offset + 4 > input.length || input[offset] !== 0xff) invalid("JPEG")
    const marker = data.getUint8(offset + 1)
    if (marker === 0xff) {
      offset += 1
      continue
    }
    const start = offset
    const end = start + 2 + data.getUint16(start + 2)
    if (end < start + 4 || end > input.length) invalid("JPEG")
    const segment = input.subarray(start, end)
    const body = input.subarray(start + 4, end)
    if (marker === 0xda) {
      offset = scanEnd(input, end)
      kept.push(input.subarray(start, offset))
      continue
    }
    if (marker === 0xe0 && text(body, 0, 5) === "JFIF\0") header = segment
    else if (marker === 0xe1 && text(body, 0, 6) === "Exif\0\0")
      orientation = exifOrientation(body.subarray(6))
    else if (
      marker < 0xe0 ||
      marker === 0xee ||
      (marker === 0xe2 && text(body, 0, 12) === "ICC_PROFILE\0")
    ) {
      if (jpegFrames.has(marker)) {
        if (body.length < 5) invalid("JPEG")
        height = data.getUint16(offset + 5)
        width = data.getUint16(offset + 7)
      }
      kept.push(segment)
    }
    offset = end
  }
  if (!width || !height) invalid("JPEG")
  return {
    bytes: join([
      input.subarray(0, 2),
      ...(header ? [header] : []),
      ...(orientation === 1 ? [] : [jpegExif(orientation)]),
      ...kept,
      input.subarray(offset, offset + 2),
    ]),
    width,
    height,
    orientation,
  }
}

function scanEnd(input: Uint8Array, from: number) {
  for (let index = from; index + 1 < input.length; index += 1)
    if (input[index] === 0xff && !scanContinuations.has(input[index + 1]))
      return index
  return invalid("JPEG")
}

function jpegExif(orientation: number) {
  const tiff = orientationExif(orientation)
  const segment = new Uint8Array(10 + tiff.length)
  segment.set([0xff, 0xe1])
  view(segment).setUint16(2, 8 + tiff.length)
  segment.set([0x45, 0x78, 0x69, 0x66, 0, 0], 4)
  segment.set(tiff, 10)
  return segment
}

const pngSignature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
/** Chunks that decide how a PNG or APNG looks. */
const pngChunks = new Set([
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

function png(input: Uint8Array): Parsed {
  const data = view(input)
  if (pngSignature.some((byte, index) => input[index] !== byte)) invalid("PNG")
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
    else if (pngChunks.has(type)) chunks.push(input.subarray(offset, end))
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
        : [pngChunk("eXIf", orientationExif(orientation))]),
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

function pngChunk(type: string, body: Uint8Array) {
  const chunk = new Uint8Array(12 + body.length)
  const data = view(chunk)
  data.setUint32(0, body.length)
  for (let index = 0; index < 4; index += 1)
    data.setUint8(4 + index, type.charCodeAt(index))
  chunk.set(body, 8)
  data.setUint32(8 + body.length, crc32(chunk.subarray(4, 8 + body.length)))
  return chunk
}

/** Chunks that decide how a still or animated WebP looks. */
const webpChunks = new Set(["VP8 ", "VP8L", "ALPH", "ICCP", "ANIM", "ANMF"])

function webp(input: Uint8Array): Parsed {
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
    else if (webpChunks.has(kind)) chunks.push(input.subarray(offset, end))
    offset = end
  }
  // Only the extended format can carry EXIF, so a simple image has no orientation.
  const orientation = header ? recorded : 1
  const [width, height] = header
    ? [1 + uint24(header, 12), 1 + uint24(header, 15)]
    : webpSize(chunks[0])
  if (header)
    view(header).setUint8(
      8,
      (view(header).getUint8(8) & ~0x0c) | (orientation === 1 ? 0 : 0x08)
    )
  const bytes = join([
    input.subarray(0, 12),
    ...(header ? [header] : []),
    ...chunks,
    ...(orientation === 1
      ? []
      : [riffChunk("EXIF", orientationExif(orientation))]),
  ])
  view(bytes).setUint32(4, bytes.length - 8, true)
  return { bytes, width, height, orientation }
}

const uint24 = (bytes: Uint8Array, offset: number) =>
  view(bytes).getUint16(offset, true) + (view(bytes).getUint8(offset + 2) << 16)

function webpSize(chunk: Uint8Array | undefined): [number, number] {
  const kind = chunk ? text(chunk, 0, 4) : ""
  if (
    chunk &&
    kind === "VP8 " &&
    chunk.length >= 18 &&
    text(chunk, 11, 3) === "*"
  )
    return [
      view(chunk).getUint16(14, true) & 0x3fff,
      view(chunk).getUint16(16, true) & 0x3fff,
    ]
  if (chunk && kind === "VP8L" && chunk.length >= 13 && chunk[8] === 0x2f) {
    const bits = view(chunk).getUint32(9, true)
    return [(bits & 0x3fff) + 1, ((bits >>> 14) & 0x3fff) + 1]
  }
  return invalid("WebP")
}

function riffChunk(kind: string, body: Uint8Array) {
  const chunk = new Uint8Array(8 + body.length + (body.length % 2))
  for (let index = 0; index < 4; index += 1)
    chunk[index] = kind.charCodeAt(index)
  view(chunk).setUint32(4, body.length, true)
  chunk.set(body, 8)
  return chunk
}

/** Application extensions that change how a GIF plays or looks. */
const gifApplications = new Set(["NETSCAPE2.0", "ANIMEXTS1.0", "ICCRGBG1012"])

function gif(input: Uint8Array): Parsed {
  const signature = text(input, 0, 6)
  if (input.length < 13 || (signature !== "GIF87a" && signature !== "GIF89a"))
    invalid("GIF")
  const data = view(input)
  const width = data.getUint16(6, true)
  const height = data.getUint16(8, true)
  if (!width || !height) invalid("GIF")
  let offset = colourTableEnd(data.getUint8(10), 13)
  const kept = [input.subarray(0, offset)]
  while (input[offset] !== 0x3b) {
    const start = offset
    if (input[start] === 0x2c) {
      if (start + 10 > input.length) invalid("GIF")
      offset = subBlocksEnd(
        input,
        colourTableEnd(data.getUint8(start + 9), start + 10) + 1
      )
      kept.push(input.subarray(start, offset))
    } else if (input[start] === 0x21) {
      offset = subBlocksEnd(input, start + 2)
      const label = input[start + 1]
      if (
        label === 0xf9 ||
        label === 0x01 ||
        (label === 0xff && gifApplications.has(text(input, start + 3, 11)))
      )
        kept.push(input.subarray(start, offset))
    } else invalid("GIF")
  }
  return {
    bytes: join([...kept, input.subarray(offset, offset + 1)]),
    width,
    height,
    orientation: 1,
  }
}

const colourTableEnd = (flags: number, from: number) =>
  from + (flags & 0x80 ? 3 << ((flags & 7) + 1) : 0)

function subBlocksEnd(input: Uint8Array, from: number) {
  let offset = from
  for (let size = input[offset]; size !== 0; size = input[offset]) {
    if (size === undefined) invalid("GIF")
    offset += 1 + size
  }
  return offset + 1
}

const parsers: Record<StoredImageType, (input: Uint8Array) => Parsed> = {
  "image/jpeg": jpeg,
  "image/png": png,
  "image/webp": webp,
  "image/gif": gif,
}

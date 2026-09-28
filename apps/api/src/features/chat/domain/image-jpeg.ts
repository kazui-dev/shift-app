import {
  exifOrientation,
  invalid,
  join,
  orientationExif,
  text,
  view,
  type ParsedImage,
} from "./image-bytes"

const frames = new Set([
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
export function jpeg(input: Uint8Array): ParsedImage {
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
      if (frames.has(marker)) {
        if (body.length < 5) invalid("JPEG")
        height = data.getUint16(start + 5)
        width = data.getUint16(start + 7)
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
      ...(orientation === 1 ? [] : [exifSegment(orientation)]),
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

function exifSegment(orientation: number) {
  const tiff = orientationExif(orientation)
  const segment = new Uint8Array(10 + tiff.length)
  segment.set([0xff, 0xe1])
  view(segment).setUint16(2, 8 + tiff.length)
  segment.set([0x45, 0x78, 0x69, 0x66, 0, 0], 4)
  segment.set(tiff, 10)
  return segment
}

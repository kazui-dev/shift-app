import { invalid, join, text, view, type ParsedImage } from "./image-bytes"

/** Application extensions that change how a GIF plays or looks. */
const keptApplications = new Set(["NETSCAPE2.0", "ANIMEXTS1.0", "ICCRGBG1012"])

export function gif(input: Uint8Array): ParsedImage {
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
        (label === 0xff && keptApplications.has(text(input, start + 3, 11)))
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

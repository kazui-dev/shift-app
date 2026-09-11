// Retain only WebP image/colour chunks; EXIF, XMP and unknown metadata never leave storage.
export function stripWebpMetadata(input: ArrayBuffer): ArrayBuffer {
  const bytes = new Uint8Array(input),
    view = new DataView(input)
  const text = (from: number) =>
    new TextDecoder().decode(bytes.subarray(from, from + 4))
  if (
    bytes.length < 12 ||
    text(0) !== "RIFF" ||
    text(8) !== "WEBP" ||
    view.getUint32(4, true) + 8 !== bytes.length
  )
    throw new Error("Invalid WebP")
  const chunks: Uint8Array[] = []
  for (let offset = 12; offset < bytes.length;) {
    if (offset + 8 > bytes.length) throw new Error("Invalid WebP chunk")
    const size = view.getUint32(offset + 4, true),
      end = offset + 8 + size + (size % 2)
    if (end > bytes.length) throw new Error("Invalid WebP chunk")
    const kind = text(offset)
    if (["VP8 ", "VP8L", "VP8X", "ALPH", "ICCP"].includes(kind)) {
      const chunk = bytes.slice(offset, end)
      if (kind === "VP8X") {
        if (size !== 10) throw new Error("Invalid WebP header")
        chunk[8] = new DataView(chunk.buffer).getUint8(8) & ~0x0c
      }
      chunks.push(chunk)
    }
    offset = end
  }
  const result = new Uint8Array(
    12 + chunks.reduce((sum, chunk) => sum + chunk.length, 0)
  )
  result.set(bytes.subarray(0, 12))
  let offset = 12
  for (const chunk of chunks) {
    result.set(chunk, offset)
    offset += chunk.length
  }
  new DataView(result.buffer).setUint32(4, result.length - 8, true)
  return result.buffer
}

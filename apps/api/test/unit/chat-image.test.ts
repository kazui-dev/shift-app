import { describe, expect, it } from "vite-plus/test"
import { stripWebpMetadata } from "../../src/domain/chat-image"

function webp(chunks: [string, number[]][]) {
  const bytes = new Uint8Array(
    12 +
      chunks.reduce(
        (size, [, data]) => size + 8 + data.length + (data.length % 2),
        0
      )
  )
  const view = new DataView(bytes.buffer)
  bytes.set(new TextEncoder().encode("RIFF"))
  bytes.set(new TextEncoder().encode("WEBP"), 8)
  view.setUint32(4, bytes.length - 8, true)
  let offset = 12
  for (const [kind, data] of chunks) {
    bytes.set(new TextEncoder().encode(kind), offset)
    view.setUint32(offset + 4, data.length, true)
    bytes.set(data, offset + 8)
    offset += 8 + data.length + (data.length % 2)
  }
  return bytes.buffer
}
describe("stored image metadata", () => {
  it("removes EXIF, XMP and unknown chunks while retaining image data, alpha and colour profile", () => {
    const header = [12, 0, 0, 0, 0, 0, 0, 0, 0, 0]
    const image: [string, number[]][] = [
      ["VP8X", header],
      ["ICCP", [1]],
      ["ALPH", [2, 3]],
      ["VP8 ", [4, 5, 6]],
      ["VP8L", [7]],
    ]
    const output = stripWebpMetadata(
      webp([...image, ["EXIF", [1, 2, 3]], ["XMP ", [4]], ["JUNK", [5]]])
    )
    expect(output).toEqual(
      webp([["VP8X", [0, 0, 0, 0, 0, 0, 0, 0, 0, 0]], ...image.slice(1)])
    )
  })
  it("leaves an empty valid container for the decoder to reject", () => {
    expect(stripWebpMetadata(webp([]))).toEqual(webp([]))
  })
  it.each([new ArrayBuffer(1), new Uint8Array(12).buffer])(
    "rejects invalid containers",
    (input) => {
      expect(() => stripWebpMetadata(input)).toThrow("Invalid WebP")
    }
  )
  it("rejects invalid signature and declared lengths", () => {
    const signature = webp([])
    new Uint8Array(signature)[8] = 0
    expect(() => stripWebpMetadata(signature)).toThrow("Invalid WebP")
    const length = webp([])
    new DataView(length).setUint32(4, 999, true)
    expect(() => stripWebpMetadata(length)).toThrow("Invalid WebP")
  })
  it("rejects truncated chunk headers, bodies and malformed extended headers", () => {
    const short = new Uint8Array(16)
    short.set(new Uint8Array(webp([])))
    new DataView(short.buffer).setUint32(4, 8, true)
    expect(() => stripWebpMetadata(short.buffer)).toThrow("Invalid WebP chunk")
    const body = webp([["VP8 ", [1, 2]]])
    new DataView(body).setUint32(16, 100, true)
    expect(() => stripWebpMetadata(body)).toThrow("Invalid WebP chunk")
    expect(() => stripWebpMetadata(webp([["VP8X", [0]]]))).toThrow(
      "Invalid WebP header"
    )
  })
})

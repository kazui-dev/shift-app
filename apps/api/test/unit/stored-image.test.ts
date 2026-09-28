import { describe, expect, it } from "vite-plus/test"
import {
  isStoredImageType,
  storedImage,
} from "../../src/features/chat/domain/stored-image"
import {
  bytes,
  exif,
  gifApplication,
  gifScreen,
  jpeg,
  jpegEnd,
  jpegExif,
  jpegFrame,
  jpegScan,
  jpegSegment,
  jpegStart,
  png,
  pngChunk,
  pngHeader,
  pngSignature,
  riffChunk,
  vp8,
  vp8l,
  webpFile,
  webpHeader,
} from "../support/images"

describe("JPEG", () => {
  it("keeps what draws the image, records only its orientation and turns its size", () => {
    const header = jpegSegment(0xe0, bytes("JFIF\0", [1, 2]))
    const profile = jpegSegment(0xe2, bytes("ICC_PROFILE\0", [1, 1, 9]))
    const adobe = jpegSegment(0xee, bytes("Adobe", [1]))
    const tables = jpegSegment(0xdb, [0, 1, 2])
    const huffman = jpegSegment(0xc4, [0, 3])
    const input = bytes(
      jpegStart,
      header,
      jpegSegment(0xe1, bytes("Exif\0\0", exif([[0x0112, 6]]))),
      jpegSegment(0xe1, "http://ns.adobe.com/xap/1.0/\0<x/>"),
      profile,
      jpegSegment(0xe2, bytes("MPF\0", [1])),
      jpegSegment(0xed, "Photoshop 3.0\0"),
      adobe,
      jpegSegment(0xfe, "comment"),
      tables,
      jpegFrame(40, 30),
      huffman,
      jpegScan,
      huffman,
      jpegScan,
      jpegEnd,
      jpegStart,
      [1, 2]
    )
    expect(storedImage(input, "image/jpeg")).toEqual({
      bytes: bytes(
        jpegStart,
        header,
        jpegExif(6),
        profile,
        adobe,
        tables,
        jpegFrame(40, 30),
        huffman,
        jpegScan,
        huffman,
        jpegScan,
        jpegEnd
      ),
      width: 30,
      height: 40,
    })
  })
  it("drops fill bytes and an upright orientation", () => {
    const input = bytes(
      jpegStart,
      [0xff],
      jpegExif(1),
      jpegFrame(40, 30),
      jpegScan,
      jpegEnd
    )
    expect(storedImage(input, "image/jpeg")).toEqual({
      bytes: jpeg(40, 30),
      width: 40,
      height: 30,
    })
  })
  it("reads little-endian orientation and rewrites it big-endian", () => {
    const input = bytes(
      jpegStart,
      jpegSegment(
        0xe1,
        bytes("Exif\0\0", exif([[0x0112, 3]], { little: true }))
      ),
      jpegFrame(40, 30),
      jpegScan,
      jpegEnd
    )
    expect(storedImage(input, "image/jpeg")).toEqual({
      bytes: bytes(
        jpegStart,
        jpegExif(3),
        jpegFrame(40, 30),
        jpegScan,
        jpegEnd
      ),
      width: 40,
      height: 30,
    })
  })
  const moved = exif([[0x0112, 6]])
  new DataView(moved.buffer).setUint32(4, 100)
  it.each([
    ["an unknown byte order", bytes("XX", exif([[0x0112, 6]]).subarray(2))],
    ["a truncated block", bytes([0x4d, 0x4d, 0])],
    ["a wrong magic number", bytes([0x4d, 0x4d, 0, 41], exif([]).subarray(4))],
    ["a directory past the end", moved],
    ["an entry past the end", exif([[0x0110, 1]], { count: 5 })],
    ["no orientation tag", exif([[0x0110, 6]])],
    ["an orientation above 8", exif([[0x0112, 9]])],
    ["an orientation of 0", exif([[0x0112, 0]])],
  ])("treats EXIF with %s as upright", (_case, tiff) => {
    const input = bytes(
      jpegStart,
      jpegSegment(0xe1, bytes("Exif\0\0", tiff)),
      jpegFrame(40, 30),
      jpegScan,
      jpegEnd
    )
    expect(storedImage(input, "image/jpeg")).toEqual({
      bytes: jpeg(40, 30),
      width: 40,
      height: 30,
    })
  })
  it.each([
    ["no start marker", bytes([0, 0])],
    ["a missing marker", bytes(jpegStart, [0x00, 0xc0, 0, 4, 0, 0])],
    ["a truncated segment header", bytes(jpegStart, [0xff, 0xc0, 0])],
    [
      "a segment shorter than its length",
      bytes(jpegStart, [0xff, 0xdb, 0, 1, 0]),
    ],
    ["a segment past the end", bytes(jpegStart, [0xff, 0xdb, 0, 50, 1])],
    ["a short frame", bytes(jpegStart, jpegSegment(0xc0, [8, 0]), jpegEnd)],
    ["no frame", bytes(jpegStart, jpegSegment(0xdb, [0]), jpegEnd)],
    ["no height", jpeg(40, 0)],
    ["no width", jpeg(0, 30)],
    [
      "an unfinished scan",
      bytes(jpegStart, jpegFrame(40, 30), jpegSegment(0xda, [0]), [1, 2]),
    ],
  ])("rejects %s", (_case, input) => {
    expect(() => storedImage(input, "image/jpeg")).toThrow("Invalid JPEG")
  })
})

describe("PNG and APNG", () => {
  it("keeps colour and animation chunks, records only orientation and drops text", () => {
    const profile = pngChunk("iCCP", [1, 0, 2])
    const animation = [
      pngChunk("acTL", [0, 0, 0, 2, 0, 0, 0, 0]),
      pngChunk("fcTL", [0, 1]),
      pngChunk("IDAT", [1, 2]),
      pngChunk("fdAT", [3, 4]),
    ]
    const input = bytes(
      pngSignature,
      pngHeader(40, 30),
      pngChunk("tEXt", "Author\0Someone"),
      profile,
      pngChunk("eXIf", exif([[0x0112, 8]])),
      ...animation,
      pngChunk("iTXt", "XML:com.adobe.xmp\0"),
      pngChunk("IEND", []),
      [1, 2, 3]
    )
    expect(storedImage(input, "image/png")).toEqual({
      bytes: bytes(
        pngSignature,
        pngHeader(40, 30),
        pngChunk("eXIf", exif([[0x0112, 8]])),
        profile,
        ...animation,
        pngChunk("IEND", [])
      ),
      width: 30,
      height: 40,
    })
  })
  it("leaves an upright image without metadata as it was", () => {
    expect(storedImage(png(40, 30), "image/png")).toEqual({
      bytes: png(40, 30),
      width: 40,
      height: 30,
    })
  })
  it.each([
    ["a wrong signature", bytes([0x89, 0x50], png(1, 1).subarray(2, 7))],
    ["a truncated chunk", bytes(pngSignature, [0, 0, 0])],
    [
      "a chunk past the end",
      bytes(pngSignature, [0, 0, 0, 90], "IHDR", [0, 0, 0, 0]),
    ],
    [
      "no header first",
      bytes(pngSignature, pngChunk("IDAT", [1]), pngChunk("IEND", [])),
    ],
    [
      "a short header",
      bytes(
        pngSignature,
        pngChunk("IHDR", new Uint8Array(12)),
        pngChunk("IEND", [])
      ),
    ],
    ["no width", png(0, 30)],
    ["no height", png(40, 0)],
    ["no end", bytes(pngSignature, pngHeader(40, 30))],
  ])("rejects %s", (_case, input) => {
    expect(() => storedImage(input, "image/png")).toThrow("Invalid PNG")
  })
})

describe("WebP", () => {
  it("keeps colour, alpha and animation, records only orientation and turns its size", () => {
    const kept = [
      riffChunk("ICCP", [1]),
      riffChunk("ANIM", [0, 0, 0, 0, 0, 0]),
      riffChunk("ANMF", [2, 3]),
    ]
    const input = webpFile(
      webpHeader(0x3c, 40, 30),
      ...kept,
      riffChunk("XMP ", "<x/>"),
      riffChunk("EXIF", exif([[0x0112, 6]])),
      riffChunk("JUNK", [5])
    )
    expect(storedImage(input, "image/webp")).toEqual({
      bytes: webpFile(
        webpHeader(0x38, 40, 30),
        ...kept,
        riffChunk("EXIF", exif([[0x0112, 6]]))
      ),
      width: 30,
      height: 40,
    })
  })
  it("clears metadata flags of an upright extended image", () => {
    const image = [riffChunk("ALPH", [1]), vp8(40, 30)]
    expect(
      storedImage(webpFile(webpHeader(0x1c, 40, 30), ...image), "image/webp")
    ).toEqual({
      bytes: webpFile(webpHeader(0x10, 40, 30), ...image),
      width: 40,
      height: 30,
    })
  })
  it("reads the size of simple lossy and lossless images, which cannot carry orientation", () => {
    const lossy = storedImage(
      webpFile(vp8(40, 30), riffChunk("EXIF", exif([[0x0112, 6]]))),
      "image/webp"
    )
    expect(lossy).toEqual({
      bytes: webpFile(vp8(40, 30)),
      width: 40,
      height: 30,
    })
    expect(storedImage(webpFile(vp8l(300, 200)), "image/webp")).toEqual({
      bytes: webpFile(vp8l(300, 200)),
      width: 300,
      height: 200,
    })
  })
  const mismatched = webpFile(vp8(1, 1))
  new DataView(mismatched.buffer).setUint32(4, 99, true)
  const oversized = webpFile(vp8(1, 1))
  new DataView(oversized.buffer).setUint32(16, 100, true)
  it.each([
    ["a short container", bytes("RIFF")],
    ["a wrong container", bytes("RIFX", [4, 0, 0, 0], "WEBP")],
    ["a wrong format", bytes("RIFF", [4, 0, 0, 0], "WAVE")],
    ["a wrong length", mismatched],
    ["a truncated chunk header", webpFile(bytes("VP8 "))],
    ["a chunk past the end", oversized],
    ["no chunks", webpFile()],
    ["no image", webpFile(riffChunk("VP8X", [0]), riffChunk("ICCP", [1]))],
    [
      "a lossy image without a start code",
      webpFile(riffChunk("VP8 ", new Uint8Array(10))),
    ],
    ["a short lossy image", webpFile(riffChunk("VP8 ", [0, 0, 0, 0x9d]))],
    [
      "a lossless image with a wrong signature",
      webpFile(riffChunk("VP8L", [0, 0, 0, 0, 0])),
    ],
    ["a short lossless image", webpFile(riffChunk("VP8L", [0x2f, 1, 2]))],
  ])("rejects %s", (_case, input) => {
    expect(() => storedImage(input, "image/webp")).toThrow("Invalid WebP")
  })
})

describe("GIF", () => {
  it("keeps frames, timing, looping and colour while dropping comments and XMP", () => {
    const control = bytes([0x21, 0xf9, 4, 0, 10, 0, 0, 0])
    const looping = gifApplication("NETSCAPE2.0", [1, 0, 0])
    const text = bytes([0x21, 0x01, 2, 1, 2, 0])
    const frame = bytes(
      [0x2c, 0, 0, 0, 0, 40, 0, 30, 0, 0x80],
      [1, 2, 3, 4, 5, 6],
      [2, 2, 9, 9, 0]
    )
    const input = bytes(
      gifScreen(40, 30, 0x80),
      [0, 0, 0, 9, 9, 9],
      control,
      [0x21, 0xfe, 3, 97, 98, 99, 0],
      looping,
      gifApplication("XMP DataXMP", [1, 2]),
      text,
      frame,
      [0x3b, 1, 2]
    )
    expect(storedImage(input, "image/gif")).toEqual({
      bytes: bytes(
        gifScreen(40, 30, 0x80),
        [0, 0, 0, 9, 9, 9],
        control,
        looping,
        text,
        frame,
        [0x3b]
      ),
      width: 40,
      height: 30,
    })
  })
  it("reads a GIF87a without colour tables", () => {
    const input = bytes(
      "GIF87a",
      [40, 0, 30, 0, 0, 0, 0],
      [0x2c, 0, 0, 0, 0, 40, 0, 30, 0, 0, 2, 1, 1, 0, 0x3b]
    )
    expect(storedImage(input, "image/gif")).toEqual({
      bytes: input,
      width: 40,
      height: 30,
    })
  })
  it.each([
    ["a short header", bytes("GIF89a")],
    ["a wrong signature", bytes("GIF88a", [1, 0, 1, 0, 0, 0, 0, 0x3b])],
    ["no width", bytes(gifScreen(0, 30), [0x3b])],
    ["no height", bytes(gifScreen(40, 0), [0x3b])],
    ["an unknown block", bytes(gifScreen(40, 30), [0x00])],
    ["a truncated frame", bytes(gifScreen(40, 30), [0x2c, 0, 0])],
    ["unfinished sub-blocks", bytes(gifScreen(40, 30), [0x21, 0xf9, 4, 0])],
    ["no trailer", bytes(gifScreen(40, 30), [0x21, 0xf9, 0])],
  ])("rejects %s", (_case, input) => {
    expect(() => storedImage(input, "image/gif")).toThrow("Invalid GIF")
  })
})

it("knows which formats are stored as uploaded", () => {
  expect(isStoredImageType("image/gif")).toBe(true)
  expect(isStoredImageType("image/heic")).toBe(false)
})

import { beforeEach, expect, it, vi } from "vite-plus/test"
import { storableImage } from "../../src/features/chat/services/chat-image"
import {
  exif,
  jpeg,
  png,
  pngChunk,
  pngHeader,
  pngSignature,
  bytes,
  fakeTransformer,
} from "../support/images"

const info = vi.fn<() => Promise<ImageInfoResponse>>()
let converted = new Uint8Array()
const { transformer, transform, output } = fakeTransformer(() => converted)
const images = { info, input: () => transformer }
const size = (format: string, width: number, height: number) => ({
  format,
  width,
  height,
  fileSize: 1,
})

beforeEach(() => {
  vi.clearAllMocks()
})

it("stores a PNG as uploaded without its metadata", async () => {
  info.mockResolvedValue(size("image/png", 40, 30))
  const upload = bytes(
    pngSignature,
    pngHeader(40, 30),
    pngChunk("tEXt", "GPS\0here"),
    pngChunk("eXIf", exif([[0x0112, 1]])),
    pngChunk("IDAT", [1, 2]),
    pngChunk("IEND", [])
  )
  expect(await storableImage(images, new Blob([upload]))).toEqual({
    bytes: png(40, 30),
    width: 40,
    height: 30,
    type: "image/png",
  })
  expect(transform).not.toHaveBeenCalled()
})

it("stores HEIC, HEIF and AVIF as high-quality JPEG within Images' limits", async () => {
  converted = jpeg(4000, 3000)
  info.mockResolvedValue(size("image/heic", 4000, 3000))
  expect(await storableImage(images, new Blob(["heic"]))).toEqual({
    bytes: jpeg(4000, 3000),
    width: 4000,
    height: 3000,
    type: "image/jpeg",
  })
  expect(transform).toHaveBeenCalledWith({
    width: 12_000,
    height: 12_000,
    fit: "scale-down",
  })
  expect(output).toHaveBeenCalledWith({ format: "image/jpeg", quality: 92 })
})

it.each([
  ["what Images cannot read", () => info.mockRejectedValue(new Error("9412"))],
  ["SVG", () => info.mockResolvedValue({ format: "image/svg+xml" })],
  [
    "more than 50 megapixels",
    () => info.mockResolvedValue(size("image/jpeg", 10_000, 5_001)),
  ],
  [
    "a format this chat does not accept",
    () => info.mockResolvedValue(size("image/bmp", 10, 10)),
  ],
  [
    "a file whose bytes do not match its format",
    () => info.mockResolvedValue(size("image/gif", 10, 10)),
  ],
])("does not store %s", async (_case, arrange) => {
  arrange()
  expect(await storableImage(images, new Blob([png(10, 10)]))).toBeNull()
  expect(transform).not.toHaveBeenCalled()
})

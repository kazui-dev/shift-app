import { beforeEach, expect, it, vi } from "vite-plus/test"
import { fetchLink } from "../../src/services/link-fetch"
import { loadLinkImage } from "../../src/services/link-preview"
vi.mock("../../src/services/link-fetch", async (original) => ({
  ...(await original<typeof import("../../src/services/link-fetch")>()),
  fetchLink: vi.fn<typeof fetchLink>(),
}))
const transform = vi.fn<(options: ImageTransform) => void>()
const output = vi.fn<(options: ImageOutputOptions) => void>()
const info = vi.fn<() => Promise<ImageInfoResponse>>()
const transformer: ImageTransformer = {
  transform: (options) => {
    transform(options)
    return transformer
  },
  draw: () => transformer,
  output: async (options) => {
    output(options)
    return {
      response: () => new Response("card"),
      contentType: () => "image/webp",
      image: () => new Response("card").body ?? new ReadableStream(),
    }
  },
}
const images = { info, input: () => transformer }
beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(fetchLink).mockImplementation(async (value) => ({
    response: new Response("image"),
    url: new URL(value),
  }))
})
it("crops a page's image to the card's square as a still WebP", async () => {
  info.mockResolvedValue({
    format: "image/gif",
    width: 1200,
    height: 630,
    fileSize: 5,
  })
  const card = await loadLinkImage(images, "https://example.com/card.gif")
  expect(new TextDecoder().decode(card ?? undefined)).toBe("card")
  expect(transform).toHaveBeenCalledWith({
    width: 336,
    height: 336,
    fit: "cover",
  })
  expect(output).toHaveBeenCalledWith({
    format: "image/webp",
    quality: 85,
    anim: false,
  })
})
const unshowable: ImageInfoResponse[] = [
  { format: "image/svg+xml" },
  { format: "image/bmp", width: 10, height: 10, fileSize: 5 },
  { format: "image/png", width: 20_000, height: 10_000, fileSize: 5 },
]
it.each(unshowable)(
  "has no card image for what cannot be shown safely: %o",
  async (read) => {
    info.mockResolvedValue(read)
    expect(await loadLinkImage(images, "https://example.com/card")).toBeNull()
    expect(transform).not.toHaveBeenCalled()
  }
)
it("has no card image when the image cannot be fetched", async () => {
  vi.mocked(fetchLink).mockRejectedValue(new Error("Preview unavailable"))
  expect(await loadLinkImage(images, "https://example.com/card")).toBeNull()
})

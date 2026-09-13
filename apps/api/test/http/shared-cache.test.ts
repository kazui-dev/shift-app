import { beforeEach, describe, expect, it, vi } from "vite-plus/test"
import { sharedApp } from "../../src/routes/shared"
import { linkPreview } from "../../src/lib/shared-cache"
import { loadLinkImage, loadLinkPreview } from "../../src/services/link-preview"
vi.mock("../../src/lib/shared-cache", () => ({
  linkPreview: vi.fn<typeof linkPreview>(),
}))
vi.mock("../../src/services/link-preview", () => ({
  loadLinkPreview: vi.fn<typeof loadLinkPreview>(),
  loadLinkImage: vi.fn<typeof loadLinkImage>(),
}))
const env = { IMAGES: {} }
const page = "https://example.com/path"
const preview = {
  url: page,
  title: "Example",
  description: "",
  site: "example.com",
  image: "https://example.com/card.png",
}
const request = (path: string) =>
  sharedApp.request(`${path}?url=${encodeURIComponent(page)}`, {}, env)
beforeEach(() => {
  vi.clearAllMocks()
})
it("caches a page's preview for a day and a failed read briefly", async () => {
  vi.mocked(loadLinkPreview).mockResolvedValue(preview)
  const found = await request("/v1/link-previews")
  expect(await found.json()).toEqual({ preview })
  expect(found.headers.get("Cache-Control")).toBe("public, max-age=86400")
  expect(loadLinkPreview).toHaveBeenCalledWith(page)

  vi.mocked(loadLinkPreview).mockResolvedValue(null)
  const missing = await request("/v1/link-previews")
  expect(await missing.json()).toEqual({ preview: null })
  expect(missing.headers.get("Cache-Control")).toBe("public, max-age=300")
})
it("builds a card image from the cached preview and keeps it for a week", async () => {
  vi.mocked(linkPreview).mockResolvedValue(preview)
  vi.mocked(loadLinkImage).mockResolvedValue(new Uint8Array([1, 2]).buffer)
  const found = await request("/v1/link-images")
  expect(new Uint8Array(await found.arrayBuffer())).toEqual(
    new Uint8Array([1, 2])
  )
  expect(found.headers.get("Content-Type")).toBe("image/webp")
  expect(found.headers.get("Cache-Control")).toBe("public, max-age=604800")
  expect(linkPreview).toHaveBeenCalledWith(page)
  expect(loadLinkImage).toHaveBeenCalledWith(env.IMAGES, preview.image)
})
describe("chat images", () => {
  type Stored = {
    body: ReadableStream | null
    httpMetadata: { contentType: string }
  }
  const get = vi.fn<(key: string) => Promise<Stored | null>>()
  const transform = vi.fn<(options: ImageTransform) => void>()
  const output = vi.fn<(options: ImageOutputOptions) => void>()
  const transformer: ImageTransformer = {
    transform: (options) => {
      transform(options)
      return transformer
    },
    draw: () => transformer,
    output: async (options) => {
      output(options)
      return {
        response: () => new Response("scaled"),
        contentType: () => "image/webp",
        image: () => new Response("scaled").body ?? new ReadableStream(),
      }
    },
  }
  const images = {
    CHAT_IMAGES: { get },
    IMAGES: { input: () => transformer },
  }
  const stored = (): Stored => ({
    body: new Response("original").body,
    httpMetadata: { contentType: "image/png" },
  })
  const path = "/v1/chat-images/room/image"
  it("serves the original for a month, tagged for deletion", async () => {
    get.mockResolvedValue(stored())
    const response = await sharedApp.request(`${path}/original`, {}, images)
    expect(await response.text()).toBe("original")
    expect(Object.fromEntries(response.headers)).toMatchObject({
      "content-type": "image/png",
      "cache-control": "public, max-age=2592000",
      "cache-tag": "chat-image:image,chat-room:room",
    })
    expect(get).toHaveBeenCalledWith("room/image")
    expect(transform).not.toHaveBeenCalled()
  })
  it("scales a size down to a still WebP", async () => {
    get.mockResolvedValue(stored())
    const response = await sharedApp.request(`${path}/1280`, {}, images)
    expect(await response.text()).toBe("scaled")
    expect(response.headers.get("Content-Type")).toBe("image/webp")
    expect(response.headers.get("Cache-Tag")).toBe(
      "chat-image:image,chat-room:room"
    )
    expect(transform).toHaveBeenCalledWith({
      width: 1280,
      height: 1280,
      fit: "scale-down",
    })
    expect(output).toHaveBeenCalledWith({
      format: "image/webp",
      quality: 85,
      anim: false,
    })
  })
  it("never caches a missing image, an unknown size or a failure", async () => {
    const unknown = await sharedApp.request(`${path}/100`, {}, images)
    expect(unknown.status).toBe(404)
    expect(unknown.headers.get("Cache-Control")).toBe("no-store")
    expect(get).not.toHaveBeenCalled()
    get.mockResolvedValue(null)
    const missing = await sharedApp.request(`${path}/640`, {}, images)
    expect(missing.status).toBe(404)
    expect(missing.headers.get("Cache-Control")).toBe("no-store")
    get.mockRejectedValue(new Error("R2 unavailable"))
    const failed = await sharedApp.request(`${path}/640`, {}, images)
    expect(failed.status).toBe(500)
    expect(failed.headers.get("Cache-Control")).toBe("no-store")
  })
})
it("keeps a missing card image briefly without reading pages that have none", async () => {
  vi.mocked(linkPreview).mockResolvedValue({ ...preview, image: null })
  const imageless = await request("/v1/link-images")
  expect(imageless.status).toBe(404)
  expect(imageless.headers.get("Cache-Control")).toBe("public, max-age=300")
  expect(loadLinkImage).not.toHaveBeenCalled()

  vi.mocked(linkPreview).mockResolvedValue(preview)
  vi.mocked(loadLinkImage).mockResolvedValue(null)
  expect((await request("/v1/link-images")).status).toBe(404)
})

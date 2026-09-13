import { beforeEach, expect, it, vi } from "vite-plus/test"
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

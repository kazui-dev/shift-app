import { beforeEach, expect, it, vi } from "vite-plus/test"
import { linkPreview, sharedResource } from "../../src/lib/shared-cache"
import { fetchLink } from "../../src/services/link-fetch"
import { makeLinkCard } from "../../src/services/link-card"

vi.mock("../../src/lib/shared-cache", async (original) => ({
  ...(await original<typeof import("../../src/lib/shared-cache")>()),
  linkPreview: vi.fn<typeof linkPreview>(),
  sharedResource: vi.fn<typeof sharedResource>(),
}))
const page = "https://example.com/a"
const preview = {
  url: page,
  title: "A",
  description: "",
  site: "example.com",
  image: "https://example.com/a.png",
}
beforeEach(() => {
  vi.clearAllMocks()
  vi.unstubAllGlobals()
})

it("keeps a card's image only when the card image could be made", async () => {
  vi.mocked(linkPreview).mockResolvedValue(preview)
  vi.mocked(sharedResource).mockResolvedValue(new Response("webp"))
  expect(await makeLinkCard(page)).toEqual(preview)
  expect(sharedResource).toHaveBeenCalledWith("/v1/link-images", { url: page })
  vi.mocked(sharedResource).mockResolvedValue(
    new Response(null, { status: 404 })
  )
  expect(await makeLinkCard(page)).toEqual({ ...preview, image: null })
})

it("has no card without a preview, and makes no image for a page without one", async () => {
  vi.mocked(linkPreview).mockResolvedValue(null)
  expect(await makeLinkCard(page)).toBeNull()
  vi.mocked(linkPreview).mockResolvedValue({ ...preview, image: null })
  expect(await makeLinkCard(page)).toEqual({ ...preview, image: null })
  expect(sharedResource).not.toHaveBeenCalled()
})

it("reads the app's own pages from its assets, without looking them up on the network", async () => {
  const network = vi.fn<typeof fetch>(() =>
    Promise.reject(new Error("network"))
  )
  vi.stubGlobal("fetch", network)
  const assets = {
    fetch: vi.fn<(input: URL, init: RequestInit) => Promise<Response>>(() =>
      Promise.resolve(new Response("<html></html>"))
    ),
  }
  const site = { host: "shift.example", assets }
  const signal = AbortSignal.timeout(1000)
  const { response } = await fetchLink(
    "https://shift.example/",
    "text/html",
    signal,
    site
  )
  expect(await response.text()).toBe("<html></html>")
  expect(assets.fetch).toHaveBeenCalledOnce()
  expect(network).not.toHaveBeenCalled()
  await expect(
    fetchLink("https://other.example/", "text/html", signal, site)
  ).rejects.toThrow("network")
})

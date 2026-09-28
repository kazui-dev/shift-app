import { Hono } from "hono"
import { beforeEach, expect, it, vi } from "vite-plus/test"
import type { LinkPreview } from "@workspace/shared/communications"
import { chatApp } from "../../src/features/chat/routes/index"
import { findAccessibleRoom } from "../../src/features/chat/services/chat-access"
import { sharedResource } from "../../src/lib/shared-cache"
import type { ApiEnv } from "../../src/lib/http"
import { chatRoom } from "../support/chat"
vi.mock("../../src/features/chat/services/chat-access", async (original) => ({
  ...(await original<
    typeof import("../../src/features/chat/services/chat-access")
  >()),
  findAccessibleRoom: vi.fn<typeof findAccessibleRoom>(),
}))
vi.mock("../../src/features/chat/services/chat-profiles", () => ({
  withMemberImages: async (env: unknown, messages: unknown) => messages,
}))
vi.mock("../../src/lib/shared-cache", async (original) => ({
  ...(await original<typeof import("../../src/lib/shared-cache")>()),
  sharedResource: vi.fn<typeof sharedResource>(),
}))
const search =
  vi.fn<
    (
      q: string,
      before: number | null,
      limit: number
    ) => Promise<{ messages: never[]; hasMore: boolean }>
  >()
const stored = vi.fn<(id: string) => Promise<LinkPreview | null>>()
const roomId = "10000000-0000-4000-8000-000000000001",
  messageId = "20000000-0000-4000-8000-000000000001"
const app = new Hono<ApiEnv>()
app.use("*", async (c, next) => {
  c.set("member", {
    id: "trusted",
    userId: "u",
    displayName: "User",
    accessLevel: "member",
  })
  c.header("Cache-Control", "private, no-store")
  await next()
})
app.route("/chat", chatApp)
const env = {
  CHAT_ROOMS: {
    getByName: () => ({ searchMessages: search, linkPreview: stored }),
  },
}
const preview = {
  url: "https://example.com/path",
  title: "Example",
  description: "",
  site: "example.com",
  image: "https://example.com/card.png",
}
beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(findAccessibleRoom).mockResolvedValue(
    chatRoom({ id: roomId, name: "Chat", createdBy: "trusted" })
  )
  search.mockResolvedValue({ messages: [], hasMore: false })
  stored.mockResolvedValue(preview)
})
it("validates search terms and scopes search to an accessible chat", async () => {
  const url = `/chat/rooms/${roomId}/messages`
  expect((await app.request(`${url}?q=&limit=30`, {}, env)).status).toBe(422)
  expect(search).not.toHaveBeenCalled()
  expect(
    (await app.request(`${url}?q=集合&before=80&limit=30`, {}, env)).status
  ).toBe(200)
  expect(search).toHaveBeenCalledWith("集合", 80, 30, {
    memberId: "trusted",
    readsPrivate: false,
  })
  vi.mocked(findAccessibleRoom).mockResolvedValue(null)
  expect((await app.request(`${url}?q=集合`, {}, env)).status).toBe(404)
  expect(search).toHaveBeenCalledTimes(1)
})
it("hands out the stored card's shared image only as a private response", async () => {
  const url = `/chat/rooms/${roomId}/messages/${messageId}/link-preview/image`
  vi.mocked(sharedResource).mockResolvedValue(
    new Response("webp", {
      headers: { "Cache-Control": "public, max-age=604800" },
    })
  )
  const response = await app.request(url, {}, env)
  expect(await response.text()).toBe("webp")
  expect(Object.fromEntries(response.headers)).toMatchObject({
    "cache-control": "private, no-store",
    "content-type": "image/webp",
    "x-content-type-options": "nosniff",
    "cross-origin-resource-policy": "same-origin",
  })
  expect(stored).toHaveBeenCalledWith(messageId, {
    memberId: "trusted",
    readsPrivate: false,
  })
  expect(sharedResource).toHaveBeenCalledWith("/v1/link-images", {
    url: "https://example.com/path",
  })

  vi.mocked(sharedResource).mockResolvedValue(
    new Response(null, { status: 404 })
  )
  expect((await app.request(url, {}, env)).status).toBe(404)
  stored.mockResolvedValue({ ...preview, image: null })
  expect((await app.request(url, {}, env)).status).toBe(404)
  stored.mockResolvedValue(null)
  expect((await app.request(url, {}, env)).status).toBe(404)
  vi.mocked(findAccessibleRoom).mockResolvedValue(null)
  expect((await app.request(url, {}, env)).status).toBe(404)
  expect(sharedResource).toHaveBeenCalledTimes(2)
})

import { Hono } from "hono"
import { beforeEach, expect, it, vi } from "vite-plus/test"
import { chatApp } from "../../src/routes/chat/index"
import { findAccessibleRoom } from "../../src/services/chat-access"
import { linkPreview, sharedResource } from "../../src/lib/shared-cache"
import type { ApiEnv } from "../../src/lib/http"
vi.mock("../../src/services/chat-access", async (original) => ({
  ...(await original<typeof import("../../src/services/chat-access")>()),
  findAccessibleRoom: vi.fn<typeof findAccessibleRoom>(),
}))
vi.mock("../../src/services/chat-profiles", () => ({
  withMemberImages: async (env: unknown, messages: unknown) => messages,
}))
vi.mock("../../src/lib/shared-cache", () => ({
  linkPreview: vi.fn<typeof linkPreview>(),
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
const content = vi.fn<(id: string) => Promise<string | null>>()
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
    getByName: () => ({ searchMessages: search, messageContent: content }),
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
  vi.mocked(findAccessibleRoom).mockResolvedValue({
    id: roomId,
    year: 2026,
    name: "Chat",
    createdBy: "trusted",
    createdAt: 0,
    updatedAt: 0,
    allowExit: 1,
    activityId: null,
    activityStartsAt: null,
    activityEndsAt: null,
    canPost: 1,
    canManage: 0,
    muted: 0,
    lastRead: 0,
    lastSequence: 0,
  })
  search.mockResolvedValue({ messages: [], hasMore: false })
  content.mockResolvedValue("see https://example.com/path")
  vi.mocked(linkPreview).mockResolvedValue(preview)
})
it("validates search terms and scopes search to an accessible chat", async () => {
  const url = `/chat/rooms/${roomId}/messages`
  expect((await app.request(`${url}?q=&limit=30`, {}, env)).status).toBe(422)
  expect(search).not.toHaveBeenCalled()
  expect(
    (await app.request(`${url}?q=集合&before=80&limit=30`, {}, env)).status
  ).toBe(200)
  expect(search).toHaveBeenCalledWith("集合", 80, 30)
  vi.mocked(findAccessibleRoom).mockResolvedValue(null)
  expect((await app.request(`${url}?q=集合`, {}, env)).status).toBe(404)
  expect(search).toHaveBeenCalledTimes(1)
})
it("previews only the first link of an existing accessible message", async () => {
  const url = `/chat/rooms/${roomId}/messages/${messageId}/link-preview`
  const response = await app.request(url, {}, env)
  expect(await response.json()).toEqual({ preview })
  expect(response.headers.get("Cache-Control")).toBe("private, no-store")
  expect(linkPreview).toHaveBeenCalledWith("https://example.com/path")

  content.mockResolvedValue(null)
  expect(await (await app.request(url, {}, env)).json()).toEqual({
    preview: null,
  })
  vi.mocked(findAccessibleRoom).mockResolvedValue(null)
  expect((await app.request(url, {}, env)).status).toBe(404)
  expect(linkPreview).toHaveBeenCalledTimes(1)
})
it("hands out a shared card image only as a private response", async () => {
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
  expect(sharedResource).toHaveBeenCalledWith("/v1/link-images", {
    url: "https://example.com/path",
  })

  vi.mocked(sharedResource).mockResolvedValue(
    new Response(null, { status: 404 })
  )
  expect((await app.request(url, {}, env)).status).toBe(404)
  content.mockResolvedValue("no link")
  expect((await app.request(url, {}, env)).status).toBe(404)
  expect(sharedResource).toHaveBeenCalledTimes(2)
})

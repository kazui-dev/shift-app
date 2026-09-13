import { Hono } from "hono"
import { beforeEach, expect, it, vi } from "vite-plus/test"
import { chatApp } from "../../src/routes/chat/index"
import { findAccessibleRoom } from "../../src/services/chat-access"
import { cachedLinkPreview } from "../../src/services/link-preview"
import type { ApiEnv } from "../../src/lib/http"
vi.mock("../../src/services/chat-access", async (original) => ({
  ...(await original<typeof import("../../src/services/chat-access")>()),
  findAccessibleRoom: vi.fn<typeof findAccessibleRoom>(),
}))
vi.mock("../../src/services/chat-profiles", () => ({
  withMemberImages: async (env: unknown, messages: unknown) => messages,
}))
vi.mock("../../src/services/link-preview", () => ({
  cachedLinkPreview: vi.fn<typeof cachedLinkPreview>(),
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
  await next()
})
app.route("/chat", chatApp)
const env = {
  CHAT_ROOMS: {
    getByName: () => ({ searchMessages: search, messageContent: content }),
  },
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
  content.mockResolvedValue("https://example.com/path")
  vi.mocked(cachedLinkPreview).mockResolvedValue(null)
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
it("previews only URLs from an existing accessible message", async () => {
  const url = `/chat/rooms/${roomId}/messages/${messageId}/link-preview`
  vi.mocked(findAccessibleRoom).mockResolvedValue(null)
  expect((await app.request(url, {}, env)).status).toBe(404)
  expect(content).not.toHaveBeenCalled()
  expect(cachedLinkPreview).not.toHaveBeenCalled()
})

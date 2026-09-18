import { Hono } from "hono"
import { beforeEach, expect, it, vi } from "vite-plus/test"
import { chatApp } from "../../src/routes/chat/index"
import type { ApiEnv } from "../../src/lib/http"
import { findAccessibleRoom } from "../../src/services/chat-access"
import { chatRoom } from "../support/chat"
vi.mock("../../src/services/chat-access", () => ({
  findAccessibleRoom: vi.fn<typeof findAccessibleRoom>(),
}))
const roomId = "10000000-0000-4000-8000-000000000001",
  messageId = "20000000-0000-4000-8000-000000000001"
const change = vi.fn<() => Promise<{ error: "forbidden" }>>(),
  connect = vi.fn<(request: Request) => Promise<Response>>()
const app = new Hono<ApiEnv>()
app.use("*", async (c, next) => {
  c.set("member", {
    id: "trusted",
    userId: "u",
    displayName: "Name",
    accessLevel: "member",
  })
  await next()
})
app.route("/chat", chatApp)
const env = {
  BETTER_AUTH_URL: "https://app.example",
  CHAT_ROOMS: { getByName: () => ({ changeMessage: change }) },
  CHAT_DIRECTORY: { getByName: () => ({ fetch: connect }) },
}
const room = chatRoom({ id: roomId, createdBy: "trusted" })
beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(findAccessibleRoom).mockResolvedValue(room)
  change.mockResolvedValue({ error: "forbidden" })
  connect.mockResolvedValue(new Response("connected"))
})
it("validates edits before the room call and returns server permission failures", async () => {
  const url = `/chat/rooms/${roomId}/messages/${messageId}`
  expect(
    (
      await app.request(
        url,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: "x".repeat(2001) }),
        },
        env
      )
    ).status
  ).toBe(422)
  expect(change).not.toHaveBeenCalled()
  expect((await app.request(url, { method: "DELETE" }, env)).status).toBe(403)
  // Outside a shift room nobody reads private messages, so no lookup is made.
  expect(change).toHaveBeenCalledWith({
    roomId,
    id: messageId,
    memberId: "trusted",
    readsPrivate: false,
  })
})

it("never reaches the room when the member cannot read it", async () => {
  vi.mocked(findAccessibleRoom).mockResolvedValue(null)
  const url = `/chat/rooms/${roomId}/messages/${messageId}`
  expect((await app.request(url, { method: "DELETE" }, env)).status).toBe(404)
  expect(change).not.toHaveBeenCalled()
})
it("rejects cross-origin directory connections and replaces caller-supplied identity", async () => {
  expect(
    (
      await app.request(
        "/chat/events",
        {
          headers: { Upgrade: "websocket", Origin: "https://outside.example" },
        },
        env
      )
    ).status
  ).toBe(403)
  expect(connect).not.toHaveBeenCalled()
  await app.request(
    "/chat/events",
    {
      headers: {
        Upgrade: "websocket",
        Origin: "https://app.example",
        "X-Member-Id": "forged",
      },
    },
    env
  )
  expect(connect.mock.calls[0]?.[0].headers.get("X-Member-Id")).toBe("trusted")
})

import { Hono } from "hono"
import { beforeEach, expect, it, vi } from "vite-plus/test"
import { chatApp } from "../../src/routes/chat"
import type { ApiEnv } from "../../src/lib/http"
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
beforeEach(() => {
  vi.clearAllMocks()
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
  expect(change).toHaveBeenCalledWith({
    roomId,
    id: messageId,
    memberId: "trusted",
  })
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
        "X-Chat-Member-Id": "forged",
      },
    },
    env
  )
  expect(connect.mock.calls[0]?.[0].headers.get("X-Chat-Member-Id")).toBe(
    "trusted"
  )
})

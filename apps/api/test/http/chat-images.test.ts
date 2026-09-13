import { Hono } from "hono"
import { beforeEach, expect, it, vi } from "vite-plus/test"
import type { ApiEnv } from "../../src/lib/http"
import { chatApp } from "../../src/routes/chat/index"
import {
  findAccessibleRoom,
  type RoomRow,
} from "../../src/services/chat-access"
vi.mock("../../src/services/chat-access", () => ({
  findAccessibleRoom: vi.fn<typeof findAccessibleRoom>(),
}))
const roomId = crypto.randomUUID(),
  imageId = crypto.randomUUID()
const room: RoomRow = {
  id: roomId,
  year: 2026,
  name: "連絡",
  createdBy: "m",
  createdAt: 0,
  updatedAt: 0,
  allowExit: 1,
  activityId: null,
  activityStartsAt: null,
  activityEndsAt: null,
  canPost: 1,
  canManage: 1,
  muted: 0,
  lastRead: 0,
  lastSequence: 0,
}
const getAttachment =
  vi.fn<
    (id: string, before: number | null) => Promise<{ objectKey: string } | null>
  >()
const reserveAttachment =
  vi.fn<() => Promise<{ id: string; objectKey: string } | null>>()
const remove = vi.fn<() => Promise<boolean>>()
const info =
  vi.fn<() => Promise<{ format: string; width: number; height: number }>>()
const bucketGet =
  vi.fn<
    () => Promise<{ body: ReadableStream<Uint8Array>; size: number } | null>
  >()
const env = {
  CHAT_ROOMS: {
    getByName: () => ({
      getAttachment,
      reserveAttachment,
      deleteAttachment: remove,
    }),
  },
  IMAGES: { info },
  CHAT_IMAGES: { get: bucketGet },
}
const app = new Hono<ApiEnv>()
app.use("*", async (c, next) => {
  c.set("member", {
    id: "m",
    userId: "u",
    displayName: "名前",
    accessLevel: "member",
  })
  await next()
})
app.route("/chat", chatApp)
beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(findAccessibleRoom).mockResolvedValue(room)
})
it("does not touch storage when room access is denied", async () => {
  vi.mocked(findAccessibleRoom).mockResolvedValue(null)
  expect(
    (await app.request(`/chat/rooms/${roomId}/attachments/${imageId}`, {}, env))
      .status
  ).toBe(404)
  expect(
    (
      await app.request(
        `/chat/rooms/${roomId}/attachments`,
        { method: "POST", body: "image" },
        env
      )
    ).status
  ).toBe(404)
  expect(getAttachment).not.toHaveBeenCalled()
  expect(reserveAttachment).not.toHaveBeenCalled()
})

it("refuses to upload into a readable room the member cannot post to", async () => {
  vi.mocked(findAccessibleRoom).mockResolvedValue({ ...room, canPost: 0 })
  expect(
    (
      await app.request(
        `/chat/rooms/${roomId}/attachments`,
        { method: "POST", body: "image" },
        env
      )
    ).status
  ).toBe(403)
  expect(reserveAttachment).not.toHaveBeenCalled()
})
it("never caches protected images publicly", async () => {
  getAttachment.mockResolvedValue({ objectKey: "private" })
  bucketGet.mockResolvedValue({ body: new Blob(["image"]).stream(), size: 5 })
  const response = await app.request(
    `/chat/rooms/${roomId}/attachments/${imageId}`,
    {},
    env
  )
  expect(response.status).toBe(200)
  expect(getAttachment).toHaveBeenCalledWith(imageId)
  expect(response.headers.get("Cache-Control")).toBe("private, no-store")
  expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff")
  expect(response.headers.get("Cross-Origin-Resource-Policy")).toBe(
    "same-origin"
  )
})
it("rejects spoofed image types using decoded format and removes their reservation", async () => {
  reserveAttachment.mockResolvedValue({ id: imageId, objectKey: "pending" })
  info.mockResolvedValue({ format: "image/svg+xml", width: 1, height: 1 })
  const response = await app.request(
    `/chat/rooms/${roomId}/attachments`,
    {
      method: "POST",
      headers: { "Content-Type": "image/png" },
      body: "<svg/>",
    },
    env
  )
  expect(response.status).toBe(422)
  expect(remove).toHaveBeenCalledWith(imageId, "m")
})
it("rejects empty uploads before allocating storage", async () => {
  expect(
    (
      await app.request(
        `/chat/rooms/${roomId}/attachments`,
        { method: "POST", body: "" },
        env
      )
    ).status
  ).toBe(413)
  expect(reserveAttachment).not.toHaveBeenCalled()
})

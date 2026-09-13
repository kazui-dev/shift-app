import { Hono } from "hono"
import { beforeEach, expect, it, vi } from "vite-plus/test"
import type { ApiEnv } from "../../src/lib/http"
import { sharedResource, warmShared } from "../../src/lib/shared-cache"
import { chatApp } from "../../src/routes/chat/index"
import { findAccessibleRoom } from "../../src/services/chat-access"
import { storableImage } from "../../src/services/chat-image"
import { chatRoom } from "../support/chat"
vi.mock("../../src/services/chat-access", () => ({
  findAccessibleRoom: vi.fn<typeof findAccessibleRoom>(),
}))
vi.mock("../../src/services/chat-image", () => ({
  storableImage: vi.fn<typeof storableImage>(),
}))
vi.mock("../../src/lib/shared-cache", async (original) => ({
  ...(await original<typeof import("../../src/lib/shared-cache")>()),
  sharedResource: vi.fn<typeof sharedResource>(),
  warmShared: vi.fn<typeof warmShared>(),
}))
const roomId = crypto.randomUUID(),
  imageId = crypto.randomUUID()
const room = chatRoom({ id: roomId, canManage: 1 })
const getAttachment =
  vi.fn<(id: string) => Promise<{ name: string; type: string } | null>>()
const reserveAttachment =
  vi.fn<
    (
      roomId: string,
      memberId: string,
      bytes: number
    ) => Promise<{ id: string; objectKey: string } | null>
  >()
const finishAttachment = vi.fn<() => Promise<boolean>>()
const remove = vi.fn<() => Promise<boolean>>()
const put = vi.fn<() => Promise<void>>()
const tasks: Promise<unknown>[] = []
const env = {
  CHAT_ROOMS: {
    getByName: () => ({
      getAttachment,
      reserveAttachment,
      finishAttachment,
      deleteAttachment: remove,
    }),
  },
  IMAGES: {},
  CHAT_IMAGES: { put, delete: vi.fn<() => Promise<void>>() },
}
const context = {
  waitUntil: (task: Promise<unknown>) => tasks.push(task),
  passThroughOnException: () => undefined,
  props: {},
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
const upload = (name = "", body: BodyInit = "image") =>
  app.request(
    `/chat/rooms/${roomId}/attachments${name ? `?name=${encodeURIComponent(name)}` : ""}`,
    { method: "POST", body },
    env,
    context
  )
const image = (query = "") =>
  app.request(
    `/chat/rooms/${roomId}/attachments/${imageId}${query}`,
    {},
    env,
    context
  )
beforeEach(() => {
  vi.resetAllMocks()
  tasks.length = 0
  vi.mocked(findAccessibleRoom).mockResolvedValue(room)
  reserveAttachment.mockResolvedValue({
    id: imageId,
    objectKey: `${roomId}/${imageId}`,
  })
  finishAttachment.mockResolvedValue(true)
  getAttachment.mockResolvedValue({ name: "旅行 (1).png", type: "image/png" })
  vi.mocked(sharedResource).mockImplementation(
    async () => new Response("image")
  )
})

it("does not touch storage when room access is denied", async () => {
  vi.mocked(findAccessibleRoom).mockResolvedValue(null)
  expect((await image()).status).toBe(404)
  expect((await upload()).status).toBe(404)
  expect(getAttachment).not.toHaveBeenCalled()
  expect(reserveAttachment).not.toHaveBeenCalled()
})

it("refuses to upload into a readable room the member cannot post to", async () => {
  vi.mocked(findAccessibleRoom).mockResolvedValue({ ...room, canPost: 0 })
  expect((await upload()).status).toBe(403)
  expect(reserveAttachment).not.toHaveBeenCalled()
})

it("rejects empty and oversized uploads before allocating storage", async () => {
  expect((await upload("", "")).status).toBe(413)
  expect((await upload("", new Uint8Array(20 * 1024 * 1024 + 1))).status).toBe(
    413
  )
  expect(reserveAttachment).not.toHaveBeenCalled()
})

it("counts an upload's bytes against the daily limit", async () => {
  reserveAttachment.mockResolvedValue(null)
  expect((await upload()).status).toBe(429)
  expect(reserveAttachment).toHaveBeenCalledWith(roomId, "m", 5)
  expect(storableImage).not.toHaveBeenCalled()
})

it("rejects what cannot be stored and removes its reservation", async () => {
  vi.mocked(storableImage).mockResolvedValue(null)
  expect((await upload()).status).toBe(422)
  expect(remove).toHaveBeenCalledWith(imageId, "m")
  expect(put).not.toHaveBeenCalled()
})

it("stores the original under its name and makes the list tiles at once", async () => {
  vi.mocked(storableImage).mockResolvedValue({
    bytes: new Uint8Array([1, 2, 3]),
    width: 30,
    height: 40,
    type: "image/jpeg",
  })
  const response = await upload("IMG_0001.HEIC")
  const attachment = {
    id: imageId,
    width: 30,
    height: 40,
    bytes: 3,
    name: "IMG_0001.jpg",
  }
  expect(response.status).toBe(201)
  expect(await response.json()).toEqual({ attachment })
  expect(put).toHaveBeenCalledWith(
    `${roomId}/${imageId}`,
    new Uint8Array([1, 2, 3]),
    { httpMetadata: { contentType: "image/jpeg" } }
  )
  expect(finishAttachment).toHaveBeenCalledWith(imageId, "m", {
    ...attachment,
    type: "image/jpeg",
  })
  await Promise.all(tasks)
  expect(vi.mocked(warmShared).mock.calls).toEqual([
    [`/v1/chat-images/${roomId}/${imageId}/640`],
    [`/v1/chat-images/${roomId}/${imageId}/1280`],
  ])
})

it("delivers a size as a private WebP from the shared cache", async () => {
  const response = await image("?size=640")
  expect(await response.text()).toBe("image")
  expect(Object.fromEntries(response.headers)).toMatchObject({
    "cache-control": "private, no-store",
    "content-type": "image/webp",
    "content-disposition": "inline",
    "x-content-type-options": "nosniff",
    "cross-origin-resource-policy": "same-origin",
  })
  expect(getAttachment).toHaveBeenCalledWith(imageId)
  expect(sharedResource).toHaveBeenCalledWith(
    `/v1/chat-images/${roomId}/${imageId}/640`
  )
})

it("delivers the original to save under its name", async () => {
  const response = await image()
  expect(response.headers.get("Content-Type")).toBe("image/png")
  expect(response.headers.get("Cache-Control")).toBe("private, no-store")
  expect(response.headers.get("Content-Disposition")).toBe(
    "attachment; filename*=UTF-8''%E6%97%85%E8%A1%8C%20%281%29.png"
  )
  expect(sharedResource).toHaveBeenCalledWith(
    `/v1/chat-images/${roomId}/${imageId}/original`
  )
})

it("finds no image for unknown sizes, unsent images or missing objects", async () => {
  expect((await image("?size=100")).status).toBe(404)
  expect(getAttachment).not.toHaveBeenCalled()
  getAttachment.mockResolvedValue(null)
  expect((await image("?size=640")).status).toBe(404)
  expect(sharedResource).not.toHaveBeenCalled()
  getAttachment.mockResolvedValue({ name: "a.png", type: "image/png" })
  vi.mocked(sharedResource).mockResolvedValue(
    new Response(null, { status: 404 })
  )
  expect((await image("?size=640")).status).toBe(404)
})

import { Hono } from "hono"
import { expect, it } from "vite-plus/test"

import { chatImageLimits } from "@workspace/shared/communications"

import { errorBody, errors } from "../../src/lib/errors"
import { limitRequestBody } from "../../src/routes/request-limits"

const app = new Hono()
app.use("*", limitRequestBody)
app.all("*", async (c) => {
  await c.req.arrayBuffer()
  return c.json({ ok: true as const })
})

const send = (method: string, path: string, bytes: number) =>
  app.request(path, { method, body: new Uint8Array(bytes) })

const upload = "/api/chat/rooms/room/attachments"
const original = "/api/chat/rooms/room/attachments/image/original"

it("lets images up to the chat's limit through, as uploads and as originals", async () => {
  expect((await send("POST", upload, chatImageLimits.bytes)).status).toBe(200)
  expect((await send("PUT", original, chatImageLimits.bytes)).status).toBe(200)
})

it("refuses images past the chat's limit and large bodies anywhere else", async () => {
  const tooLarge = await send("PUT", original, chatImageLimits.bytes + 1)
  expect(tooLarge.status).toBe(413)
  await expect(tooLarge.json()).resolves.toEqual(errorBody(errors.bodyTooLarge))
  expect((await send("POST", upload, chatImageLimits.bytes + 1)).status).toBe(
    413
  )
  expect((await send("PUT", upload, 32 * 1024 + 1)).status).toBe(413)
  expect((await send("POST", "/api/chat/rooms", 32 * 1024 + 1)).status).toBe(
    413
  )
  expect((await send("POST", "/api/chat/rooms", 32 * 1024)).status).toBe(200)
})

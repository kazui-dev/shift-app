import { Hono } from "hono"
import * as v from "valibot"
import {
  pushDeviceCreateSchema,
  pushDeviceUpdateSchema,
} from "@workspace/shared/communications"
import { apiError, type ApiEnv, readJson } from "../lib/http"
import {
  createPushDevice,
  getPushDevice,
  updatePushDevice,
} from "../services/push-devices"

export const pushApp = new Hono<ApiEnv>()
pushApp.get("/config", (c) => c.json({ publicKey: c.env.VAPID_PUBLIC_KEY }))

export const pushDevicesApp = new Hono<ApiEnv>()
pushDevicesApp.post("/", async (c) => {
  const input = v.safeParse(pushDeviceCreateSchema, await readJson(c.req.raw))
  if (!input.success)
    return apiError(c, 422, "INVALID_PUSH_DEVICE", "Invalid device")
  return c.json(
    await createPushDevice(
      c.env.shift_app,
      c.get("member").id,
      input.output.endpoint
    ),
    201
  )
})
pushDevicesApp.use("/:id", async (c, next) => {
  if (!v.is(v.pipe(v.string(), v.uuid()), c.req.param("id")))
    return apiError(c, 422, "INVALID_PUSH_DEVICE", "Invalid device")
  return next()
})
pushDevicesApp.get("/:id", async (c) => {
  const device = await getPushDevice(
    c.env.shift_app,
    c.get("member").id,
    c.req.param("id")
  )
  return device
    ? c.json(device)
    : apiError(c, 404, "NOT_FOUND", "Device not found")
})
pushDevicesApp.put("/:id", async (c) => {
  const input = v.safeParse(pushDeviceUpdateSchema, await readJson(c.req.raw))
  if (!input.success)
    return apiError(c, 422, "INVALID_PUSH_DEVICE", "Invalid device")
  const db = c.env.shift_app,
    memberId = c.get("member").id,
    id = c.req.param("id")
  if (!(await getPushDevice(db, memberId, id)))
    return apiError(c, 404, "NOT_FOUND", "Device not found")
  const device = await updatePushDevice(db, memberId, id, input.output)
  return device
    ? c.json(device)
    : apiError(
        c,
        409,
        "SUBSCRIPTION_CONFLICT",
        "Subscription is already in use"
      )
})

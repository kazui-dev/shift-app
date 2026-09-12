import { Hono } from "hono"
import * as v from "valibot"
import {
  notificationPreferenceSchema,
  pushSubscriptionInputSchema,
} from "@workspace/shared/communications"
import { apiError, type ApiEnv, readJson } from "../lib/http"
import {
  listNotificationDevices,
  saveNotificationPreference,
  saveDeviceSubscription,
} from "../services/notification-devices"

export const pushApp = new Hono<ApiEnv>()
pushApp.get("/config", (c) => c.json({ publicKey: c.env.VAPID_PUBLIC_KEY }))
export const notificationDevicesApp = new Hono<ApiEnv>()
notificationDevicesApp.get("/", async (c) =>
  c.json(await listNotificationDevices(c.env.shift_app, c.get("member").id))
)
notificationDevicesApp.use("/:deviceId/*", async (c, next) => {
  if (!v.is(v.pipe(v.string(), v.uuid()), c.req.param("deviceId")))
    return apiError(c, 422, "INVALID_DEVICE", "Invalid device")
  return next()
})
notificationDevicesApp.put("/:deviceId", async (c) => {
  const id = c.req.param("deviceId")
  const input = v.safeParse(
    notificationPreferenceSchema,
    await readJson(c.req.raw)
  )
  if (!v.is(v.pipe(v.string(), v.uuid()), id) || !input.success)
    return apiError(
      c,
      422,
      "INVALID_NOTIFICATION_SETTINGS",
      "Invalid notification settings"
    )
  const saved = await saveNotificationPreference(
    c.env.shift_app,
    c.get("member").id,
    id,
    input.output.enabled
  )
  return saved
    ? c.body(null, 204)
    : apiError(c, 404, "NOT_FOUND", "Device not found")
})
notificationDevicesApp.put("/:deviceId/subscription", async (c) => {
  const input = v.safeParse(
    pushSubscriptionInputSchema,
    await readJson(c.req.raw)
  )
  if (!input.success)
    return apiError(c, 422, "INVALID_PUSH_SUBSCRIPTION", "Invalid subscription")
  const saved = await saveDeviceSubscription(
    c.env.shift_app,
    c.get("member").id,
    c.req.param("deviceId"),
    input.output
  )
  return saved
    ? c.body(null, 204)
    : apiError(c, 409, "SUBSCRIPTION_CONFLICT", "Subscription is unavailable")
})

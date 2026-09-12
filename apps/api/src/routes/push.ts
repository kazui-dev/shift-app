import { Hono } from "hono"
import * as v from "valibot"
import {
  pushEndpointSchema,
  pushSubscriptionInputSchema,
} from "@workspace/shared/communications"
import { apiError, type ApiEnv, readJson } from "../lib/http"
import {
  listPushSubscriptions,
  savePushSubscription,
  disablePushSubscription,
} from "../services/push-subscriptions"

export const pushApp = new Hono<ApiEnv>()
pushApp.get("/config", (c) => c.json({ publicKey: c.env.VAPID_PUBLIC_KEY }))
export const pushSubscriptionsApp = new Hono<ApiEnv>()
pushSubscriptionsApp.get("/", async (c) =>
  c.json(await listPushSubscriptions(c.env.shift_app, c.get("member").id))
)
pushSubscriptionsApp.post("/", async (c) => {
  const input = v.safeParse(
    pushSubscriptionInputSchema,
    await readJson(c.req.raw)
  )
  if (!input.success)
    return apiError(c, 422, "INVALID_PUSH_SUBSCRIPTION", "Invalid subscription")
  const saved = await savePushSubscription(
    c.env.shift_app,
    c.get("member").id,
    input.output
  )
  return saved
    ? c.body(null, 204)
    : apiError(
        c,
        409,
        "SUBSCRIPTION_CONFLICT",
        "Subscription is already in use"
      )
})
pushSubscriptionsApp.delete("/", async (c) => {
  const input = v.safeParse(pushEndpointSchema, await readJson(c.req.raw))
  if (!input.success)
    return apiError(c, 422, "INVALID_PUSH_SUBSCRIPTION", "Invalid subscription")
  await disablePushSubscription(
    c.env.shift_app,
    c.get("member").id,
    input.output.endpoint
  )
  return c.body(null, 204)
})

import { Hono } from "hono"

import {
  deletePushSubscriptionInputSchema,
  pushSubscriptionInputSchema,
} from "@workspace/shared/communications"

import { apiError, type ApiEnv, readJson } from "../http"

export const pushApp = new Hono<ApiEnv>()

pushApp.get("/config", (c) => c.json({ publicKey: c.env.VAPID_PUBLIC_KEY }))

pushApp.post("/subscriptions", async (c) => {
  const input = pushSubscriptionInputSchema.safeParse(await readJson(c.req.raw))
  if (!input.success) {
    return apiError(c, 422, "INVALID_PUSH_SUBSCRIPTION", "Invalid subscription")
  }
  const member = c.get("member")
  const now = Date.now()
  const result = await c.env.shift_app
    .prepare(
      `INSERT INTO push_subscriptions
        (id, member_id, endpoint, expiration_time, p256dh, auth, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(endpoint) DO UPDATE SET
         expiration_time = excluded.expiration_time,
         p256dh = excluded.p256dh,
         auth = excluded.auth,
         updated_at = excluded.updated_at
       WHERE push_subscriptions.member_id = excluded.member_id`
    )
    .bind(
      crypto.randomUUID(),
      member.id,
      input.data.endpoint,
      input.data.expirationTime,
      input.data.keys.p256dh,
      input.data.keys.auth,
      now,
      now
    )
    .run()
  if (result.meta.changes !== 1) {
    return apiError(
      c,
      409,
      "SUBSCRIPTION_CONFLICT",
      "Subscription is already in use"
    )
  }
  return c.json({ ok: true as const }, 201)
})

pushApp.delete("/subscriptions", async (c) => {
  const input = deletePushSubscriptionInputSchema.safeParse(
    await readJson(c.req.raw)
  )
  if (!input.success) {
    return apiError(c, 422, "INVALID_PUSH_SUBSCRIPTION", "Invalid subscription")
  }
  await c.env.shift_app
    .prepare(
      "DELETE FROM push_subscriptions WHERE endpoint = ? AND member_id = ?"
    )
    .bind(input.data.endpoint, c.get("member").id)
    .run()
  return c.body(null, 204)
})

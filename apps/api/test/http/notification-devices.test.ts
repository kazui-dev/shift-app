import { Hono } from "hono"
import { expect, it } from "vite-plus/test"
import type { ApiEnv } from "../../src/lib/http"
import { notificationDevicesApp } from "../../src/routes/push"
const app = new Hono<ApiEnv>().route(
  "/me/notification-devices",
  notificationDevicesApp
)
it.each([
  "bad-id",
  "00000000-0000-4000-8000-000000000000",
  "00000000-0000-4000-8000-000000000000/subscription",
])("validates device input before database access: %s", async (path) => {
  const response = await app.request(`/me/notification-devices/${path}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ enabled: "bad" }),
  })
  expect(response.status).toBe(422)
})

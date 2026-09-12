import { Hono } from "hono"
import { expect, it } from "vite-plus/test"
import type { ApiEnv } from "../../src/lib/http"
import { pushSubscriptionsApp } from "../../src/routes/push"
const app = new Hono<ApiEnv>().route(
  "/me/push-subscriptions",
  pushSubscriptionsApp
)
it.each(["POST", "DELETE"])(
  "validates %s before accessing the database",
  async (method) => {
    const response = await app.request("/me/push-subscriptions", {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ endpoint: "invalid" }),
    })
    expect(response.status).toBe(422)
  }
)

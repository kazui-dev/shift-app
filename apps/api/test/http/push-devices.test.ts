import { Hono } from "hono"
import { expect, it } from "vite-plus/test"
import type { ApiEnv } from "../../src/lib/http"
import { pushDevicesApp } from "../../src/routes/push"
const app = new Hono<ApiEnv>().route("/me/push-devices", pushDevicesApp)
it.each([
  {},
  { enabled: true },
  { enabled: false, subscription: {} },
  { enabled: true, subscription: { endpoint: "not-url" } },
])("validates settings before reading the database: %j", async (body) => {
  const response = await app.request(
    "/me/push-devices/11111111-1111-4111-8111-111111111111",
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }
  )
  expect(response.status).toBe(422)
})
it("rejects malformed device identifiers", async () => {
  expect((await app.request("/me/push-devices/not-an-id")).status).toBe(422)
})

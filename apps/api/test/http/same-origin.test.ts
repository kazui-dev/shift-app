import { Hono } from "hono"
import { describe, expect, it } from "vite-plus/test"

import { requireSameOriginForMutation } from "../../src/lib/http"

const origin = "https://shift.example.test"
const app = new Hono<{
  Bindings: { BETTER_AUTH_URL: string }
}>()

app.use("*", requireSameOriginForMutation)
app.all("/resource", (c) => c.json({ ok: true as const }))

describe("same-origin mutation boundary", () => {
  it("allows reads without an Origin header", async () => {
    const response = await app.request("/resource", undefined, {
      BETTER_AUTH_URL: origin,
    })

    expect(response.status).toBe(200)
  })

  it.each([
    ["a missing Origin header", undefined],
    ["a different Origin header", "https://attacker.example.test"],
  ])("rejects mutations with %s", async (_label, requestOrigin) => {
    const headers = new Headers()
    if (requestOrigin) headers.set("Origin", requestOrigin)

    const response = await app.request(
      "/resource",
      { method: "PUT", headers },
      { BETTER_AUTH_URL: origin }
    )

    expect(response.status).toBe(403)
    await expect(response.json()).resolves.toEqual({
      error: {
        code: "FORBIDDEN_ORIGIN",
        message: "Request origin is not allowed",
      },
    })
  })

  it("allows mutations from the configured Origin", async () => {
    const response = await app.request(
      "/resource",
      { method: "PUT", headers: { Origin: origin } },
      { BETTER_AUTH_URL: origin }
    )

    expect(response.status).toBe(200)
  })
})

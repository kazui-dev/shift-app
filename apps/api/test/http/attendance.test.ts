import { Hono } from "hono"
import { describe, expect, it } from "vite-plus/test"
import type { ApiEnv } from "../../src/lib/http"
import { assignmentsApp } from "../../src/routes/assignments"
const app = new Hono<ApiEnv>()
app.route("/assignments", assignmentsApp)
describe("attendance input boundary", () => {
  it.each([
    "{}",
    '{"latitude":35.748,"longitude":139.806}',
    "{",
    '{"locationConfirmed":"yes"}',
  ])("rejects invalid payload before storage: %s", async (body) => {
    const res = await app.request(
      "/assignments/00000000-0000-4000-8000-000000000001/attendance",
      { method: "PUT", headers: { "Content-Type": "application/json" }, body }
    )
    expect(res.status).toBe(422)
  })
  it("rejects a correction without a reason before storage", async () => {
    const res = await app.request(
      "/assignments/00000000-0000-4000-8000-000000000001/attendance",
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          checkedInAt: "2026-09-11T01:00:00.000Z",
          reason: " ",
        }),
      }
    )
    expect(res.status).toBe(422)
  })
})

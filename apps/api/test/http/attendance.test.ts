import { Hono } from "hono"
import { describe, expect, it } from "vite-plus/test"
import type { ApiEnv } from "../../src/lib/http"
import { assignmentsApp } from "../../src/routes/assignments"
const app = new Hono<ApiEnv>()
app.route("/assignments", assignmentsApp)
const url = "/assignments/00000000-0000-4000-8000-000000000001/attendance"
describe("attendance input boundary", () => {
  it.each([
    "{}",
    "{",
    '{"state":"present"}',
    '{"state":"present","locationConfirmed":"yes"}',
    '{"state":"late","expectedAt":"soon"}',
    '{"state":"gone"}',
  ])("rejects invalid payload before storage: %s", async (body) => {
    const res = await app.request(url, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body,
    })
    expect(res.status).toBe(422)
  })
  it("rejects a correction without a reason before storage", async () => {
    const res = await app.request(url, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "correct",
        checkedInAt: "2026-09-11T01:00:00.000Z",
        reason: " ",
      }),
    })
    expect(res.status).toBe(422)
  })
})

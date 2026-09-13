import { Hono } from "hono"
import { errorBody, errors } from "../../src/lib/errors"
import { describe, expect, it, vi } from "vite-plus/test"
import type { ApiEnv } from "../../src/lib/http"
import { attendanceEventsApp } from "../../src/routes/attendance-events"
import { canManageActivity } from "../../src/services/activity-access"
vi.mock("../../src/services/activity-access", () => ({
  canManageActivity: vi.fn<typeof canManageActivity>(),
}))

describe("attendance history visibility", () => {
  it.each([
    { actor: "owner", manager: false, status: 200 },
    { actor: "manager", manager: true, status: 200 },
    { actor: "participant", manager: false, status: 403 },
  ])("returns $status for $actor", async ({ actor, manager, status }) => {
    vi.mocked(canManageActivity).mockResolvedValue(manager)
    const all = vi
      .fn<
        () => Promise<{
          results: {
            id: string
            before: null
            after: number
            reason: string
            createdAt: number
            actor: string
          }[]
        }>
      >()
      .mockResolvedValue({
        results: [
          {
            id: "event",
            before: null,
            after: 1000,
            reason: "確認",
            createdAt: 2000,
            actor: "責任者",
          },
        ],
      })
    const first = vi
      .fn<
        () => Promise<{ memberId: string; activityId: string; year: number }>
      >()
      .mockResolvedValue({ memberId: "owner", activityId: "shift", year: 2026 })
    const binding = { prepare: () => ({ bind: () => ({ first, all }) }) }
    const app = new Hono<ApiEnv>()
    app.use("*", async (c, next) => {
      c.set("member", {
        id: actor,
        userId: actor,
        displayName: actor,
        accessLevel: "member",
      })
      await next()
    })
    app.route("/", attendanceEventsApp)
    const response = await app.request(
      "/shift/attendance/events",
      {},
      { shift_app: binding }
    )
    expect(response.status).toBe(status)
    expect(all).toHaveBeenCalledTimes(status === 403 ? 0 : 1)
    const payload = await response.json()
    expect(payload).toEqual(
      status === 403
        ? errorBody(errors.attendanceViewForbidden)
        : {
            events: [
              {
                id: "event",
                before: null,
                after: new Date(1000).toISOString(),
                reason: "確認",
                createdAt: new Date(2000).toISOString(),
                actor: "責任者",
              },
            ],
          }
    )
  })
})

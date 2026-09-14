import { Hono } from "hono"
import { errorBody, errors } from "../../src/lib/errors"
import { describe, expect, it, vi } from "vite-plus/test"
import type { ApiEnv } from "../../src/lib/http"
import { assignmentsApp } from "../../src/routes/assignments"
import { canManageActivity } from "../../src/services/activity-access"
vi.mock("../../src/services/activity-access", () => ({
  canManageActivity: vi.fn<typeof canManageActivity>(),
}))

const assignmentId = "00000000-0000-4000-8000-000000000001"

describe("attendance history visibility", () => {
  it.each([
    { actor: "owner", manager: false, status: 200 },
    { actor: "manager", manager: true, status: 200 },
    { actor: "participant", manager: false, status: 403 },
  ])("returns $status for $actor", async ({ actor, manager, status }) => {
    vi.mocked(canManageActivity).mockResolvedValue(manager)
    const all = vi
      .fn<() => Promise<{ results: Record<string, unknown>[] }>>()
      .mockResolvedValue({
        results: [
          {
            id: "event",
            actor: "責任者",
            action: "corrected",
            expectedAt: null,
            checkedInAt: 1000,
            previousCheckedInAt: null,
            reason: "確認",
            createdAt: 2000,
          },
        ],
      })
    const first = vi
      .fn<() => Promise<Record<string, unknown>>>()
      .mockResolvedValue({
        assignmentId,
        memberId: "owner",
        memberDisplayName: "本人",
        activityId: "shift",
        activityName: "受付",
        year: 2026,
        active: 1,
        attendanceState: null,
        attendanceExpectedAt: null,
        attendanceReason: null,
        attendanceCheckedInAt: null,
        attendanceCheckInStatus: null,
        attendanceResolvedAt: null,
        attendanceUpdatedAt: null,
      })
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
    app.route("/", assignmentsApp)
    const response = await app.request(
      `/${assignmentId}/attendance/events`,
      {},
      { shift_app: binding }
    )
    expect(response.status).toBe(status)
    expect(all).toHaveBeenCalledTimes(status === 403 ? 0 : 1)
    expect(await response.json()).toEqual(
      status === 403
        ? errorBody(errors.attendanceViewForbidden)
        : {
            events: [
              {
                id: "event",
                actor: "責任者",
                action: "corrected",
                expectedAt: null,
                checkedInAt: new Date(1000).toISOString(),
                previousCheckedInAt: null,
                reason: "確認",
                createdAt: new Date(2000).toISOString(),
              },
            ],
          }
    )
  })
})

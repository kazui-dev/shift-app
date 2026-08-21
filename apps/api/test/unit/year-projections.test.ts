import { describe, expect, it } from "vite-plus/test"

import {
  groupAvailabilitySubmissions,
  serializeActivity,
  type AvailabilityManagerRow,
} from "../../src/domain/year-projections"

describe("year route transformations", () => {
  it("serializes activity timestamps", () => {
    expect(
      serializeActivity({
        id: "activity-1",
        year: 2026,
        name: "受付",
        place: "正門",
        activityType: "案内",
        startsAt: Date.parse("2026-11-01T00:00:00.000Z"),
        endsAt: Date.parse("2026-11-01T03:00:00.000Z"),
        color: "#2563EB",
        notes: null,
        assignmentCount: 2,
      })
    ).toMatchObject({
      startsAt: "2026-11-01T00:00:00.000Z",
      endsAt: "2026-11-01T03:00:00.000Z",
      assignmentCount: 2,
    })
  })

  it("groups windows and retains submissions without windows", () => {
    const rows: AvailabilityManagerRow[] = [
      {
        submissionId: "submission-1",
        memberId: "member-1",
        displayName: "旭祭 太郎",
        studentId: "26AJ112",
        status: "submitted",
        submittedAt: Date.parse("2026-10-01T00:00:00.000Z"),
        windowId: "window-1",
        startsAt: Date.parse("2026-11-01T00:00:00.000Z"),
        endsAt: Date.parse("2026-11-01T03:00:00.000Z"),
      },
      {
        submissionId: "submission-2",
        memberId: "member-2",
        displayName: "旭祭 花子",
        studentId: "26AJ113",
        status: "draft",
        submittedAt: null,
        windowId: null,
        startsAt: null,
        endsAt: null,
      },
    ]

    expect(groupAvailabilitySubmissions(rows)).toEqual([
      expect.objectContaining({
        id: "submission-1",
        windows: [expect.objectContaining({ id: "window-1" })],
      }),
      expect.objectContaining({ id: "submission-2", windows: [] }),
    ])
  })
})

import * as v from "valibot"
import { describe, expect, it } from "vite-plus/test"

import {
  activitiesResponseSchema,
  createAssignmentInputSchema,
  createAssignmentReportInputSchema,
  createOperatingYearInputSchema,
  instantSchema,
  operatingYearSchema,
  replaceAvailabilityInputSchema,
  timeWindowSchema,
  yearsResponseSchema,
} from "./shifts"

describe("shift API schemas", () => {
  it("accepts a year without imposing an operating period", () => {
    expect(
      v.parse(createOperatingYearInputSchema, {
        year: 2026,
      })
    ).toMatchObject({ year: 2026, status: "draft" })
  })

  it("rejects overlapping availability windows", () => {
    expect(() =>
      v.parse(replaceAvailabilityInputSchema, {
        status: "submitted",
        windows: [
          {
            startsAt: "2026-11-01T09:00:00+09:00",
            endsAt: "2026-11-01T12:00:00+09:00",
          },
          {
            startsAt: "2026-11-01T11:00:00+09:00",
            endsAt: "2026-11-01T13:00:00+09:00",
          },
        ],
      })
    ).toThrow()
  })

  it("requires both assignment boundaries or neither", () => {
    expect(() =>
      v.parse(createAssignmentInputSchema, {
        memberId: crypto.randomUUID(),
        startsAt: "2026-11-01T09:00:00+09:00",
      })
    ).toThrow()
  })

  it("validates year capabilities returned to the frontend", () => {
    expect(
      v.parse(yearsResponseSchema, {
        years: [
          {
            year: 2026,
            status: "active",
            canManage: true,
          },
        ],
      })
    ).toMatchObject({ years: [{ canManage: true }] })
  })

  it("rejects malformed activity API responses", () => {
    const result = v.safeParse(activitiesResponseSchema, {
      activities: [
        {
          id: crypto.randomUUID(),
          year: 2026,
          name: "受付",
          place: "正門",
          activityType: "案内",
          startsAt: "not-a-date",
          endsAt: "2026-11-01T03:00:00.000Z",
          color: "#2563EB",
          notes: null,
          assignmentCount: 1,
        },
      ],
    })
    expect(result.success).toBe(false)
  })

  it("requires a reason for late or absence reports", () => {
    expect(
      v.safeParse(createAssignmentReportInputSchema, {
        kind: "late",
        message: "   ",
      }).success
    ).toBe(false)
    expect(
      v.parse(createAssignmentReportInputSchema, {
        kind: "absence",
        message: "体調不良のため欠勤します",
      })
    ).toMatchObject({ kind: "absence" })
  })

  it("preserves coercion, defaults, and unknown-key stripping at the boundary", () => {
    expect(v.parse(operatingYearSchema, "2026")).toBe(2026)
    expect(v.safeParse(operatingYearSchema, "").success).toBe(false)
    expect(
      v.parse(createOperatingYearInputSchema, { year: "2026", ignored: true })
    ).toEqual({ year: 2026, status: "draft" })
  })

  it.each(["2026-11-01T03:00:00.000Z", "2026-11-01T12:00:00+09:00"])(
    "accepts timezone-qualified instants: %s",
    (instant) => {
      expect(v.safeParse(instantSchema, instant).success).toBe(true)
    }
  )

  it.each([
    "2026-11-01T03:00:00",
    "2026-11-01 03:00:00+00:00",
    "2026-13-01T03:00:00Z",
  ])("rejects invalid instant boundaries: %s", (instant) => {
    expect(v.safeParse(instantSchema, instant).success).toBe(false)
  })

  it("keeps ordered-window errors attached to endsAt", () => {
    const result = v.safeParse(timeWindowSchema, {
      startsAt: "2026-11-01T12:00:00+09:00",
      endsAt: "2026-11-01T09:00:00+09:00",
    })
    expect(result.success).toBe(false)
    if (result.success) {
      throw new Error("Expected the window to be rejected")
    }
    expect(v.flatten(result.issues).nested?.endsAt).toContain(
      "終了日時は開始日時より後にしてください"
    )
  })
})

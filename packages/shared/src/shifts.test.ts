import { describe, expect, it } from "vitest"

import {
  activitiesResponseSchema,
  createAssignmentInputSchema,
  createAssignmentReportInputSchema,
  createOperatingYearInputSchema,
  replaceAvailabilityInputSchema,
  yearsResponseSchema,
} from "./shifts"

describe("shift API schemas", () => {
  it("accepts a year without imposing an operating period", () => {
    expect(
      createOperatingYearInputSchema.parse({
        year: 2026,
      })
    ).toMatchObject({ year: 2026, status: "draft" })
  })

  it("rejects overlapping availability windows", () => {
    expect(() =>
      replaceAvailabilityInputSchema.parse({
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
      createAssignmentInputSchema.parse({
        memberId: crypto.randomUUID(),
        startsAt: "2026-11-01T09:00:00+09:00",
      })
    ).toThrow()
  })

  it("validates year capabilities returned to the frontend", () => {
    expect(
      yearsResponseSchema.parse({
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
    const result = activitiesResponseSchema.safeParse({
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
      createAssignmentReportInputSchema.safeParse({
        kind: "late",
        message: "   ",
      }).success
    ).toBe(false)
    expect(
      createAssignmentReportInputSchema.parse({
        kind: "absence",
        message: "体調不良のため欠勤します",
      })
    ).toMatchObject({ kind: "absence" })
  })
})

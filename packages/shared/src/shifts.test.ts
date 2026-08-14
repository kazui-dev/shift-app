import { describe, expect, it } from "vitest"

import {
  activitiesResponseSchema,
  createAssignmentInputSchema,
  createOperatingYearInputSchema,
  replaceAvailabilityInputSchema,
  yearsResponseSchema,
} from "./shifts"

describe("shift API schemas", () => {
  it("accepts an ordered operating year", () => {
    expect(
      createOperatingYearInputSchema.parse({
        year: 2026,
        name: "2026年度",
        startsOn: "2026-04-01",
        endsOn: "2027-03-31",
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
            name: "2026年度",
            startsOn: "2026-10-31",
            endsOn: "2026-11-01",
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
})

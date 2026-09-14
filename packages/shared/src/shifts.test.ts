import * as v from "valibot"
import { describe, expect, it } from "vite-plus/test"

import {
  activitiesResponseSchema,
  createOperatingYearInputSchema,
  instantSchema,
  manageAttendanceInputSchema,
  operatingYearSchema,
  replaceAvailabilityInputSchema,
  replaceYearSettingsInputSchema,
  submitAttendanceInputSchema,
  timeWindowSchema,
  yearsResponseSchema,
} from "./shifts"

describe("shift API schemas", () => {
  it("accepts a year without imposing an operating period", () => {
    expect(
      v.parse(createOperatingYearInputSchema, {
        year: 2026,
      })
    ).toMatchObject({ year: 2026 })
  })

  it("rejects overlapping availability windows", () => {
    expect(() =>
      v.parse(replaceAvailabilityInputSchema, {
        status: "submitted",
        windows: [
          {
            date: "2026-11-01",
            startsAt: "2026-11-01T09:00:00+09:00",
            endsAt: "2026-11-01T12:00:00+09:00",
          },
          {
            date: "2026-11-01",
            startsAt: "2026-11-01T11:00:00+09:00",
            endsAt: "2026-11-01T13:00:00+09:00",
          },
        ],
      })
    ).toThrow()
  })

  it("accepts availability ending exactly at 24:00 in Japan", () => {
    expect(
      v.safeParse(replaceAvailabilityInputSchema, {
        status: "submitted",
        windows: [
          {
            date: "2026-11-01",
            startsAt: "2026-11-01T00:00:00+09:00",
            endsAt: "2026-11-01T15:00:00Z",
          },
        ],
      }).success
    ).toBe(true)
    expect(
      v.safeParse(replaceAvailabilityInputSchema, {
        status: "submitted",
        windows: [
          {
            date: "2026-11-01",
            startsAt: "2026-11-01T00:00:00+09:00",
            endsAt: "2026-11-01T15:00:00.001Z",
          },
        ],
      }).success
    ).toBe(false)
  })

  it("rejects availability that crosses into another date in Japan", () => {
    expect(() =>
      v.parse(replaceAvailabilityInputSchema, {
        status: "draft",
        windows: [
          {
            date: "2026-11-01",
            startsAt: "2026-11-01T22:00:00+09:00",
            endsAt: "2026-11-02T01:00:00+09:00",
          },
        ],
      })
    ).toThrow("希望時間帯は同じ日付の中で入力してください")
  })

  it("validates year capabilities returned to the frontend", () => {
    expect(
      v.parse(yearsResponseSchema, {
        years: [
          {
            year: 2026,
            isDefault: true,
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

  it("takes late or absent with an optional reason, and check-in with where it was confirmed", () => {
    expect(
      v.parse(submitAttendanceInputSchema, { state: "late", reason: "   " })
    ).toEqual({ state: "late", expectedAt: null, reason: "" })
    expect(v.parse(submitAttendanceInputSchema, { state: "absent" })).toEqual({
      state: "absent",
      reason: "",
    })
    expect(
      v.safeParse(submitAttendanceInputSchema, {
        state: "present",
        reason: "extra",
      }).success
    ).toBe(false)
    expect(
      v.safeParse(manageAttendanceInputSchema, {
        action: "correct",
        checkedInAt: "2026-09-11T01:00:00.000Z",
        reason: " ",
      }).success
    ).toBe(false)
  })

  it("coerces years and rejects removed status fields", () => {
    expect(v.parse(operatingYearSchema, "2026")).toBe(2026)
    expect(v.safeParse(operatingYearSchema, "").success).toBe(false)
    expect(v.parse(createOperatingYearInputSchema, { year: "2026" })).toEqual({
      year: 2026,
    })
    expect(
      v.safeParse(createOperatingYearInputSchema, {
        year: 2026,
        status: "active",
      }).success
    ).toBe(false)
    expect(
      v.safeParse(replaceYearSettingsInputSchema, { defaultYear: 2026 }).success
    ).toBe(true)
    expect(
      v.safeParse(replaceYearSettingsInputSchema, { defaultYear: null }).success
    ).toBe(false)
    expect(
      v.safeParse(replaceYearSettingsInputSchema, { defaultYear: 2200 }).success
    ).toBe(false)
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

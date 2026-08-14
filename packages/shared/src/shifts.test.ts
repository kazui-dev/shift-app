import { describe, expect, it } from "vitest"

import {
  createAssignmentInputSchema,
  createOperatingYearInputSchema,
  replaceAvailabilityInputSchema,
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
})

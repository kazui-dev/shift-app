import { describe, expect, it } from "vite-plus/test"

import {
  monthDistance,
  monthValue,
  monthValuesForDates,
  moveDate,
  moveMonth,
  moveMonthValue,
  weekDates,
  weekStart,
} from "@/features/calendar/lib/dates"

describe("calendar dates", () => {
  it("moves across month, year, and leap-day boundaries", () => {
    expect(moveDate("2026-08-31", 1)).toBe("2026-09-01")
    expect(moveDate("2026-01-01", -1)).toBe("2025-12-31")
    expect(moveDate("2028-02-28", 1)).toBe("2028-02-29")
  })

  it("builds Sunday-based calendar weeks", () => {
    expect(weekStart("2026-08-27")).toBe("2026-08-23")
    expect(weekDates("2026-08-27")).toEqual([
      "2026-08-23",
      "2026-08-24",
      "2026-08-25",
      "2026-08-26",
      "2026-08-27",
      "2026-08-28",
      "2026-08-29",
    ])
  })

  it("preserves the preferred day across short months", () => {
    expect(moveMonth("2026-01-31", 1, 31)).toBe("2026-02-28")
    expect(moveMonth("2026-02-28", 1, 31)).toBe("2026-03-31")
    expect(moveMonth("2028-01-31", 1, 31)).toBe("2028-02-29")
  })

  it("moves and deduplicates month values", () => {
    expect(monthValue("2026-08-27")).toBe("2026-08")
    expect(moveMonthValue("2026-12", 1)).toBe("2027-01")
    expect(monthDistance("2026-12", "2027-02")).toBe(2)
    expect(monthDistance("2027-02", "2026-12")).toBe(-2)
    expect(
      monthValuesForDates(["2026-08-31", "2026-09-01", "2026-09-02"])
    ).toEqual(["2026-08", "2026-09"])
  })
})

import { describe, expect, it } from "vite-plus/test"

import {
  calendarInitialSlide,
  calendarSlideDates,
  calendarSwipeOffset,
} from "./calendar-carousel"

describe("calendar carousel slots", () => {
  it("centers consecutive dates in stable circular slots", () => {
    expect(calendarSlideDates("2026-08-27", calendarInitialSlide)).toEqual([
      "2026-08-24",
      "2026-08-25",
      "2026-08-26",
      "2026-08-27",
      "2026-08-28",
      "2026-08-29",
      "2026-08-30",
    ])
  })

  it("rebases dates around a selected slot without moving the slot", () => {
    expect(calendarSlideDates("2026-09-01", 6)).toEqual([
      "2026-09-02",
      "2026-09-03",
      "2026-09-04",
      "2026-08-29",
      "2026-08-30",
      "2026-08-31",
      "2026-09-01",
    ])
    expect(calendarSlideDates("2026-09-01", 0)).toEqual([
      "2026-09-01",
      "2026-09-02",
      "2026-09-03",
      "2026-09-04",
      "2026-08-29",
      "2026-08-30",
      "2026-08-31",
    ])
  })

  it("maps loop progress to adjacent slide progress", () => {
    const snaps = [0, 1 / 7, 2 / 7, 3 / 7, 4 / 7, 5 / 7, 6 / 7]

    expect(calendarSwipeOffset(3.5 / 7, 3, snaps)).toBeCloseTo(0.5)
    expect(calendarSwipeOffset(2.25 / 7, 3, snaps)).toBeCloseTo(-0.75)
    expect(calendarSwipeOffset(0.5 / 7, 0, snaps)).toBeCloseTo(0.5)
    expect(calendarSwipeOffset(6.5 / 7, 0, snaps)).toBeCloseTo(-0.5)
    expect(calendarSwipeOffset(0.5 / 7, 6, snaps)).toBe(1)
    expect(calendarSwipeOffset(3 / 7, 3, snaps)).toBe(0)
    expect(calendarSwipeOffset(5 / 7, 3, snaps)).toBe(1)
    expect(calendarSwipeOffset(1 / 7, 3, snaps)).toBe(-1)
  })

  it("rejects missing and duplicate snap geometry", () => {
    expect(calendarSwipeOffset(0.5, 0, [])).toBe(0)
    expect(calendarSwipeOffset(0.5, 4, [0, 0.5])).toBe(0)
    expect(calendarSwipeOffset(0.5, 0, [0, 0])).toBe(0)
    const sparseSnaps = [0]
    sparseSnaps.length = 2
    expect(calendarSwipeOffset(0.25, 0, sparseSnaps)).toBe(0)
  })
})

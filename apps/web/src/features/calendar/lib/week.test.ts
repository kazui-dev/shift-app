import { describe, expect, it } from "vite-plus/test"

import { calendarWeekPresentation } from "@/features/calendar/lib/week"

describe("calendar week presentation", () => {
  it("moves the highlight without replacing a weekday row", () => {
    expect(calendarWeekPresentation("2026-08-27", 0.5)).toEqual({
      crossProgress: 0,
      nextProgress: 0,
      offsetPercent: "50%",
      previousProgress: 0,
    })
  })

  it("crossfades into the next week after Saturday", () => {
    expect(calendarWeekPresentation("2026-08-29", 0.75)).toEqual({
      crossProgress: 0.75,
      nextProgress: 0.75,
      offsetPercent: "75%",
      previousProgress: 0,
    })
  })

  it("crossfades into the previous week before Sunday", () => {
    expect(calendarWeekPresentation("2026-08-30", -0.25)).toEqual({
      crossProgress: 0.25,
      nextProgress: 0,
      offsetPercent: "-25%",
      previousProgress: 0.25,
    })
  })

  it("clamps overshooting carousel progress", () => {
    expect(calendarWeekPresentation("2026-08-29", 2)).toEqual({
      crossProgress: 1,
      nextProgress: 1,
      offsetPercent: "100%",
      previousProgress: 0,
    })
  })
})

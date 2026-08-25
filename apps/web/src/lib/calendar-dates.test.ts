import { describe, expect, it } from "vite-plus/test"

import {
  calendarDatePosition,
  createDateWindow,
  extendDateWindow,
  localDate,
  monthValuesForDates,
  moveDate,
  snappedDate,
  weekRailVisualPosition,
  windowForDate,
} from "./calendar-dates"

describe("calendar date window", () => {
  it("creates stable consecutive pages around the selected date", () => {
    const dates = createDateWindow("2026-08-26", 2)

    expect(dates).toEqual([
      "2026-08-24",
      "2026-08-25",
      "2026-08-26",
      "2026-08-27",
      "2026-08-28",
    ])
  })

  it("prepends and appends without replacing existing date pages", () => {
    const dates = createDateWindow("2026-01-01", 1)
    const prepended = extendDateWindow(dates, "before", 2)
    const appended = extendDateWindow(prepended.dates, "after", 2)

    expect(prepended.pageShift).toBe(2)
    expect(prepended.dates.slice(2, 5)).toEqual(dates)
    expect(appended.pageShift).toBe(0)
    expect(appended.dates).toEqual([
      "2025-12-29",
      "2025-12-30",
      "2025-12-31",
      "2026-01-01",
      "2026-01-02",
      "2026-01-03",
      "2026-01-04",
    ])
  })

  it("bounds long-running windows while preserving the visible page position", () => {
    const initial = createDateWindow("2026-08-26", 2)
    const appended = extendDateWindow(initial, "after", 2, 5)
    const prepended = extendDateWindow(appended.dates, "before", 2, 5)

    expect(appended.dates).toEqual([
      "2026-08-26",
      "2026-08-27",
      "2026-08-28",
      "2026-08-29",
      "2026-08-30",
    ])
    expect(appended.pageShift).toBe(-2)
    expect(prepended.dates).toEqual(initial)
    expect(prepended.pageShift).toBe(2)
  })

  it("uses the final snapped page as the selected date", () => {
    const dates = createDateWindow("2026-08-26", 2)

    expect(snappedDate(dates, 0, 390)).toBe("2026-08-24")
    expect(snappedDate(dates, 2.6 * 390, 390)).toBe("2026-08-27")
    expect(snappedDate(dates, 100 * 390, 390)).toBe("2026-08-28")
  })

  it("calculates continuous date positions beyond one-day offsets", () => {
    const dates = createDateWindow("2026-08-26", 3)
    const selectedIndex = dates.indexOf("2026-08-26")

    expect(calendarDatePosition(dates, selectedIndex * 390, 390)).toBe(
      selectedIndex
    )
    expect(calendarDatePosition(dates, (selectedIndex - 1) * 390, 390)).toBe(
      selectedIndex - 1
    )
    expect(calendarDatePosition(dates, (selectedIndex + 1) * 390, 390)).toBe(
      selectedIndex + 1
    )
    expect(calendarDatePosition(dates, (selectedIndex - 2.25) * 390, 390)).toBe(
      selectedIndex - 2.25
    )
    expect(calendarDatePosition(dates, (selectedIndex + 2.5) * 390, 390)).toBe(
      selectedIndex + 2.5
    )
  })

  it.each([
    {
      name: "Saturday to Sunday",
      dates: ["2026-08-29", "2026-08-30"],
      position: 0.25,
      sameWeek: false,
      indicator: 4.5,
    },
    {
      name: "Sunday to Saturday while moving backward",
      dates: ["2026-08-29", "2026-08-30"],
      position: 0.75,
      sameWeek: false,
      indicator: 1.5,
    },
    {
      name: "month end to next month",
      dates: ["2026-08-31", "2026-09-01"],
      position: 0.5,
      sameWeek: true,
      indicator: 1.5,
    },
    {
      name: "year end to next year",
      dates: ["2026-12-31", "2027-01-01"],
      position: 0.5,
      sameWeek: true,
      indicator: 4.5,
    },
  ])(
    "maps $name continuously onto the WeekRail",
    ({ dates, position, sameWeek, indicator }) => {
      expect(weekRailVisualPosition(dates, position)).toEqual({
        fromDate: dates[0],
        toDate: dates[1],
        progress: position,
        sameWeek,
        indicator,
      })
    }
  )

  it("tracks exact dates after scrolling across multiple days", () => {
    const dates = createDateWindow("2026-08-26", 4)

    expect(weekRailVisualPosition(dates, 4)).toMatchObject({
      fromDate: "2026-08-26",
      toDate: "2026-08-26",
      progress: 0,
      indicator: 3,
    })
    expect(weekRailVisualPosition(dates, 6)).toMatchObject({
      fromDate: "2026-08-28",
      toDate: "2026-08-28",
      progress: 0,
      indicator: 5,
    })
    expect(weekRailVisualPosition(dates, 1)).toMatchObject({
      fromDate: "2026-08-23",
      toDate: "2026-08-23",
      progress: 0,
      indicator: 0,
    })
  })

  it("keeps the indicator coordinate when the snapped date becomes selected", () => {
    const saturday = "2026-08-29"
    const sunday = "2026-08-30"
    const dates = [saturday, sunday]

    expect(weekRailVisualPosition(dates, 0)?.indicator).toBe(6)
    expect(weekRailVisualPosition(dates, 1)?.indicator).toBe(0)
    expect(localDate(saturday).getDay()).toBe(6)
    expect(localDate(sunday).getDay()).toBe(0)
  })

  it("keeps the window for a nearby external date and rebuilds for a far date", () => {
    const dates = createDateWindow("2026-08-26", 2)

    expect(windowForDate(dates, "2026-08-28", 2)).toBe(dates)
    expect(windowForDate(dates, "2027-01-01", 2)).toEqual([
      "2026-12-30",
      "2026-12-31",
      "2027-01-01",
      "2027-01-02",
      "2027-01-03",
    ])
  })

  it("finds every assignment month covered by the DOM window", () => {
    const dates = Array.from({ length: 4 }, (_, index) =>
      moveDate("2026-12-30", index)
    )

    expect(monthValuesForDates(dates)).toEqual(["2026-12", "2027-01"])
  })
})

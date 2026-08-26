import { describe, expect, it } from "vite-plus/test"

import {
  calendarDatePosition,
  createDateWindow,
  createWeekWindow,
  extendDateWindow,
  extendWeekWindow,
  monthValuesForDates,
  moveDate,
  snappedDate,
  snappedWeekDate,
  weekDates,
  weekRailPreviewPosition,
  weekScrollPosition,
  weekWindowExtensionDirection,
  weekWindowForDate,
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

  it("keeps one same-week pair while progress changes", () => {
    const dates = ["2026-08-31", "2026-09-01"]

    expect(weekRailPreviewPosition(dates, 0.25)).toEqual({
      pair: {
        fromDate: "2026-08-31",
        toDate: "2026-09-01",
        sameWeek: true,
      },
      progress: 0.25,
    })
    expect(weekRailPreviewPosition(dates, 0.75)).toEqual({
      pair: {
        fromDate: "2026-08-31",
        toDate: "2026-09-01",
        sameWeek: true,
      },
      progress: 0.75,
    })
  })

  it("keeps one cross-week pair while progress changes", () => {
    const dates = ["2026-08-29", "2026-08-30"]

    expect(weekRailPreviewPosition(dates, 0.25)).toEqual({
      pair: {
        fromDate: "2026-08-29",
        toDate: "2026-08-30",
        sameWeek: false,
      },
      progress: 0.25,
    })
    expect(weekRailPreviewPosition(dates, 0.75)).toEqual({
      pair: {
        fromDate: "2026-08-29",
        toDate: "2026-08-30",
        sameWeek: false,
      },
      progress: 0.75,
    })
  })

  it("does not derive selected state at the preview midpoint", () => {
    expect(weekRailPreviewPosition(["2026-08-31", "2026-09-01"], 0.5)).toEqual({
      pair: {
        fromDate: "2026-08-31",
        toDate: "2026-09-01",
        sameWeek: true,
      },
      progress: 0.5,
    })
  })

  it("changes React-owned pairs only when crossing a day boundary", () => {
    const dates = createDateWindow("2026-08-26", 4)

    expect(weekRailPreviewPosition(dates, 4.25)).toEqual({
      pair: {
        fromDate: "2026-08-26",
        toDate: "2026-08-27",
        sameWeek: true,
      },
      progress: 0.25,
    })
    expect(weekRailPreviewPosition(dates, 4.75)?.pair).toEqual(
      weekRailPreviewPosition(dates, 4.25)?.pair
    )
    expect(weekRailPreviewPosition(dates, 5.25)?.pair).toEqual({
      fromDate: "2026-08-27",
      toDate: "2026-08-28",
      sameWeek: true,
    })
  })

  it("handles empty, single-page, and final-page positions", () => {
    const dates = createDateWindow("2026-08-26", 1)

    expect(weekRailPreviewPosition([], 0)).toBeNull()
    expect(weekRailPreviewPosition(["2026-08-26"], 0)).toEqual({
      pair: {
        fromDate: "2026-08-26",
        toDate: "2026-08-26",
        sameWeek: true,
      },
      progress: 0,
    })
    expect(weekRailPreviewPosition(dates, 2)).toEqual({
      pair: {
        fromDate: "2026-08-26",
        toDate: "2026-08-27",
        sameWeek: true,
      },
      progress: 1,
    })
  })

  it("keeps visual preview independent from the snapped date commit", () => {
    const dates = createDateWindow("2026-08-29", 1)

    expect(weekRailPreviewPosition(dates, 1.75)).toEqual({
      pair: {
        fromDate: "2026-08-29",
        toDate: "2026-08-30",
        sameWeek: false,
      },
      progress: 0.75,
    })
    expect(snappedDate(dates, 2 * 390, 390)).toBe("2026-08-30")
    expect(dates).toEqual(["2026-08-28", "2026-08-29", "2026-08-30"])
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

describe("week rail window", () => {
  it("creates consecutive week pages around the selected week", () => {
    expect(createWeekWindow("2026-08-26", 2)).toEqual([
      "2026-08-09",
      "2026-08-16",
      "2026-08-23",
      "2026-08-30",
      "2026-09-06",
    ])
  })

  it("prepends and appends week pages without replacing existing weeks", () => {
    const weeks = createWeekWindow("2026-08-26", 1)
    const prepended = extendWeekWindow(weeks, "before", 2)
    const appended = extendWeekWindow(prepended.weeks, "after", 2)

    expect(prepended.prepended).toBe(2)
    expect(prepended.weeks.slice(2, 5)).toEqual(weeks)
    expect(appended.prepended).toBe(0)
    expect(appended.weeks).toEqual([
      "2026-08-02",
      "2026-08-09",
      "2026-08-16",
      "2026-08-23",
      "2026-08-30",
      "2026-09-06",
      "2026-09-13",
    ])
  })

  it("does not extend an empty window or a zero-sized request", () => {
    const weeks = createWeekWindow("2026-08-26", 1)

    expect(extendWeekWindow([], "before", 2)).toEqual({
      weeks: [],
      prepended: 0,
    })
    expect(extendWeekWindow(weeks, "after", 0)).toEqual({
      weeks,
      prepended: 0,
    })
  })

  it("keeps the visible week stable after prepending", () => {
    const weeks = createWeekWindow("2026-08-26", 2)
    const visibleWeek = weeks[3]
    const prepended = extendWeekWindow(weeks, "before", 2)
    const oldPosition = 3
    const correctedPosition = oldPosition + prepended.prepended

    expect(prepended.prepended).toBe(2)
    expect(prepended.weeks[correctedPosition]).toBe(visibleWeek)
    expect(prepended.weeks).toHaveLength(weeks.length + 2)
  })

  it("extends only near the leading or trailing window edge", () => {
    expect(weekWindowExtensionDirection(2, 25, 2)).toBe("before")
    expect(weekWindowExtensionDirection(3, 25, 2)).toBeNull()
    expect(weekWindowExtensionDirection(21, 25, 2)).toBeNull()
    expect(weekWindowExtensionDirection(22, 25, 2)).toBe("after")
  })

  it("reuses the window for a nearby date and rebuilds around a far date", () => {
    const weeks = createWeekWindow("2026-08-26", 2)

    expect(weekWindowForDate(weeks, "2026-08-30", 2)).toBe(weeks)
    expect(weekWindowForDate(weeks, "2027-01-01", 2)).toEqual([
      "2026-12-13",
      "2026-12-20",
      "2026-12-27",
      "2027-01-03",
      "2027-01-10",
    ])
  })

  it("keeps the selected weekday across previous, next, and multiple weeks", () => {
    const weeks = createWeekWindow("2026-08-26", 3)
    const selectedIndex = 3
    const width = 390

    expect(
      snappedWeekDate(weeks, (selectedIndex - 1) * width, width, "2026-08-26")
    ).toBe("2026-08-19")
    expect(
      snappedWeekDate(weeks, (selectedIndex + 1) * width, width, "2026-08-26")
    ).toBe("2026-09-02")
    expect(
      snappedWeekDate(weeks, (selectedIndex + 3) * width, width, "2026-08-26")
    ).toBe("2026-09-16")
  })

  it("settles an external Saturday to Sunday sync idempotently", () => {
    const weeks = createWeekWindow("2026-08-30", 2)
    const targetIndex = weeks.indexOf("2026-08-30")

    expect(snappedWeekDate(weeks, targetIndex * 390, 390, "2026-08-30")).toBe(
      "2026-08-30"
    )
  })

  it("settles an external Sunday to Saturday sync idempotently", () => {
    const weeks = createWeekWindow("2026-08-29", 2)
    const targetIndex = weeks.indexOf("2026-08-23")

    expect(snappedWeekDate(weeks, targetIndex * 390, 390, "2026-08-29")).toBe(
      "2026-08-29"
    )
  })

  it("uses each page's exact date when a date button is selected", () => {
    const dates = weekDates("2026-08-26")

    expect(dates[0]).toBe("2026-08-23")
    expect(dates[5]).toBe("2026-08-28")
    expect(dates[6]).toBe("2026-08-29")
  })

  it("calculates continuous positions across multiple week pages", () => {
    const weeks = createWeekWindow("2026-08-26", 3)

    expect(weekScrollPosition(weeks, 3 * 390, 390)).toBe(3)
    expect(weekScrollPosition(weeks, 5.5 * 390, 390)).toBe(5.5)
    expect(weekScrollPosition(weeks, -390, 390)).toBe(0)
    expect(weekScrollPosition(weeks, 0, 0)).toBeNull()
    expect(snappedWeekDate([], 0, 390, "2026-08-26")).toBeNull()
  })

  it("keeps month and year boundaries in the selected weekday", () => {
    const monthWeeks = createWeekWindow("2026-08-26", 2)
    const yearWeeks = createWeekWindow("2026-12-30", 2)

    expect(snappedWeekDate(monthWeeks, 3 * 390, 390, "2026-08-26")).toBe(
      "2026-09-02"
    )
    expect(snappedWeekDate(yearWeeks, 3 * 390, 390, "2026-12-30")).toBe(
      "2027-01-06"
    )
  })
})

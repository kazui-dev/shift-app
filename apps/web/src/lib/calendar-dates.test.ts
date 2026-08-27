import { describe, expect, it } from "vite-plus/test"

import {
  createWeekWindow,
  dayPagerBoundaryOffset,
  dayPagerCenterPage,
  dayPagerDates,
  dayPagerPosition,
  dayPagerPreview,
  dayPagerSettleOffset,
  extendWeekWindow,
  monthValuesForDates,
  snappedDayPagerDate,
  snappedWeekDate,
  weekDates,
  weekScrollPosition,
  weekWindowExtensionDirection,
  weekWindowForDate,
} from "./calendar-dates"

describe("five-page day pager", () => {
  const pageWidth = 390

  it("buffers two dates on each side of the centered current date", () => {
    expect(dayPagerDates("2026-08-26")).toEqual([
      "2026-08-24",
      "2026-08-25",
      "2026-08-26",
      "2026-08-27",
      "2026-08-28",
    ])
    expect(dayPagerCenterPage).toBe(2)
  })

  it("maps every physical page to its buffered date offset", () => {
    expect(dayPagerSettleOffset(0, pageWidth)).toBe(-2)
    expect(dayPagerSettleOffset(pageWidth, pageWidth)).toBe(-1)
    expect(dayPagerSettleOffset(2 * pageWidth, pageWidth)).toBe(0)
    expect(dayPagerSettleOffset(3 * pageWidth, pageWidth)).toBe(1)
    expect(dayPagerSettleOffset(4 * pageWidth, pageWidth)).toBe(2)
  })

  it("recognizes only fully reached page boundaries for early recycle", () => {
    expect(dayPagerBoundaryOffset(0.5, pageWidth)).toBe(-2)
    expect(dayPagerBoundaryOffset(1.5, pageWidth)).toBeNull()
    expect(dayPagerBoundaryOffset(2 * pageWidth, pageWidth)).toBe(0)
    expect(dayPagerBoundaryOffset(4 * pageWidth - 0.5, pageWidth)).toBe(2)
    expect(dayPagerBoundaryOffset(4 * pageWidth - 1.5, pageWidth)).toBeNull()
  })

  it("moves exactly one day for one adjacent-page gesture", () => {
    expect(snappedDayPagerDate("2026-08-26", pageWidth, pageWidth)).toBe(
      "2026-08-25"
    )
    expect(snappedDayPagerDate("2026-08-26", 3 * pageWidth, pageWidth)).toBe(
      "2026-08-27"
    )
  })

  it("caps an unrecycled physical offset at the two-day buffer", () => {
    expect(snappedDayPagerDate("2026-08-26", -10_000, pageWidth)).toBe(
      "2026-08-24"
    )
    expect(snappedDayPagerDate("2026-08-26", 10_000, pageWidth)).toBe(
      "2026-08-28"
    )
  })

  it("recycles the committed date back into the center page", () => {
    const committed = snappedDayPagerDate(
      "2026-08-26",
      3 * pageWidth,
      pageWidth
    )

    expect(committed).toBe("2026-08-27")
    expect(dayPagerDates(committed ?? "")[dayPagerCenterPage]).toBe(committed)
  })

  it("advances exactly five days when consecutive gestures fill the buffer", () => {
    let date = "2026-08-27"
    for (const pendingGestures of [2, 2, 1]) {
      date =
        snappedDayPagerDate(
          date,
          (dayPagerCenterPage + pendingGestures) * pageWidth,
          pageWidth
        ) ?? date
    }

    expect(date).toBe("2026-09-01")
  })

  it("moves back exactly five days when consecutive gestures fill the buffer", () => {
    let date = "2026-08-27"
    for (const pendingGestures of [-2, -2, -1]) {
      date =
        snappedDayPagerDate(
          date,
          (dayPagerCenterPage + pendingGestures) * pageWidth,
          pageWidth
        ) ?? date
    }

    expect(date).toBe("2026-08-22")
  })

  it("treats programmatic center confirmations and duplicates as no-ops", () => {
    const committed = snappedDayPagerDate(
      "2026-08-27",
      3 * pageWidth,
      pageWidth
    )
    const center = dayPagerCenterPage * pageWidth
    const recentered = snappedDayPagerDate(committed ?? "", center, pageWidth)
    const duplicate = snappedDayPagerDate(recentered ?? "", center, pageWidth)

    expect(committed).toBe("2026-08-28")
    expect(recentered).toBe(committed)
    expect(duplicate).toBe(committed)
  })

  it("crosses month and year boundaries with buffered pages", () => {
    expect(dayPagerDates("2026-09-01")).toEqual([
      "2026-08-30",
      "2026-08-31",
      "2026-09-01",
      "2026-09-02",
      "2026-09-03",
    ])
    expect(dayPagerDates("2027-01-01")).toEqual([
      "2026-12-30",
      "2026-12-31",
      "2027-01-01",
      "2027-01-02",
      "2027-01-03",
    ])
    expect(snappedDayPagerDate("2026-08-31", 3 * pageWidth, pageWidth)).toBe(
      "2026-09-01"
    )
    expect(snappedDayPagerDate("2026-12-31", 3 * pageWidth, pageWidth)).toBe(
      "2027-01-01"
    )
  })

  it("tracks adjacent-date progress across both buffer pages", () => {
    const dates = dayPagerDates("2026-08-26")

    expect(dayPagerPosition(1.25 * pageWidth, pageWidth)).toBe(1.25)
    expect(dayPagerPreview(dates, 1.25)).toEqual({
      fromDate: "2026-08-25",
      toDate: "2026-08-26",
      sameWeek: true,
      progress: 0.25,
    })
    expect(dayPagerPreview(dates, 2.75)).toEqual({
      fromDate: "2026-08-26",
      toDate: "2026-08-27",
      sameWeek: true,
      progress: 0.75,
    })
    expect(dayPagerPreview(dates, 3.5)).toEqual({
      fromDate: "2026-08-27",
      toDate: "2026-08-28",
      sameWeek: true,
      progress: 0.5,
    })
    expect(dayPagerPreview(dates, 4)).toEqual({
      fromDate: "2026-08-27",
      toDate: "2026-08-28",
      sameWeek: true,
      progress: 1,
    })
  })

  it("prepares the adjacent weeks for Saturday to Sunday", () => {
    expect(dayPagerPreview(dayPagerDates("2026-08-29"), 2.5)).toEqual({
      fromDate: "2026-08-29",
      toDate: "2026-08-30",
      sameWeek: false,
      progress: 0.5,
    })
  })

  it("prepares the adjacent weeks for Sunday to Saturday", () => {
    expect(dayPagerPreview(dayPagerDates("2026-08-30"), 1.5)).toEqual({
      fromDate: "2026-08-29",
      toDate: "2026-08-30",
      sameWeek: false,
      progress: 0.5,
    })
  })

  it("finds every assignment month required by the five pages", () => {
    expect(monthValuesForDates(dayPagerDates("2027-01-01"))).toEqual([
      "2026-12",
      "2027-01",
    ])
  })

  it("rejects a zero-width viewport", () => {
    expect(dayPagerBoundaryOffset(0, 0)).toBeNull()
    expect(dayPagerPosition(0, 0)).toBeNull()
    expect(dayPagerSettleOffset(0, 0)).toBeNull()
    expect(snappedDayPagerDate("2026-08-26", 0, 0)).toBeNull()
    expect(dayPagerPreview([], 0)).toBeNull()
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

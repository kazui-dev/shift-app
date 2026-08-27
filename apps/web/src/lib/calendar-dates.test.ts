import { describe, expect, it } from "vite-plus/test"

import {
  createWeekWindow,
  dayPagerBoundaryDirection,
  dayPagerDates,
  dayPagerPosition,
  dayPagerPreview,
  dayPagerSettleDirection,
  dayPagerWeekPreview,
  extendWeekWindow,
  monthValuesForDates,
  snappedDayPagerDate,
  snappedWeekDate,
  weekDates,
  weekScrollPosition,
  weekWindowExtensionDirection,
  weekWindowForDate,
} from "./calendar-dates"

describe("three-page day pager", () => {
  it("always renders previous, current, and next with current centered", () => {
    expect(dayPagerDates("2026-08-26")).toEqual([
      "2026-08-25",
      "2026-08-26",
      "2026-08-27",
    ])
  })

  it("settles to previous, current, or next only", () => {
    expect(dayPagerSettleDirection(0, 390)).toBe(-1)
    expect(dayPagerSettleDirection(390, 390)).toBe(0)
    expect(dayPagerSettleDirection(2 * 390, 390)).toBe(1)
    expect(snappedDayPagerDate("2026-08-26", 0.49 * 390, 390)).toBe(
      "2026-08-25"
    )
    expect(snappedDayPagerDate("2026-08-26", 1.49 * 390, 390)).toBe(
      "2026-08-26"
    )
    expect(snappedDayPagerDate("2026-08-26", 1.51 * 390, 390)).toBe(
      "2026-08-27"
    )
  })

  it("recognizes only fully reached page boundaries for early recycle", () => {
    expect(dayPagerBoundaryDirection(0.5, 390)).toBe(-1)
    expect(dayPagerBoundaryDirection(1.5, 390)).toBeNull()
    expect(dayPagerBoundaryDirection(390, 390)).toBe(0)
    expect(dayPagerBoundaryDirection(2 * 390 - 0.5, 390)).toBe(1)
    expect(dayPagerBoundaryDirection(2 * 390 - 1.5, 390)).toBeNull()
  })

  it("cannot commit more than one day from one settle", () => {
    expect(snappedDayPagerDate("2026-08-26", -10_000, 390)).toBe("2026-08-25")
    expect(snappedDayPagerDate("2026-08-26", 10_000, 390)).toBe("2026-08-27")
  })

  it("recycles the committed date back into the center page", () => {
    const committed = snappedDayPagerDate("2026-08-26", 2 * 390, 390)

    expect(committed).toBe("2026-08-27")
    expect(dayPagerDates(committed ?? "")[1]).toBe(committed)
  })

  it("advances exactly five days across five next-page settles", () => {
    let date = "2026-08-27"
    for (let gesture = 0; gesture < 5; gesture += 1) {
      date = snappedDayPagerDate(date, 2 * 390, 390) ?? date
    }

    expect(date).toBe("2026-09-01")
  })

  it("moves back exactly five days across five previous-page settles", () => {
    let date = "2026-08-27"
    for (let gesture = 0; gesture < 5; gesture += 1) {
      date = snappedDayPagerDate(date, 0, 390) ?? date
    }

    expect(date).toBe("2026-08-22")
  })

  it("treats programmatic center confirmations and duplicates as no-ops", () => {
    const committed = snappedDayPagerDate("2026-08-27", 2 * 390, 390)
    const recentered = snappedDayPagerDate(committed ?? "", 390, 390)
    const duplicate = snappedDayPagerDate(recentered ?? "", 390, 390)

    expect(committed).toBe("2026-08-28")
    expect(recentered).toBe(committed)
    expect(duplicate).toBe(committed)
  })

  it("crosses month and year boundaries with adjacent pages", () => {
    expect(dayPagerDates("2026-09-01")).toEqual([
      "2026-08-31",
      "2026-09-01",
      "2026-09-02",
    ])
    expect(dayPagerDates("2027-01-01")).toEqual([
      "2026-12-31",
      "2027-01-01",
      "2027-01-02",
    ])
    expect(snappedDayPagerDate("2026-08-31", 2 * 390, 390)).toBe("2026-09-01")
    expect(snappedDayPagerDate("2026-12-31", 2 * 390, 390)).toBe("2027-01-01")
  })

  it("tracks finger movement one-to-one from the center", () => {
    expect(dayPagerPosition(0.25 * 390, 390)).toBe(0.25)
    expect(dayPagerPreview(0.25)).toEqual({
      direction: -1,
      progress: 0.75,
    })
    expect(dayPagerPreview(1)).toBeNull()
    expect(dayPagerPreview(1.75)).toEqual({
      direction: 1,
      progress: 0.75,
    })
  })

  it("keeps preview directional without deriving intermediate selection", () => {
    expect(dayPagerPreview(0.5)).toEqual({ direction: -1, progress: 0.5 })
    expect(dayPagerPreview(1.5)).toEqual({ direction: 1, progress: 0.5 })
  })

  it("previews one indicator cell within the same week", () => {
    expect(dayPagerWeekPreview("2026-08-26", 1)).toEqual({
      selectedDate: "2026-08-26",
      targetDate: "2026-08-27",
      sameWeek: true,
      selectedWeekday: 3,
      targetWeekday: 4,
    })
  })

  it("prepares the adjacent weeks for Saturday to Sunday", () => {
    expect(dayPagerWeekPreview("2026-08-29", 1)).toEqual({
      selectedDate: "2026-08-29",
      targetDate: "2026-08-30",
      sameWeek: false,
      selectedWeekday: 6,
      targetWeekday: 0,
    })
  })

  it("prepares the adjacent weeks for Sunday to Saturday", () => {
    expect(dayPagerWeekPreview("2026-08-30", -1)).toEqual({
      selectedDate: "2026-08-30",
      targetDate: "2026-08-29",
      sameWeek: false,
      selectedWeekday: 0,
      targetWeekday: 6,
    })
  })

  it("finds every assignment month required by the three pages", () => {
    expect(monthValuesForDates(dayPagerDates("2027-01-01"))).toEqual([
      "2026-12",
      "2027-01",
    ])
  })

  it("rejects a zero-width viewport", () => {
    expect(dayPagerBoundaryDirection(0, 0)).toBeNull()
    expect(dayPagerPosition(0, 0)).toBeNull()
    expect(dayPagerSettleDirection(0, 0)).toBeNull()
    expect(snappedDayPagerDate("2026-08-26", 0, 0)).toBeNull()
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

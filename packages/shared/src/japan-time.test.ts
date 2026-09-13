import { beforeEach, describe, expect, it, vi } from "vite-plus/test"

import {
  japanDateStart,
  japanDateTime,
  japanDateWeekday,
  japanFullDate,
  japanLocalDateTime,
  japanMonthDay,
  japanMonthDayTime,
  japanMonthDayWeekday,
  japanMonthRange,
  japanTime,
  japanTimestamp,
  japanWeekday,
  minutesFromJapanDateStart,
} from "./japan-time"

beforeEach(() => {
  vi.stubEnv("TZ", "UTC")
})

describe("Japan calendar instants", () => {
  it.each(["UTC", "Asia/Tokyo", "America/Los_Angeles"])(
    "creates the same date boundary when the runtime timezone is %s",
    (timeZone) => {
      vi.stubEnv("TZ", timeZone)
      expect(new Date(japanDateStart("2026-09-01")).toISOString()).toBe(
        "2026-08-31T15:00:00.000Z"
      )
    }
  )

  it("creates month boundaries in Japan across month and year changes", () => {
    const august = japanMonthRange("2026-08")
    const december = japanMonthRange("2026-12")

    expect(new Date(august.from).toISOString()).toBe("2026-07-31T15:00:00.000Z")
    expect(new Date(august.to).toISOString()).toBe("2026-08-31T15:00:00.000Z")
    expect(new Date(december.to).toISOString()).toBe("2026-12-31T15:00:00.000Z")
  })

  it("interprets timezone-less form values as Japan local time", () => {
    expect(new Date(japanLocalDateTime("2026-09-01T09:30")).toISOString()).toBe(
      "2026-09-01T00:30:00.000Z"
    )
    expect(
      new Date(japanLocalDateTime("2026-09-01T09:30:45")).toISOString()
    ).toBe("2026-09-01T00:30:45.000Z")
  })

  it("projects an instant onto the Japan calendar and day axis", () => {
    expect(japanDateTime("2026-08-31T15:30:00.000Z")).toEqual({
      date: "2026-09-01",
      hour: 0,
      minute: 30,
    })
    expect(japanDateTime(new Date("2026-08-31T14:00:00.000Z"))).toEqual({
      date: "2026-08-31",
      hour: 23,
      minute: 0,
    })
    expect(japanDateTime(Date.parse("2026-08-31T16:00:00.000Z"))).toEqual({
      date: "2026-09-01",
      hour: 1,
      minute: 0,
    })
    expect(
      minutesFromJapanDateStart("2026-08-31T16:00:00.000Z", "2026-09-01")
    ).toBe(60)
    expect(
      minutesFromJapanDateStart(
        new Date("2026-08-31T14:00:00.000Z"),
        "2026-09-01"
      )
    ).toBe(-60)
    expect(
      minutesFromJapanDateStart(
        Date.parse("2026-08-31T15:30:00.000Z"),
        "2026-09-01"
      )
    ).toBe(30)
  })
})

describe("Japan calendar labels", () => {
  it.each(["UTC", "Asia/Tokyo", "America/Los_Angeles"])(
    "labels the same instant identically when the runtime timezone is %s",
    (timeZone) => {
      vi.stubEnv("TZ", timeZone)
      const instant = "2026-09-13T00:30:00.000Z"
      expect(japanTime(instant)).toBe("09:30")
      expect(japanMonthDay(instant)).toBe("9/13")
      expect(japanMonthDayWeekday(instant)).toBe("9/13(日)")
      expect(japanDateWeekday(instant)).toBe("9月13日(日)")
      expect(japanMonthDayTime(instant)).toBe("9/13 09:30")
      expect(japanTimestamp(instant)).toBe("2026/9/13 09:30:00")
      expect(japanFullDate("2026-09-13")).toBe("2026年9月13日（日）")
      expect(japanWeekday("2026-09-13")).toBe(0)
      expect(japanWeekday("2026-09-19")).toBe(6)
    }
  )

  it("labels dates, numbers and Date values alike", () => {
    const instant = "2026-09-13T00:30:00.000Z"
    expect(japanTime(new Date(instant))).toBe(japanTime(instant))
    expect(japanTime(Date.parse(instant))).toBe(japanTime(instant))
  })
})

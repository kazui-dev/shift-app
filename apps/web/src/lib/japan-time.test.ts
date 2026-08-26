import { beforeEach, describe, expect, it, vi } from "vite-plus/test"

import {
  japanDateStart,
  japanDateTime,
  japanLocalDateTime,
  japanMonthRange,
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

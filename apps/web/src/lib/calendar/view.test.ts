import { afterEach, expect, it, vi } from "vite-plus/test"
import {
  calendarDate,
  calendarViewKey,
  readCalendarView,
  resolveCalendarView,
  saveCalendarView,
} from "@/lib/calendar/view"
afterEach(() => vi.unstubAllGlobals())
it("accepts only exact existing dates without coercion or rollover", () => {
  for (const value of [
    undefined,
    null,
    20260912,
    [],
    ["2026-09-12"],
    "2026-9-12",
    "2026-02-29",
    "2026-02-30",
    "2026-13-01",
    "2026-00-01",
    "0000-01-01",
    "2026-09-12T00:00:00Z",
    " 2026-09-12",
  ])
    expect(calendarDate(value)).toBeUndefined()
  expect(calendarDate("2024-02-29")).toBe("2024-02-29")
  expect(calendarDate("2026-09-12")).toBe("2026-09-12")
})
it("resolves explicit date, scoped session state, then Japan today", () => {
  const storage = new Map<string, string>()
  vi.stubGlobal("sessionStorage", {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
    removeItem: (key: string) => storage.delete(key),
  })
  const key = calendarViewKey("member", 2026)
  saveCalendarView(key, { date: "2026-10-03", scrollTop: 350 })
  expect(resolveCalendarView(key, undefined)).toEqual({
    date: "2026-10-03",
    scrollTop: 350,
    preferredDay: 3,
  })
  expect(resolveCalendarView(key, "2026-11-04")).toEqual({
    date: "2026-11-04",
    scrollTop: null,
    preferredDay: 4,
  })
  expect(resolveCalendarView(key, "2026-10-03").scrollTop).toBe(350)
  expect(
    resolveCalendarView(
      calendarViewKey("other", 2026),
      undefined,
      new Date("2026-09-11T16:00:00Z")
    ).date
  ).toBe("2026-09-12")
  expect(readCalendarView(calendarViewKey("member", 2027))).toBeUndefined()
  const corrupt = calendarViewKey("corrupt", 2026)
  storage.set(corrupt, JSON.stringify({ date: "2026-02-30", scrollTop: 0 }))
  expect(readCalendarView(corrupt)).toBeUndefined()
  expect(storage.has(corrupt)).toBe(false)
  storage.set(corrupt, "{broken")
  expect(readCalendarView(corrupt)).toBeUndefined()
})
it("keeps navigation usable when session storage is blocked", () => {
  vi.stubGlobal("sessionStorage", {
    getItem: () => {
      throw new Error("blocked")
    },
    setItem: () => {
      throw new Error("blocked")
    },
  })
  const key = calendarViewKey("blocked", 2026)
  saveCalendarView(key, { date: "2026-10-12", scrollTop: 10 })
  expect(resolveCalendarView(key, undefined)).toEqual({
    date: "2026-10-12",
    scrollTop: 10,
    preferredDay: 12,
  })
})

it("preserves the preferred day when resuming a clamped month", () => {
  const key = calendarViewKey("month-end", 2026)
  saveCalendarView(key, { date: "2026-02-28", scrollTop: 0, preferredDay: 31 })
  expect(resolveCalendarView(key, "2026-02-28").preferredDay).toBe(31)
  expect(resolveCalendarView(key, "2026-03-10").preferredDay).toBe(10)
})

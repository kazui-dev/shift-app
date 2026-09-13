export const japanTimeZone = "Asia/Tokyo"

const japanOffset = "+09:00"
const japanOffsetMilliseconds = 9 * 60 * 60 * 1000

export type JapanDateTime = {
  date: string
  hour: number
  minute: number
}

export function japanDateStart(date: string): number {
  return Date.parse(`${date}T00:00:00${japanOffset}`)
}

export function japanMonthRange(month: string): {
  from: number
  to: number
} {
  const year = Number(month.slice(0, 4))
  const monthNumber = Number(month.slice(5, 7))
  const nextYear = monthNumber === 12 ? year + 1 : year
  const nextMonthNumber = monthNumber === 12 ? 1 : monthNumber + 1
  const nextMonth = `${nextYear}-${String(nextMonthNumber).padStart(2, "0")}`
  return {
    from: japanDateStart(`${month}-01`),
    to: japanDateStart(`${nextMonth}-01`),
  }
}

export function japanLocalDateTime(value: string): number {
  const seconds = value.length === 16 ? ":00" : ""
  return Date.parse(`${value}${seconds}${japanOffset}`)
}

export function japanDateTime(value: Date | number | string): JapanDateTime {
  const instant =
    value instanceof Date ? value.getTime() : new Date(value).getTime()
  const shifted = new Date(instant + japanOffsetMilliseconds)
  return {
    date: `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, "0")}-${String(shifted.getUTCDate()).padStart(2, "0")}`,
    hour: shifted.getUTCHours(),
    minute: shifted.getUTCMinutes(),
  }
}

export function minutesFromJapanDateStart(
  value: Date | number | string,
  date: string
): number {
  const instant =
    value instanceof Date ? value.getTime() : new Date(value).getTime()
  return (instant - japanDateStart(date)) / 60_000
}

const weekdays = ["日", "月", "火", "水", "木", "金", "土"]

function formatter(options: Intl.DateTimeFormatOptions) {
  let cached: Intl.DateTimeFormat | undefined
  return (value: Date | number | string) =>
    (cached ??= new Intl.DateTimeFormat("ja-JP", {
      timeZone: japanTimeZone,
      ...options,
    })).format(typeof value === "object" ? value : new Date(value))
}

/** 9:30 */
export const japanTime = formatter({ hour: "2-digit", minute: "2-digit" })
/** 9/13 */
export const japanMonthDay = formatter({ month: "numeric", day: "numeric" })
/** 9/13(日) */
export const japanMonthDayWeekday = formatter({
  month: "numeric",
  day: "numeric",
  weekday: "short",
})
/** 9月13日(日) */
export const japanDateWeekday = formatter({
  month: "long",
  day: "numeric",
  weekday: "short",
})
/** 9/13 9:30 */
export const japanMonthDayTime = formatter({
  month: "numeric",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
})
/** 2026/9/13 9:30:45 */
export const japanTimestamp = formatter({
  year: "numeric",
  month: "numeric",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
})

const fullDate = formatter({ year: "numeric", month: "long", day: "numeric" })

/** 2026年9月13日（日） from a YYYY-MM-DD date. */
export function japanFullDate(date: string): string {
  const start = japanDateStart(date)
  return `${fullDate(start)}（${weekdays[japanWeekday(date)]}）`
}

/** 0 for Sunday, from a YYYY-MM-DD date. */
export function japanWeekday(date: string): number {
  return new Date(japanDateStart(date) + japanOffsetMilliseconds).getUTCDay()
}

/** The value a datetime-local input shows for an instant, in Japan time. */
export function japanInputValue(value: Date | number | string): string {
  const at = japanDateTime(value)
  return `${at.date}T${String(at.hour).padStart(2, "0")}:${String(at.minute).padStart(2, "0")}`
}

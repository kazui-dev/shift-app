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

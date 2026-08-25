export type DateWindowExtension = {
  dates: string[]
  pageShift: number
}

export function localDate(value: string): Date {
  return new Date(`${value}T12:00:00`)
}

export function dateValue(value: Date): string {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`
}

export function moveDate(value: string, days: number): string {
  const next = localDate(value)
  next.setDate(next.getDate() + days)
  return dateValue(next)
}

export function moveMonth(
  value: string,
  months: number,
  preferredDay: number
): string {
  const current = localDate(value)
  current.setDate(1)
  current.setMonth(current.getMonth() + months)
  const lastDay = new Date(
    current.getFullYear(),
    current.getMonth() + 1,
    0
  ).getDate()
  current.setDate(Math.min(preferredDay, lastDay))
  return dateValue(current)
}

export function monthValue(date: string): string {
  return date.slice(0, 7)
}

export function moveMonthValue(value: string, months: number): string {
  return monthValue(moveMonth(`${value}-01`, months, 1))
}

export function monthDistance(from: string, to: string): number {
  const fromDate = localDate(`${from}-01`)
  const toDate = localDate(`${to}-01`)
  return (
    (toDate.getFullYear() - fromDate.getFullYear()) * 12 +
    toDate.getMonth() -
    fromDate.getMonth()
  )
}

export function createDateWindow(center: string, radius: number): string[] {
  return Array.from({ length: radius * 2 + 1 }, (_, index) =>
    moveDate(center, index - radius)
  )
}

export function windowForDate(
  dates: string[],
  target: string,
  radius: number
): string[] {
  return dates.includes(target) ? dates : createDateWindow(target, radius)
}

export function extendDateWindow(
  dates: string[],
  direction: "before" | "after",
  count: number,
  maxLength = Number.POSITIVE_INFINITY
): DateWindowExtension {
  const first = dates[0]
  const last = dates.at(-1)
  if (!first || !last || count <= 0) return { dates, pageShift: 0 }

  if (direction === "before") {
    const added = Array.from({ length: count }, (_, index) =>
      moveDate(first, index - count)
    )
    return {
      dates: [...added, ...dates].slice(0, maxLength),
      pageShift: added.length,
    }
  }

  const added = Array.from({ length: count }, (_, index) =>
    moveDate(last, index + 1)
  )
  const extended = [...dates, ...added]
  const removed = Math.max(0, extended.length - maxLength)
  return {
    dates: extended.slice(removed),
    pageShift: removed === 0 ? 0 : -removed,
  }
}

export function snappedDate(
  dates: string[],
  scrollLeft: number,
  pageWidth: number
): string | null {
  if (dates.length === 0 || pageWidth <= 0) return null
  const index = Math.max(
    0,
    Math.min(dates.length - 1, Math.round(scrollLeft / pageWidth))
  )
  return dates[index] ?? null
}

export function monthValuesForDates(dates: string[]): string[] {
  return [...new Set(dates.map(monthValue))]
}

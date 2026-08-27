export type WeekWindowExtension = {
  weeks: string[]
  prepended: number
}

export type DayPagerPreview = {
  fromDate: string
  toDate: string
  sameWeek: boolean
  progress: number
}

export type DayPagerOffset = -2 | -1 | 0 | 1 | 2

export const dayPagerCenterPage = 2

export function localDate(value: string): Date {
  return new Date(`${value}T12:00:00`)
}

function dateValue(value: Date): string {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`
}

export function moveDate(value: string, days: number): string {
  const next = localDate(value)
  next.setDate(next.getDate() + days)
  return dateValue(next)
}

export function weekStart(value: string): string {
  return moveDate(value, -localDate(value).getDay())
}

export function weekDates(value: string): string[] {
  const start = weekStart(value)
  return Array.from({ length: 7 }, (_, weekday) => moveDate(start, weekday))
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

export function dayPagerDates(
  date: string
): [string, string, string, string, string] {
  return [
    moveDate(date, -2),
    moveDate(date, -1),
    date,
    moveDate(date, 1),
    moveDate(date, 2),
  ]
}

export function createWeekWindow(center: string, radius: number): string[] {
  const centerWeek = weekStart(center)
  return Array.from({ length: radius * 2 + 1 }, (_, index) =>
    moveDate(centerWeek, (index - radius) * 7)
  )
}

export function weekWindowForDate(
  weeks: string[],
  target: string,
  radius: number
): string[] {
  return weeks.includes(weekStart(target))
    ? weeks
    : createWeekWindow(target, radius)
}

export function weekWindowExtensionDirection(
  index: number,
  length: number,
  threshold: number
): "before" | "after" | null {
  if (index <= threshold) return "before"
  if (index >= length - 1 - threshold) return "after"
  return null
}

export function extendWeekWindow(
  weeks: string[],
  direction: "before" | "after",
  count: number
): WeekWindowExtension {
  const first = weeks[0]
  const last = weeks.at(-1)
  if (!first || !last || count <= 0) return { weeks, prepended: 0 }

  if (direction === "before") {
    const added = Array.from({ length: count }, (_, index) =>
      moveDate(first, (index - count) * 7)
    )
    return {
      weeks: [...added, ...weeks],
      prepended: added.length,
    }
  }

  const added = Array.from({ length: count }, (_, index) =>
    moveDate(last, (index + 1) * 7)
  )
  return {
    weeks: [...weeks, ...added],
    prepended: 0,
  }
}

function scrollPosition(
  pageCount: number,
  scrollLeft: number,
  pageWidth: number
): number | null {
  if (pageCount === 0 || pageWidth <= 0) return null
  return Math.max(0, Math.min(pageCount - 1, scrollLeft / pageWidth))
}

export function dayPagerPosition(
  scrollLeft: number,
  pageWidth: number
): number | null {
  return scrollPosition(dayPagerCenterPage * 2 + 1, scrollLeft, pageWidth)
}

export function dayPagerSettleOffset(
  scrollLeft: number,
  pageWidth: number
): DayPagerOffset | null {
  const position = dayPagerPosition(scrollLeft, pageWidth)
  if (position === null) return null
  const page = Math.round(position)
  if (page === 0) return -2
  if (page === 1) return -1
  if (page === 3) return 1
  if (page === 4) return 2
  return 0
}

export function dayPagerBoundaryOffset(
  scrollLeft: number,
  pageWidth: number
): DayPagerOffset | null {
  const offset = dayPagerSettleOffset(scrollLeft, pageWidth)
  if (offset === null) return null
  const boundary = (offset + dayPagerCenterPage) * pageWidth
  return Math.abs(scrollLeft - boundary) <= 1 ? offset : null
}

export function snappedDayPagerDate(
  date: string,
  scrollLeft: number,
  pageWidth: number
): string | null {
  const offset = dayPagerSettleOffset(scrollLeft, pageWidth)
  return offset === null ? null : moveDate(date, offset)
}

export function weekScrollPosition(
  weeks: string[],
  scrollLeft: number,
  pageWidth: number
): number | null {
  return scrollPosition(weeks.length, scrollLeft, pageWidth)
}

export function snappedWeekDate(
  weeks: string[],
  scrollLeft: number,
  pageWidth: number,
  selectedDate: string
): string | null {
  const position = weekScrollPosition(weeks, scrollLeft, pageWidth)
  if (position === null) return null
  const start = weeks[Math.round(position)]
  return start ? moveDate(start, localDate(selectedDate).getDay()) : null
}

export function dayPagerPreview(
  dates: string[],
  position: number
): DayPagerPreview | null {
  if (dates.length === 0) return null
  const boundedPosition = Math.max(0, Math.min(dates.length - 1, position))
  const lastIndex = dates.length - 1
  const fromIndex =
    boundedPosition === lastIndex
      ? Math.max(0, lastIndex - 1)
      : Math.floor(boundedPosition)
  const toIndex = Math.min(lastIndex, fromIndex + 1)
  const fromDate = dates[fromIndex]
  const toDate = dates[toIndex]
  if (!fromDate || !toDate) return null
  return {
    fromDate,
    toDate,
    sameWeek: weekStart(fromDate) === weekStart(toDate),
    progress: boundedPosition - fromIndex,
  }
}

export function monthValuesForDates(dates: string[]): string[] {
  return [...new Set(dates.map(monthValue))]
}

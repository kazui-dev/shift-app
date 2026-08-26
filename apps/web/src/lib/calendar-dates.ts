export type WeekWindowExtension = {
  weeks: string[]
  prepended: number
}

export type DayPagerPreview = {
  direction: -1 | 1
  progress: number
}

export type DayPagerWeekPreview = {
  selectedDate: string
  targetDate: string
  sameWeek: boolean
  selectedWeekday: number
  targetWeekday: number
}

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

export function dayPagerDates(date: string): [string, string, string] {
  return [moveDate(date, -1), date, moveDate(date, 1)]
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
  return scrollPosition(3, scrollLeft, pageWidth)
}

export function snappedDayPagerDate(
  date: string,
  scrollLeft: number,
  pageWidth: number
): string | null {
  const position = dayPagerPosition(scrollLeft, pageWidth)
  return position === null ? null : moveDate(date, Math.round(position) - 1)
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

export function dayPagerPreview(position: number): DayPagerPreview | null {
  const boundedPosition = Math.max(0, Math.min(2, position))
  const offset = boundedPosition - 1
  if (offset === 0) return null
  return {
    direction: offset < 0 ? -1 : 1,
    progress: Math.abs(offset),
  }
}

export function dayPagerWeekPreview(
  date: string,
  direction: -1 | 1
): DayPagerWeekPreview {
  const targetDate = moveDate(date, direction)
  return {
    selectedDate: date,
    targetDate,
    sameWeek: weekStart(date) === weekStart(targetDate),
    selectedWeekday: localDate(date).getDay(),
    targetWeekday: localDate(targetDate).getDay(),
  }
}

export function monthValuesForDates(dates: string[]): string[] {
  return [...new Set(dates.map(monthValue))]
}

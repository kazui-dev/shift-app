export type DateWindowExtension = {
  dates: string[]
  pageShift: number
}

export type WeekWindowExtension = {
  weeks: string[]
  prepended: number
}

export type WeekRailPreviewPage = {
  weekStart: string
  selectedDate: string
  indicatorPosition: number
  opacity: number
}

export type WeekRailPreview = {
  fromDate: string
  toDate: string
  progress: number
  pages: WeekRailPreviewPage[]
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

export function createDateWindow(center: string, radius: number): string[] {
  return Array.from({ length: radius * 2 + 1 }, (_, index) =>
    moveDate(center, index - radius)
  )
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

export function snappedDate(
  dates: string[],
  scrollLeft: number,
  pageWidth: number
): string | null {
  const position = calendarDatePosition(dates, scrollLeft, pageWidth)
  if (position === null) return null
  const index = Math.round(position)
  return dates[index] ?? null
}

export function calendarDatePosition(
  dates: string[],
  scrollLeft: number,
  pageWidth: number
): number | null {
  if (dates.length === 0 || pageWidth <= 0) return null
  return Math.max(0, Math.min(dates.length - 1, scrollLeft / pageWidth))
}

export function weekScrollPosition(
  weeks: string[],
  scrollLeft: number,
  pageWidth: number
): number | null {
  return calendarDatePosition(weeks, scrollLeft, pageWidth)
}

export function snappedWeekDate(
  weeks: string[],
  scrollLeft: number,
  pageWidth: number,
  weekday: number
): string | null {
  const position = weekScrollPosition(weeks, scrollLeft, pageWidth)
  if (position === null) return null
  const start = weeks[Math.round(position)]
  return start ? moveDate(start, weekday) : null
}

export function createWeekRailPreview(
  dates: string[],
  position: number
): WeekRailPreview | null {
  if (dates.length === 0) return null
  const boundedPosition = Math.max(0, Math.min(dates.length - 1, position))
  const fromIndex = Math.floor(boundedPosition)
  const toIndex = Math.ceil(boundedPosition)
  const fromDate = dates[fromIndex]
  const toDate = dates[toIndex]
  if (!fromDate || !toDate) return null
  const progress = boundedPosition - fromIndex
  const fromWeekday = localDate(fromDate).getDay()
  const toWeekday = localDate(toDate).getDay()
  const fromWeek = weekStart(fromDate)
  const toWeek = weekStart(toDate)
  const sameWeek = fromWeek === toWeek

  if (sameWeek) {
    return {
      fromDate,
      toDate,
      progress,
      pages: [
        {
          weekStart: fromWeek,
          selectedDate: progress < 0.5 ? fromDate : toDate,
          indicatorPosition: fromWeekday + (toWeekday - fromWeekday) * progress,
          opacity: 1,
        },
      ],
    }
  }

  return {
    fromDate,
    toDate,
    progress,
    pages: [
      {
        weekStart: fromWeek,
        selectedDate: fromDate,
        indicatorPosition: fromWeekday + progress * 2,
        opacity: 1 - progress,
      },
      {
        weekStart: toWeek,
        selectedDate: toDate,
        indicatorPosition: toWeekday - (1 - progress) * 2,
        opacity: progress,
      },
    ],
  }
}

export function monthValuesForDates(dates: string[]): string[] {
  return [...new Set(dates.map(monthValue))]
}

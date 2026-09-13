import { calendarWeekPresentation } from "@/lib/calendar/week"

export function resetCalendarWeekHeader(root: HTMLDivElement): void {
  root.style.setProperty("--calendar-day-progress-active", "0")
  root.style.setProperty("--calendar-swipe-offset", "0%")
  root.style.setProperty("--calendar-cross-progress", "0")
  root.style.setProperty("--calendar-previous-progress", "0")
  root.style.setProperty("--calendar-next-progress", "0")
  root.style.setProperty("--calendar-indicator-duration", "160ms")
}

export function paintCalendarWeekHeader(
  root: HTMLDivElement,
  date: string,
  offset: number
): void {
  const presentation = calendarWeekPresentation(date, offset)

  root.style.setProperty(
    "--calendar-day-progress-active",
    Math.abs(offset) > Number.EPSILON ? "1" : "0"
  )
  root.style.setProperty("--calendar-swipe-offset", presentation.offsetPercent)
  root.style.setProperty("--calendar-indicator-duration", "0ms")
  root.style.setProperty(
    "--calendar-cross-progress",
    String(presentation.crossProgress)
  )
  root.style.setProperty(
    "--calendar-previous-progress",
    String(presentation.previousProgress)
  )
  root.style.setProperty(
    "--calendar-next-progress",
    String(presentation.nextProgress)
  )
}

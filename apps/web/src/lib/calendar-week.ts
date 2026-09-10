import { moveDate, weekStart } from "./calendar-dates"

export type CalendarWeekPresentation = {
  crossProgress: number
  nextProgress: number
  offsetPercent: string
  previousProgress: number
}

export function calendarWeekPresentation(
  date: string,
  offset: number
): CalendarWeekPresentation {
  const boundedOffset = Math.max(-1, Math.min(1, offset))
  const previousProgress = Math.max(0, -boundedOffset)
  const nextProgress = Math.max(0, boundedOffset)
  const crossesPreviousWeek = weekStart(date) !== weekStart(moveDate(date, -1))
  const crossesNextWeek = weekStart(date) !== weekStart(moveDate(date, 1))

  return {
    crossProgress: crossesPreviousWeek
      ? previousProgress
      : crossesNextWeek
        ? nextProgress
        : 0,
    nextProgress: crossesNextWeek ? nextProgress : 0,
    offsetPercent: `${boundedOffset * 100}%`,
    previousProgress: crossesPreviousWeek ? previousProgress : 0,
  }
}

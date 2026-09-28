import { moveDate, moveMonthValue } from "@/features/calendar/lib/dates"
import { loopCarouselValues } from "@/features/calendar/lib/loop-carousel"

export function calendarSlideDates(
  selectedDate: string,
  selectedIndex: number
): string[] {
  return loopCarouselValues(selectedDate, selectedIndex, (date, distance) =>
    moveDate(date, distance)
  )
}

export function calendarWeekSlideDates(
  selectedDate: string,
  selectedIndex: number
): string[] {
  return loopCarouselValues(selectedDate, selectedIndex, (date, distance) =>
    moveDate(date, distance * 7)
  )
}

export function calendarMonthSlideValues(
  selectedMonth: string,
  selectedIndex: number
): string[] {
  return loopCarouselValues(selectedMonth, selectedIndex, moveMonthValue)
}

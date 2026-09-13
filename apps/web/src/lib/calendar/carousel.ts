import { moveDate, moveMonthValue } from "@/lib/calendar/dates"
import { loopCarouselValues } from "@/lib/calendar/loop-carousel"

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

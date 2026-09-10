import { moveDate } from "./calendar-dates"

const calendarSlideCount = 7
export const calendarInitialSlide = Math.floor(calendarSlideCount / 2)

type CalendarCarouselPhase = "animating" | "dragging" | "idle"

type CalendarCarouselState = {
  date: string
  dates: string[]
  index: number
  phase: CalendarCarouselPhase
}

export type CalendarCarouselEvent =
  | { type: "pointerDown" }
  | { type: "pointerUp" }
  | { type: "select"; index: number }
  | { type: "settle" }
  | { type: "replace"; date: string; index: number }
  | { type: "reInit"; index: number }

function circularIndexDistance(
  selectedIndex: number,
  index: number,
  count: number
): number {
  const half = Math.floor(count / 2)
  const distance = index - selectedIndex
  if (distance > half) return distance - count
  if (distance < -half) return distance + count
  return distance
}

export function calendarSlideDates(
  selectedDate: string,
  selectedIndex: number,
  count = calendarSlideCount
): string[] {
  return Array.from({ length: count }, (_, index) =>
    moveDate(selectedDate, circularIndexDistance(selectedIndex, index, count))
  )
}

export function createCalendarCarouselState(
  date: string,
  index = calendarInitialSlide
): CalendarCarouselState {
  return {
    date,
    dates: calendarSlideDates(date, index),
    index,
    phase: "idle",
  }
}

export function reduceCalendarCarousel(
  state: CalendarCarouselState,
  event: CalendarCarouselEvent
): CalendarCarouselState {
  if (event.type === "pointerDown") {
    return { ...state, phase: "dragging" }
  }
  if (event.type === "pointerUp") {
    return { ...state, phase: "animating" }
  }
  if (event.type === "settle") {
    return { ...state, phase: "idle" }
  }
  if (event.type === "select") {
    const date = state.dates[event.index]
    if (!date) return state
    return {
      date,
      dates: calendarSlideDates(date, event.index),
      index: event.index,
      phase: "animating",
    }
  }

  return {
    date: event.type === "replace" ? event.date : state.date,
    dates: calendarSlideDates(
      event.type === "replace" ? event.date : state.date,
      event.index
    ),
    index: event.index,
    phase: "idle",
  }
}

function wrapProgress(value: number): number {
  return ((value % 1) + 1) % 1
}

function circularProgressDistance(from: number, to: number): number {
  let distance = wrapProgress(to) - wrapProgress(from)
  if (distance > 0.5) distance -= 1
  if (distance < -0.5) distance += 1
  return distance
}

export function calendarSwipeOffset(
  scrollProgress: number,
  selectedIndex: number,
  snapPoints: number[]
): number {
  const selected = snapPoints[selectedIndex]
  if (selected === undefined || snapPoints.length < 2) return 0

  const distance = circularProgressDistance(selected, scrollProgress)
  if (Math.abs(distance) < Number.EPSILON) return 0

  const adjacentIndex =
    distance > 0
      ? (selectedIndex + 1) % snapPoints.length
      : (selectedIndex - 1 + snapPoints.length) % snapPoints.length
  const adjacent = snapPoints[adjacentIndex]
  if (adjacent === undefined) return 0

  const step = Math.abs(circularProgressDistance(selected, adjacent))
  if (step <= Number.EPSILON) return 0
  return Math.max(-1, Math.min(1, distance / step))
}

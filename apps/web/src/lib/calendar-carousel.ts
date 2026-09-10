import { moveDate } from "./calendar-dates"

export const calendarSlideCount = 7
export const calendarInitialSlide = Math.floor(calendarSlideCount / 2)

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

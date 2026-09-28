const loopCarouselSlideCount = 7
export const loopCarouselInitialSlide = Math.floor(loopCarouselSlideCount / 2)
export const loopCarouselSlots = [
  "loop-carousel-slot-a",
  "loop-carousel-slot-b",
  "loop-carousel-slot-c",
  "loop-carousel-slot-d",
  "loop-carousel-slot-e",
  "loop-carousel-slot-f",
  "loop-carousel-slot-g",
] as const

type LoopCarouselPhase = "animating" | "dragging" | "idle"

export type LoopCarouselState<Value> = {
  index: number
  phase: LoopCarouselPhase
  value: Value
  values: Value[]
}

export type LoopCarouselEvent<Value> =
  | { type: "pointerDown" }
  | { type: "pointerUp" }
  | { type: "select"; index: number }
  | { type: "settle" }
  | { type: "replace"; index: number; value: Value }
  | { type: "reInit"; index: number }

export type LoopCarouselValues<Value> = (value: Value, index: number) => Value[]

export function loopCarouselValues<Value>(
  value: Value,
  selectedIndex: number,
  moveValue: (value: Value, distance: number) => Value
): Value[] {
  const half = Math.floor(loopCarouselSlideCount / 2)
  return Array.from({ length: loopCarouselSlideCount }, (_, index) => {
    let distance = index - selectedIndex
    if (distance > half) distance -= loopCarouselSlideCount
    if (distance < -half) distance += loopCarouselSlideCount
    return moveValue(value, distance)
  })
}

export function createLoopCarouselState<Value>(
  value: Value,
  valuesAround: LoopCarouselValues<Value>,
  index = loopCarouselInitialSlide
): LoopCarouselState<Value> {
  return {
    index,
    phase: "idle",
    value,
    values: valuesAround(value, index),
  }
}

export function reduceLoopCarousel<Value>(
  state: LoopCarouselState<Value>,
  event: LoopCarouselEvent<Value>,
  valuesAround: LoopCarouselValues<Value>
): LoopCarouselState<Value> {
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
    const value = state.values[event.index]
    if (value === undefined) return state
    return {
      index: event.index,
      phase: "animating",
      value,
      values: valuesAround(value, event.index),
    }
  }

  const value = event.type === "replace" ? event.value : state.value
  return {
    index: event.index,
    phase: "idle",
    value,
    values: valuesAround(value, event.index),
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

export function loopCarouselProgress(
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

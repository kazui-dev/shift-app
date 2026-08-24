export type SwipeDirection = -1 | 0 | 1
export type PagerPhase =
  | { kind: "idle" }
  | { kind: "dragging"; gestureId: number }
  | {
      kind: "settling"
      settlementId: number
      direction: SwipeDirection
    }

const minimumFlickDistance = 10
const flickVelocity = 0.45
const projectionTime = 140

export function beginPagerGesture(
  phase: PagerPhase,
  gestureId: number
): { phase: PagerPhase; interruptedDirection: SwipeDirection | null } {
  return {
    phase: { kind: "dragging", gestureId },
    interruptedDirection: phase.kind === "settling" ? phase.direction : null,
  }
}

export function beginPagerSettlement(
  settlementId: number,
  direction: SwipeDirection
): PagerPhase {
  return { kind: "settling", settlementId, direction }
}

export function finishPagerSettlement(
  phase: PagerPhase,
  settlementId: number
): { phase: PagerPhase; direction: SwipeDirection | null } {
  if (phase.kind !== "settling" || phase.settlementId !== settlementId) {
    return { phase, direction: null }
  }
  return { phase: { kind: "idle" }, direction: phase.direction }
}

export function swipeDirection({
  distance,
  elapsed,
  width,
}: {
  distance: number
  elapsed: number
  width: number
}): SwipeDirection {
  if (width <= 0) return 0

  const velocity = distance / Math.max(1, elapsed)
  const projectedDistance = distance + velocity * projectionTime
  const distanceThreshold = Math.min(72, width * 0.22)
  const crossesDistance = Math.abs(distance) >= distanceThreshold
  const crossesVelocity =
    Math.abs(distance) >= minimumFlickDistance &&
    Math.abs(velocity) >= flickVelocity &&
    Math.abs(projectedDistance) >= distanceThreshold

  if (!crossesDistance && !crossesVelocity) return 0
  return projectedDistance < 0 ? 1 : -1
}

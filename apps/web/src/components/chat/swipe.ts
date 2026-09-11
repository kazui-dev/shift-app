export type ChatPanel = 0 | 1

export function swipeDestination(
  start: ChatPanel,
  distance: number,
  width: number,
  velocity: number
): ChatPanel {
  if (width <= 0 || Math.abs(distance) < 24) return start
  if (Math.sign(velocity) !== Math.sign(distance) && Math.abs(velocity) > 0.2)
    return start
  if (Math.abs(distance) < width * 0.3 && Math.abs(velocity) < 0.5) return start
  return distance > 0 ? 0 : 1
}

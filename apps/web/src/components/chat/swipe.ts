export type ChatPanel = 0 | 1

export function swipeIntent(
  start: ChatPanel,
  dx: number,
  dy: number
): "pending" | "native" | "horizontal" {
  if (Math.max(Math.abs(dx), Math.abs(dy)) < 16) return "pending"
  if (
    Math.abs(dy) * 1.5 >= Math.abs(dx) ||
    (start === 0 && dx > 0) ||
    (start === 1 && dx < 0)
  )
    return "native"
  return "horizontal"
}

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

export type Point = { x: number; y: number }
export type ImageView = Point & { scale: number }
export const initialImageView: ImageView = { x: 0, y: 0, scale: 1 }

export function limitImageView(
  view: ImageView,
  width: number,
  height: number,
  imageWidth = width,
  imageHeight = height
): ImageView {
  const scale = Math.max(1, Math.min(5, view.scale))
  if (scale === 1) return initialImageView
  const x = Math.max(0, (imageWidth * scale - width) / 2)
  const y = Math.max(0, (imageHeight * scale - height) / 2)
  return {
    scale,
    x: x === 0 ? 0 : Math.max(-x, Math.min(x, view.x)),
    y: y === 0 ? 0 : Math.max(-y, Math.min(y, view.y)),
  }
}

// Keep the image point under the fingers stationary while they move apart.
export function zoomImage(
  view: ImageView,
  scale: number,
  from: Point,
  to = from
): ImageView {
  const next = Math.max(1, Math.min(5, scale))
  const ratio = next / view.scale
  return {
    scale: next,
    x: to.x - (from.x - view.x) * ratio,
    y: to.y - (from.y - view.y) * ratio,
  }
}

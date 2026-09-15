/** Where the picked image sits behind the round viewport, in viewport pixels. */
export type Frame = { scale: number; x: number; y: number }
export type Size = { width: number; height: number }
export type Point = { x: number; y: number }

/** The smallest scale that still covers the viewport on both sides. */
export function coveringScale(image: Size, viewport: number): number {
  return Math.max(viewport / image.width, viewport / image.height)
}

/** Keeps the image covering the viewport after a move or a zoom. */
export function clampFrame(frame: Frame, image: Size, viewport: number): Frame {
  const scale = Math.min(
    Math.max(frame.scale, coveringScale(image, viewport)),
    coveringScale(image, viewport) * 8
  )
  const limit = (length: number) => Math.min(viewport - length * scale, 0)
  return {
    scale,
    x: Math.min(Math.max(frame.x, limit(image.width)), 0),
    y: Math.min(Math.max(frame.y, limit(image.height)), 0),
  }
}

/** The whole image, centred and as small as the viewport allows. */
export function initialFrame(image: Size, viewport: number): Frame {
  const scale = coveringScale(image, viewport)
  return clampFrame(
    {
      scale,
      x: (viewport - image.width * scale) / 2,
      y: (viewport - image.height * scale) / 2,
    },
    image,
    viewport
  )
}

/** Zooms so the point under the fingers stays where it is. */
export function zoomFrame(
  frame: Frame,
  image: Size,
  viewport: number,
  scale: number,
  focus: Point
): Frame {
  const next = clampFrame({ ...frame, scale }, image, viewport)
  const ratio = next.scale / frame.scale
  return clampFrame(
    {
      scale: next.scale,
      x: focus.x - (focus.x - frame.x) * ratio,
      y: focus.y - (focus.y - frame.y) * ratio,
    },
    image,
    viewport
  )
}

/** The square of the source image the viewport shows, in source pixels. */
export function cropRect(frame: Frame, viewport: number) {
  return {
    x: (0 - frame.x) / frame.scale,
    y: (0 - frame.y) / frame.scale,
    size: viewport / frame.scale,
  }
}

/** The distance between two pointers, for pinch zooming. */
export function spread(first: Point, second: Point): number {
  return Math.hypot(first.x - second.x, first.y - second.y)
}

/** The point between two pointers. */
export function midpoint(first: Point, second: Point): Point {
  return { x: (first.x + second.x) / 2, y: (first.y + second.y) / 2 }
}

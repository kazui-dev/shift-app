import type { ChatImageSize } from "@workspace/shared/communications"

/** A frame of several images is at most this wide. */
export const frameWidth = 512
/** The space between tiles. */
export const tileGap = 4
/** Three images put one tall image beside two stacked ones in a 4:3 frame. */
export const splitAspect = 4 / 3
/** A single image stands at most this tall. */
const singleHeight = 320

/**
 * How a message's images share one rounded frame. Three images put one tall
 * image beside two stacked ones; otherwise rows of up to three fill the frame,
 * with any remainder on the top row and four as two pairs.
 */
export function mosaic(count: number): { split: boolean; rows: number[] } {
  if (count === 3) return { split: true, rows: [1, 2] }
  if (count <= 2) return { split: false, rows: count ? [count] : [] }
  if (count === 4) return { split: false, rows: [2, 2] }
  const remainder = count % 3
  return {
    split: false,
    rows: [
      ...(remainder ? [remainder] : []),
      ...Array.from({ length: Math.floor(count / 3) }, () => 3),
    ],
  }
}

/** Width to height of a row: one wide tile at 16:9, or tiles of 1:1 each. */
export const rowAspect = (count: number) => (count === 1 ? 16 / 9 : count)

/**
 * The size each image of a message is delivered at: a tile as wide as the
 * frame or as tall as two takes 1280, a smaller one 640.
 */
export function tileSizes(count: number): ChatImageSize[] {
  const { split, rows } = mosaic(count)
  if (split) return [1280, 640, 640]
  return rows.flatMap((size) =>
    Array.from({ length: size }, () => (size === 1 ? 1280 : 640))
  )
}

/** A single image's box, reserved at its own proportions and at most 320px tall. */
export function singleImageSize(
  size: { width: number; height: number } = { width: 192, height: 192 }
) {
  return {
    width: Math.min(size.width, (singleHeight * size.width) / size.height),
    aspectRatio: `${size.width} / ${size.height}`,
  }
}

/** How tall a message's images stand when their frame may be `available` px wide. */
export function frameHeight(
  images: readonly { width: number; height: number }[],
  available: number
) {
  const [first] = images
  if (!first) return 0
  if (images.length === 1)
    return (
      (Math.min(available, singleImageSize(first).width) * first.height) /
      first.width
    )
  const width = Math.min(frameWidth, available)
  const { split, rows } = mosaic(images.length)
  if (split) return width / splitAspect
  return (
    rows.reduce((sum, count) => sum + width / rowAspect(count), 0) +
    tileGap * (rows.length - 1)
  )
}

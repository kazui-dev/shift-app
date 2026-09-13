import type { ChatImageSize } from "@workspace/shared/communications"

/**
 * How a message's images share one rounded frame. Three images put one tall
 * image beside two stacked ones; otherwise rows of up to three fill the frame,
 * with any remainder on the top row and four as two pairs.
 */
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

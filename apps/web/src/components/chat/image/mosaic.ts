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

/** Height of a mobile thumbnail and its narrow resting width, in rem. */
const height = 3
const narrow = 1.5

/**
 * A mobile thumbnail rests narrow and widens to a square as it comes into view
 * (`focus` from 0 to 1). Every strip is as wide whatever image is in view, so
 * ten images fit a phone's width.
 */
export function thumbnailWidth(focus: number) {
  return narrow + (height - narrow) * Math.min(1, Math.max(0, focus))
}

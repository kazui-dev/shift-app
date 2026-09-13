/** Height of a mobile thumbnail and its narrow resting width, in rem. */
const height = 3.5
const narrow = 1.75
const widest = 7

/**
 * A mobile thumbnail rests narrow and portrait, and widens towards the image's
 * own proportions as it comes into view (`focus` from 0 to 1).
 */
export function thumbnailWidth(
  image: { width: number; height: number },
  focus: number
) {
  const natural = Math.min(
    widest,
    Math.max(narrow, (height * image.width) / image.height)
  )
  return narrow + (natural - narrow) * Math.min(1, Math.max(0, focus))
}

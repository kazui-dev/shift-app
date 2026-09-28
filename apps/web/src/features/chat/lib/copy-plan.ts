/** The longest edge of a display copy: the largest size chat images are shown at. */
export const copyEdge = 2400

/** Animated images keep every frame, so they are never copied. */
export const copiesType = (type: string) => type !== "image/gif"

/**
 * Whether a display copy is worth sending ahead of its original. A copy that
 * saves less than 30% of the bytes would only add a second upload.
 */
export const copyWorthSending = (copyBytes: number, originalBytes: number) =>
  copyBytes <= originalBytes * 0.7

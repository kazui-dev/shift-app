// Reserve the same geometry while a Blob uploads and its remote image loads.
export function imageSize(
  size: { width: number; height: number } = { width: 192, height: 192 }
) {
  return {
    width: Math.min(size.width, (320 * size.width) / size.height),
    aspectRatio: `${size.width} / ${size.height}`,
  }
}

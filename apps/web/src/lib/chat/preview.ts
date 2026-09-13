/** The longest edge of this device's previews of picked images. */
const edge = 1280

export type ImagePreview = { blob: Blob; width: number; height: number }

const previews = new WeakMap<Blob, Promise<ImagePreview | null>>()

/**
 * A copy of a picked image at most 1280px long, made once per file for the
 * rail and the sending message, with the original's size. `null` when this
 * device cannot decode the image, as most browsers cannot decode HEIC.
 */
export function imagePreview(blob: Blob) {
  let preview = previews.get(blob)
  if (!preview) {
    preview = scaledCopy(blob)
    previews.set(blob, preview)
  }
  return preview
}

async function scaledCopy(blob: Blob): Promise<ImagePreview | null> {
  try {
    const bitmap = await createImageBitmap(blob)
    const { width, height } = bitmap
    const scale = Math.min(1, edge / Math.max(width, height))
    const canvas = new OffscreenCanvas(
      Math.max(1, Math.round(width * scale)),
      Math.max(1, Math.round(height * scale))
    )
    const context = canvas.getContext("2d")
    context?.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    bitmap.close()
    if (!context) return null
    return {
      blob: await canvas.convertToBlob({ type: "image/webp", quality: 0.85 }),
      width,
      height,
    }
  } catch {
    return null
  }
}

import {
  copiesType,
  copyEdge,
  copyWorthSending,
} from "@/features/chat/lib/copy-plan"

/**
 * What is sent first and shown for a picked image: a WebP copy at most 2400px
 * long when it saves enough bytes, else the image itself, with the image's
 * size as displayed.
 */
export type DisplayCopy = {
  blob: Blob
  width: number
  height: number
  copied: boolean
}

/**
 * The display copy of a picked image. `null` when this device cannot decode
 * the image, as most browsers cannot decode HEIC.
 */
export async function makeDisplayCopy(blob: Blob): Promise<DisplayCopy | null> {
  try {
    const bitmap = await createImageBitmap(blob)
    const { width, height } = bitmap
    const itself = { blob, width, height, copied: false }
    if (!copiesType(blob.type)) {
      bitmap.close()
      return itself
    }
    const scale = Math.min(1, copyEdge / Math.max(width, height))
    const canvas = new OffscreenCanvas(
      Math.max(1, Math.round(width * scale)),
      Math.max(1, Math.round(height * scale))
    )
    const context = canvas.getContext("2d")
    context?.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    bitmap.close()
    if (!context) return itself
    const copy = await canvas.convertToBlob({
      type: "image/webp",
      quality: 0.9,
    })
    // A browser that cannot write WebP returns PNG, which would not be smaller.
    if (copy.type !== "image/webp" || !copyWorthSending(copy.size, blob.size))
      return itself
    return { blob: copy, width, height, copied: true }
  } catch {
    return null
  }
}

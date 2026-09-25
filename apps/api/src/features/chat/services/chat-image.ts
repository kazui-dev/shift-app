import { chatImageLimits } from "@workspace/shared/communications"

import {
  isStoredImageType,
  storedImage,
  type StoredImageType,
} from "../domain/stored-image"

/** Formats many apps cannot open, stored as JPEG instead. */
const convertedTypes = new Set(["image/heic", "image/heif", "image/avif"])
/** The longest edge Images can encode as JPEG. */
const jpegEdge = 12_000

/**
 * The upload as it will be stored, or `null` when this chat does not accept
 * it. JPEG, PNG, WebP and GIF keep their pixels; HEIC, HEIF and AVIF become
 * JPEG.
 */
export async function storableImage(
  images: Pick<ImagesBinding, "info" | "input">,
  blob: Blob
) {
  const info = await images.info(blob.stream()).catch(() => null)
  if (
    !info ||
    !("width" in info) ||
    info.width * info.height > chatImageLimits.pixels
  )
    return null
  if (isStoredImageType(info.format)) {
    try {
      return {
        ...storedImage(new Uint8Array(await blob.arrayBuffer()), info.format),
        type: info.format,
      }
    } catch {
      return null
    }
  }
  if (!convertedTypes.has(info.format)) return null
  const result = await images
    .input(blob.stream())
    .transform({ width: jpegEdge, height: jpegEdge, fit: "scale-down" })
    .output({ format: "image/jpeg", quality: 92 })
  const type: StoredImageType = "image/jpeg"
  return {
    ...storedImage(new Uint8Array(await result.response().arrayBuffer()), type),
    type,
  }
}

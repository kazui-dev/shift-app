import type { ParsedImage } from "./image-bytes"
import { gif } from "./image-gif"
import { jpeg } from "./image-jpeg"
import { png } from "./image-png"
import { webp } from "./image-webp"

/** Formats kept as uploaded. HEIC, HEIF and AVIF are converted to JPEG first. */
const storedImageTypes = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
] as const
export type StoredImageType = (typeof storedImageTypes)[number]

export function isStoredImageType(value: string): value is StoredImageType {
  return storedImageTypes.some((type) => type === value)
}

/** The extension an image saves with in its stored format. */
export const storedImageExtensions: Record<StoredImageType, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
}

const parsers: Record<StoredImageType, (input: Uint8Array) => ParsedImage> = {
  "image/jpeg": jpeg,
  "image/png": png,
  "image/webp": webp,
  "image/gif": gif,
}

/**
 * The image as stored: its pixels untouched, with location, camera, comments
 * and unknown metadata removed. The colour profile and orientation stay,
 * because they change how the image looks. The size is as displayed, with the
 * orientation applied.
 */
export function storedImage(input: Uint8Array, type: StoredImageType) {
  const { bytes, width, height, orientation } = parsers[type](input)
  const turned = orientation >= 5
  return {
    bytes,
    width: turned ? height : width,
    height: turned ? width : height,
  }
}

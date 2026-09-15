import { avatarLimits } from "@workspace/shared/auth"

/** Where a member's profile image lives in the chat image bucket. */
export function avatarKey(memberId: string): string {
  return `avatars/${memberId}`
}

/** The path a stored profile image is served from. */
export function avatarPath(memberId: string): string {
  return `/api/members/${memberId}/avatar`
}

/**
 * The upload as it will be stored: a square WebP at the avatar edge, or `null`
 * when the bytes are not an image the Images binding can read.
 */
export async function storableAvatar(
  images: Pick<ImagesBinding, "info" | "input">,
  blob: Blob
): Promise<Uint8Array | null> {
  const info = await images.info(blob.stream()).catch(() => null)
  if (
    !info ||
    !("width" in info) ||
    info.width * info.height > avatarLimits.pixels
  ) {
    return null
  }
  try {
    const result = await images
      .input(blob.stream())
      .transform({
        width: avatarLimits.edge,
        height: avatarLimits.edge,
        fit: "cover",
      })
      .output({ format: "image/webp", quality: 85, anim: false })
    return new Uint8Array(await result.response().arrayBuffer())
  } catch {
    return null
  }
}

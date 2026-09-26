import { avatarLimits } from "@workspace/shared/auth"

/** Where a member's profile image lives in the chat image bucket. */
export function avatarKey(memberId: string): string {
  return `avatars/${memberId}`
}

/**
 * The path a stored profile image is served from. A new upload replaces the
 * object at the same key, so the saved URL carries the version that made it;
 * without it browsers and caches would keep showing the previous image.
 */
export function avatarPath(memberId: string, version: number): string {
  return `/api/members/${memberId}/avatar?v=${version}`
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

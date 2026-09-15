/**
 * The profile image a user row may keep: a Discord custom avatar at 128px WebP,
 * or an image uploaded to this deployment. Anything else, including Discord's
 * default icons, is cleared so the member's initial is shown instead.
 */
export function normalizeProfileImage<
  T extends { image?: string | null | undefined },
>(profile: T, baseUrl: string) {
  if (profile.image == null) return profile
  return isAllowedImage(profile.image, baseUrl)
    ? profile
    : { ...profile, image: null }
}

const discordAvatar =
  /^https:\/\/cdn\.discordapp\.com\/avatars\/\d+\/[a-zA-Z0-9_]+\.webp\?size=128$/
const ownAvatar =
  /^\/api\/members\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/avatar(?:\?v=\d+)?$/

function isAllowedImage(image: string, baseUrl: string): boolean {
  if (discordAvatar.test(image)) return true
  return (
    image.startsWith(baseUrl) && ownAvatar.test(image.slice(baseUrl.length))
  )
}

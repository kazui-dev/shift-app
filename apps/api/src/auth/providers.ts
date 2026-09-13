import * as v from "valibot"

type OAuthTokens = {
  accessToken?: string | undefined
}

type OAuthUserInfo = {
  user: {
    id: string
    name: string
    email: string
    image: string
    emailVerified: boolean
  }
  data: Record<string, unknown>
}

const discordProfileSchema = v.object({
  id: v.pipe(v.string(), v.regex(/^\d+$/)),
  username: v.pipe(v.string(), v.minLength(1)),
  global_name: v.optional(v.nullable(v.string())),
  avatar: v.optional(v.nullable(v.string())),
})

async function readJson(response: Response): Promise<unknown> {
  if (!response.ok) {
    return null
  }

  const contentType = response.headers.get("content-type")
  if (!contentType?.includes("application/json")) {
    return null
  }

  return response.json()
}

export async function getDiscordUserInfo(
  tokens: OAuthTokens,
  guildId: string
): Promise<OAuthUserInfo | null> {
  if (!tokens.accessToken) {
    return null
  }

  const headers = { Authorization: `Bearer ${tokens.accessToken}` }
  const [profileResponse, memberResponse] = await Promise.all([
    fetch("https://discord.com/api/v10/users/@me", { headers }),
    fetch(
      `https://discord.com/api/v10/users/@me/guilds/${encodeURIComponent(guildId)}/member`,
      { headers }
    ),
  ])

  if (!memberResponse.ok) {
    return null
  }

  const parsedProfile = v.safeParse(
    discordProfileSchema,
    await readJson(profileResponse)
  )
  if (!parsedProfile.success) {
    return null
  }

  const profile = parsedProfile.output
  const image = profile.avatar
    ? `https://cdn.discordapp.com/avatars/${profile.id}/${profile.avatar}.webp?size=128`
    : ""

  return {
    user: {
      id: profile.id,
      name: profile.global_name ?? profile.username,
      email: `discord-${profile.id}@identity.invalid`,
      image,
      emailVerified: false,
    },
    data: profile,
  }
}

// Keep only Discord custom avatars at 128px WebP; an empty OAuth image clears it.
export function normalizeProfileImage<
  T extends { image?: string | null | undefined },
>(profile: T) {
  if (profile.image == null) return profile
  return /^https:\/\/cdn\.discordapp\.com\/avatars\/\d+\/[a-zA-Z0-9_]+\.webp\?size=128$/.test(
    profile.image
  )
    ? profile
    : { ...profile, image: null }
}

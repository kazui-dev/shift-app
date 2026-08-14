import { z } from "zod"

type OAuthTokens = {
  accessToken?: string
}

type OAuthUserInfo = {
  user: {
    id: string
    name: string
    email: string
    image?: string
    emailVerified: boolean
  }
  data: Record<string, unknown>
}

const discordProfileSchema = z.object({
  id: z.string().min(1),
  username: z.string().min(1),
  global_name: z.string().nullable().optional(),
  avatar: z.string().nullable().optional(),
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

  const parsedProfile = discordProfileSchema.safeParse(
    await readJson(profileResponse)
  )
  if (!parsedProfile.success) {
    return null
  }

  const profile = parsedProfile.data
  const image = profile.avatar
    ? `https://cdn.discordapp.com/avatars/${profile.id}/${profile.avatar}.png`
    : undefined

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

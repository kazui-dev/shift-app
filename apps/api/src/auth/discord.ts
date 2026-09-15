import * as v from "valibot"

import type { DrizzleD1Database } from "drizzle-orm/d1"
import { and, eq } from "drizzle-orm"

import { affiliationVerifications } from "@workspace/db/schema"

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

/** Whether the deployment has the credentials Discord OAuth needs. */
export function isDiscordConfigured(env: CloudflareBindings): boolean {
  return [
    env.DISCORD_CLIENT_ID,
    env.DISCORD_CLIENT_SECRET,
    env.DISCORD_GUILD_ID,
  ].every((value) => typeof value === "string" && value.length > 0)
}

/** The Better Auth social provider that verifies guild membership on sign-in. */
export function discordProvider(env: CloudflareBindings) {
  return {
    discord: {
      clientId: env.DISCORD_CLIENT_ID,
      clientSecret: env.DISCORD_CLIENT_SECRET,
      disableDefaultScope: true,
      overrideUserInfoOnSignIn: true,
      scope: ["identify", "guilds.members.read"],
      getUserInfo: (tokens: OAuthTokens) =>
        getDiscordUserInfo(tokens, env.DISCORD_GUILD_ID),
    },
  }
}

/** Keeps the latest guild membership check for a Discord account. */
export function recordAffiliation<TSchema extends Record<string, unknown>>(
  db: DrizzleD1Database<TSchema>,
  organizationId: string
) {
  return async function record(account: {
    accountId: string
    providerId: string
    userId: string
  }) {
    if (account.providerId !== "discord") {
      return
    }

    const now = new Date()
    const [existing] = await db
      .select({ id: affiliationVerifications.id })
      .from(affiliationVerifications)
      .where(
        and(
          eq(affiliationVerifications.providerId, account.providerId),
          eq(affiliationVerifications.providerAccountId, account.accountId)
        )
      )
      .limit(1)

    if (existing) {
      await db
        .update(affiliationVerifications)
        .set({ organizationId, verifiedAt: now, updatedAt: now })
        .where(eq(affiliationVerifications.id, existing.id))
      return
    }

    await db.insert(affiliationVerifications).values({
      id: crypto.randomUUID(),
      userId: account.userId,
      providerId: account.providerId,
      providerAccountId: account.accountId,
      organizationId,
      verifiedAt: now,
      createdAt: now,
      updatedAt: now,
    })
  }
}

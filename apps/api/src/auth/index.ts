import { drizzleAdapter } from "@better-auth/drizzle-adapter"
import { and, eq } from "drizzle-orm"
import { drizzle } from "drizzle-orm/d1"
import { betterAuth } from "better-auth/minimal"

import * as schema from "@workspace/db"
import { affiliationVerifications } from "@workspace/db/schema"

import { getDiscordUserInfo } from "./providers"

const SEVEN_DAYS_IN_SECONDS = 60 * 60 * 24 * 7

function isConfigured(...values: Array<string | undefined>): boolean {
  return values.every((value) => typeof value === "string" && value.length > 0)
}

export function getConfiguredProviders(env: CloudflareBindings) {
  return {
    discord: isConfigured(
      env.DISCORD_CLIENT_ID,
      env.DISCORD_CLIENT_SECRET,
      env.DISCORD_GUILD_ID
    ),
  }
}

export function createAuth(env: CloudflareBindings) {
  const db = drizzle(env.shift_app, { schema })
  const configured = getConfiguredProviders(env)

  async function recordAffiliation(account: {
    accountId: string
    providerId: string
    userId: string
  }) {
    if (account.providerId !== "discord") {
      return
    }

    const now = new Date()
    const organizationId = env.DISCORD_GUILD_ID

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

  return betterAuth({
    appName: "旭祭シフト",
    baseURL: env.BETTER_AUTH_URL,
    secret: env.BETTER_AUTH_SECRET,
    trustedOrigins: [env.BETTER_AUTH_URL],
    database: drizzleAdapter(db, {
      provider: "sqlite",
      schema,
    }),
    emailAndPassword: { enabled: false },
    session: {
      expiresIn: SEVEN_DAYS_IN_SECONDS,
      disableSessionRefresh: true,
    },
    account: {
      encryptOAuthTokens: true,
      updateAccountOnSignIn: true,
      accountLinking: {
        enabled: false,
        disableImplicitLinking: true,
      },
    },
    socialProviders: configured.discord
      ? {
          discord: {
            clientId: env.DISCORD_CLIENT_ID,
            clientSecret: env.DISCORD_CLIENT_SECRET,
            disableDefaultScope: true,
            scope: ["identify", "guilds.members.read"],
            getUserInfo: (tokens) =>
              getDiscordUserInfo(tokens, env.DISCORD_GUILD_ID),
          },
        }
      : {},
    databaseHooks: {
      account: {
        create: {
          after: recordAffiliation,
        },
        update: {
          after: recordAffiliation,
        },
      },
    },
    telemetry: { enabled: false },
  })
}

import { drizzleAdapter } from "@better-auth/drizzle-adapter"
import { drizzle } from "drizzle-orm/d1"
import { betterAuth } from "better-auth/minimal"

import * as schema from "@workspace/db"

import { rosterAuth } from "../features/directory/auth/roster"
import {
  discordProvider,
  isDiscordConfigured,
  recordAffiliation,
} from "./discord"
import { normalizeProfileImage } from "./profile-image"

/** Discord sessions expire so affiliation is checked again by re-authorizing. */
const SEVEN_DAYS_IN_SECONDS = 60 * 60 * 24 * 7
/**
 * A directory session is never re-authorized, and members are not asked to sign
 * in again, so it is kept as long as a cookie may live: browsers cap that at
 * 400 days.
 */
const FOUR_HUNDRED_DAYS_IN_SECONDS = 60 * 60 * 24 * 400

/**
 * The sign-in the entry screen offers. The student directory replaces Discord
 * OAuth rather than joining it, so only one of the two is ever configured.
 */
export function getConfiguredProviders(env: CloudflareBindings) {
  const discord =
    env.DISCORD_OAUTH_ENABLED !== "false" && isDiscordConfigured(env)
  return { discord, roster: !discord }
}

export function createAuth(env: CloudflareBindings) {
  const db = drizzle(env.shift_app, { schema })
  const configured = getConfiguredProviders(env)

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
      expiresIn: configured.roster
        ? FOUR_HUNDRED_DAYS_IN_SECONDS
        : SEVEN_DAYS_IN_SECONDS,
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
    plugins: configured.roster ? [rosterAuth(db)] : [],
    socialProviders: configured.discord ? discordProvider(env) : {},
    databaseHooks: {
      user: {
        create: {
          before: async (user) => ({
            data: normalizeProfileImage(user, env.BETTER_AUTH_URL),
          }),
        },
        update: {
          before: async (user) => ({
            data: normalizeProfileImage(user, env.BETTER_AUTH_URL),
          }),
        },
      },
      account: {
        create: { after: recordAffiliation(db, env.DISCORD_GUILD_ID) },
        update: { after: recordAffiliation(db, env.DISCORD_GUILD_ID) },
      },
    },
    telemetry: { enabled: false },
  })
}

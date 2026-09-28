import type { DrizzleD1Database } from "drizzle-orm/d1"
import * as v from "valibot"
import type { BetterAuthPlugin } from "better-auth"
import { APIError, createAuthEndpoint } from "better-auth/api"
import { setSessionCookie } from "better-auth/cookies"

import {
  displayNameSchema,
  matchesDirectoryName,
  studentIdSchema,
} from "@workspace/shared/auth"

import {
  applyDirectoryPlacement,
  createDirectoryMember,
  findDirectoryEntry,
  findMemberByStudentId,
  readDirectoryYear,
  renameMember,
  type DirectoryEntry,
} from "../services/student-directory"

/** The provider id directory identities are stored under, beside `discord`. */
const rosterProviderId = "roster"

const rosterSignInSchema = v.object({
  studentId: studentIdSchema,
  displayName: displayNameSchema,
})

/** Directory identities are local; the address only keeps the user row unique. */
function rosterEmail(studentId: string): string {
  return `student-${studentId.toLowerCase()}@identity.invalid`
}

// Better Auth keeps its endpoint context type internal; the cookie helper
// takes exactly that context, so borrow it from there.
type SignInContext = Parameters<typeof setSessionCookie>[0]

/**
 * Sign-in from the student directory, used while Discord OAuth is off. The
 * listed student ID and name stand in for the guild membership check: both must
 * match the default year's directory, and its spelling of the name wins. A
 * first sign-in creates the member; later ones return to the same one,
 * including a member an earlier Discord sign-in created for that student ID.
 */
export function rosterAuth<TSchema extends Record<string, unknown>>(
  db: DrizzleD1Database<TSchema>
): BetterAuthPlugin {
  return {
    id: "roster",
    endpoints: {
      signInRoster: createAuthEndpoint(
        "/sign-in/roster",
        { method: "POST" },
        async (ctx) => {
          const parsed = v.safeParse(rosterSignInSchema, ctx.body)
          if (!parsed.success) {
            throw APIError.from("BAD_REQUEST", {
              code: "INVALID_SIGN_IN",
              message:
                parsed.issues[0]?.message ?? "入力内容を確認してください。",
            })
          }

          const year = await readDirectoryYear(db)
          if (year === null) {
            throw APIError.from("FORBIDDEN", {
              code: "NO_DIRECTORY_YEAR",
              message: "現在は利用を開始できません。",
            })
          }

          const entry = await findDirectoryEntry(
            db,
            year,
            parsed.output.studentId
          )
          if (
            !entry ||
            !matchesDirectoryName(parsed.output.displayName, entry.displayName)
          ) {
            throw APIError.from("FORBIDDEN", {
              code: "DIRECTORY_MISMATCH",
              message: "名簿に登録されている学籍番号および氏名と一致しません。",
            })
          }

          const { user, memberId, created } = await resolveMember(
            ctx,
            db,
            entry
          )
          await applyDirectoryPlacement(db, memberId, entry)

          const session = await ctx.context.internalAdapter.createSession(
            user.id
          )
          await setSessionCookie(ctx, { session, user })
          return ctx.json({ created })
        }
      ),
    },
  }
}

/**
 * The user and member for a verified directory entry: the identity that signed
 * in before, the member an earlier identity created, or a new pair.
 */
async function resolveMember<TSchema extends Record<string, unknown>>(
  ctx: SignInContext,
  db: DrizzleD1Database<TSchema>,
  entry: DirectoryEntry
) {
  const adapter = ctx.context.internalAdapter
  const email = rosterEmail(entry.studentId)
  const linked = await adapter.findOAuthUser(
    email,
    entry.studentId,
    rosterProviderId
  )
  const member = await findMemberByStudentId(db, entry.studentId)

  if (member) {
    if (member.displayName !== entry.displayName) {
      await renameMember(db, member.id, entry.displayName)
    }
    // A member an earlier Discord sign-in created keeps its user; the
    // directory identity joins that user instead of starting a second member.
    const existing = linked?.user ?? (await adapter.findUserById(member.userId))
    if (!existing) {
      throw APIError.from("INTERNAL_SERVER_ERROR", {
        code: "MEMBER_WITHOUT_USER",
        message: "アカウントを確認できませんでした。",
      })
    }
    if (!linked) {
      await adapter.linkAccount({
        userId: existing.id,
        accountId: entry.studentId,
        providerId: rosterProviderId,
      })
    }
    const user =
      existing.name === entry.displayName
        ? existing
        : await adapter.updateUser(existing.id, { name: entry.displayName })
    return { user, memberId: member.id, created: false }
  }

  const user =
    linked?.user ??
    (
      await adapter.createOAuthUser(
        { email, name: entry.displayName, emailVerified: false, image: null },
        { accountId: entry.studentId, providerId: rosterProviderId }
      )
    ).user
  const memberId = await createDirectoryMember(db, user.id, entry)
  return { user, memberId, created: true }
}

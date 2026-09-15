import * as v from "valibot"

export const accessLevelSchema = v.picklist([
  "system_admin",
  "leader",
  "member",
])

export function normalizeStudentId(value: string): string {
  return value.normalize("NFKC").trim().toUpperCase()
}

export const studentIdSchema = v.pipe(
  v.string(),
  v.transform(normalizeStudentId),
  v.regex(/^\d{2}[A-Z]{2}\d{3}$/, "学籍番号を00NN000形式で入力してください")
)

export const displayNameSchema = v.pipe(
  v.string(),
  v.transform((value) => value.normalize("NFKC").trim()),
  v.minLength(1, "名前を入力してください"),
  v.maxLength(80)
)

/**
 * The form of a name used only to compare with the student directory. Spacing
 * differs between the directory and what a member types, and it never
 * distinguishes two people, so every space is dropped before comparing.
 */
export function normalizeNameForMatch(value: string): string {
  return value.normalize("NFKC").replace(/\s+/gu, "")
}

/** Whether a typed name matches the directory's, ignoring spacing. */
export function matchesDirectoryName(typed: string, listed: string): boolean {
  const normalized = normalizeNameForMatch(typed)
  return normalized.length > 0 && normalized === normalizeNameForMatch(listed)
}

/**
 * What an uploaded profile image may weigh, and the square it is stored at.
 * The edge matches the size Discord avatars are kept at, so both look alike.
 */
export const avatarLimits = {
  bytes: 8 * 1024 * 1024,
  pixels: 50_000_000,
  edge: 128,
} as const

export const onboardingInputSchema = v.object({
  studentId: studentIdSchema,
  displayName: displayNameSchema,
})

export const adminReasonSchema = v.pipe(
  v.string(),
  v.transform((value) => value.normalize("NFKC").trim()),
  v.minLength(1, "操作理由を入力してください"),
  v.maxLength(240, "操作理由は240文字以内で入力してください")
)

export const updateAccessLevelInputSchema = v.object({
  accessLevel: accessLevelSchema,
  reason: adminReasonSchema,
})

export const revokeSessionsInputSchema = v.object({
  reason: adminReasonSchema,
})

export const identityLinkDecisionInputSchema = v.object({
  decision: v.picklist(["approved", "rejected"]),
  reason: adminReasonSchema,
})

/** The sign-in a deployment offers: Discord OAuth, or the student directory. */
export const providerSchema = v.picklist(["discord", "roster"])

const availableProvidersSchema = v.object({
  discord: v.boolean(),
  roster: v.boolean(),
})

const linkedProvidersSchema = v.array(providerSchema)

export const authStateSchema = v.variant("status", [
  v.object({
    status: v.literal("anonymous"),
    providers: availableProvidersSchema,
  }),
  v.object({
    status: v.literal("onboarding"),
    providers: availableProvidersSchema,
    linkedProviders: linkedProvidersSchema,
  }),
  v.object({
    status: v.literal("active"),
    member: v.object({
      id: v.pipe(v.string(), v.uuid()),
      image: v.nullable(v.pipe(v.string(), v.url())),
      displayName: v.string(),
      studentId: studentIdSchema,
      accessLevel: accessLevelSchema,
    }),
    providers: availableProvidersSchema,
    linkedProviders: linkedProvidersSchema,
  }),
])

export const adminUserSchema = v.object({
  image: v.nullable(v.pipe(v.string(), v.url())),
  years: v.array(v.number()),
  discordLinked: v.boolean(),
  id: v.pipe(v.string(), v.uuid()),
  displayName: v.string(),
  studentId: studentIdSchema,
  accessLevel: accessLevelSchema,
  isCurrentUser: v.boolean(),
  sessionCount: v.pipe(v.number(), v.integer(), v.minValue(0)),
  createdAt: v.pipe(v.number(), v.integer(), v.minValue(0)),
})

export const adminUsersResponseSchema = v.object({
  users: v.array(adminUserSchema),
})

export const adminAuditLogSchema = v.object({
  id: v.string(),
  actorType: v.picklist(["system_admin", "cloudflare_operator"]),
  actorDisplayName: v.nullable(v.string()),
  action: v.string(),
  targetDisplayName: v.nullable(v.string()),
  targetStudentId: v.nullable(studentIdSchema),
  details: v.nullable(v.record(v.string(), v.unknown())),
  createdAt: v.pipe(v.number(), v.integer(), v.minValue(0)),
})

export const adminAuditLogsResponseSchema = v.object({
  auditLogs: v.array(adminAuditLogSchema),
})

export const identityLinkRequestSchema = v.object({
  id: v.pipe(v.string(), v.uuid()),
  requesterDisplayName: v.string(),
  targetDisplayName: v.string(),
  targetStudentId: studentIdSchema,
  createdAt: v.pipe(v.number(), v.integer(), v.minValue(0)),
  targetsCurrentAdmin: v.boolean(),
})

export const identityLinkRequestsResponseSchema = v.object({
  requests: v.array(identityLinkRequestSchema),
})

export const adminMutationResponseSchema = v.object({
  ok: v.literal(true),
})

export const revokeSessionsResponseSchema = v.object({
  ...adminMutationResponseSchema.entries,
  revokedSessions: v.pipe(v.number(), v.integer(), v.minValue(0)),
})

export type Provider = v.InferOutput<typeof providerSchema>
export type AuthState = v.InferOutput<typeof authStateSchema>
export type OnboardingInput = v.InferOutput<typeof onboardingInputSchema>
export type AdminUser = v.InferOutput<typeof adminUserSchema>
export type AdminAuditLog = v.InferOutput<typeof adminAuditLogSchema>
export type IdentityLinkRequest = v.InferOutput<
  typeof identityLinkRequestSchema
>

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

const linkedProvidersSchema = v.array(v.literal("discord"))

export const authStateSchema = v.variant("status", [
  v.object({
    status: v.literal("anonymous"),
    providers: v.object({ discord: v.boolean() }),
  }),
  v.object({
    status: v.literal("onboarding"),
    providers: v.object({ discord: v.boolean() }),
    linkedProviders: linkedProvidersSchema,
  }),
  v.object({
    status: v.literal("active"),
    member: v.object({
      displayName: v.string(),
      studentId: studentIdSchema,
      accessLevel: accessLevelSchema,
    }),
    providers: v.object({ discord: v.boolean() }),
    linkedProviders: linkedProvidersSchema,
  }),
])

export const adminMemberSchema = v.object({
  id: v.pipe(v.string(), v.uuid()),
  displayName: v.string(),
  studentId: studentIdSchema,
  accessLevel: accessLevelSchema,
  isCurrentUser: v.boolean(),
  sessionCount: v.pipe(v.number(), v.integer(), v.minValue(0)),
  createdAt: v.pipe(v.number(), v.integer(), v.minValue(0)),
})

export const adminMembersResponseSchema = v.object({
  members: v.array(adminMemberSchema),
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

export type AuthState = v.InferOutput<typeof authStateSchema>
export type OnboardingInput = v.InferOutput<typeof onboardingInputSchema>
export type AdminMember = v.InferOutput<typeof adminMemberSchema>
export type AdminAuditLog = v.InferOutput<typeof adminAuditLogSchema>
export type IdentityLinkRequest = v.InferOutput<
  typeof identityLinkRequestSchema
>

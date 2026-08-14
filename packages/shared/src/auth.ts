import { z } from "zod"

export const accessLevelSchema = z.enum(["system_admin", "leader", "member"])

export function normalizeStudentId(value: string): string {
  return value.normalize("NFKC").trim().toUpperCase()
}

export const studentIdSchema = z
  .string()
  .transform(normalizeStudentId)
  .pipe(
    z
      .string()
      .regex(/^\d{2}[A-Z]{2}\d{3}$/, "学籍番号を00NN000形式で入力してください")
  )

export const displayNameSchema = z
  .string()
  .transform((value) => value.normalize("NFKC").trim())
  .pipe(z.string().min(1, "名前を入力してください").max(80))

export const onboardingInputSchema = z.object({
  studentId: studentIdSchema,
  displayName: displayNameSchema,
})

export const adminReasonSchema = z
  .string()
  .transform((value) => value.normalize("NFKC").trim())
  .pipe(
    z
      .string()
      .min(1, "操作理由を入力してください")
      .max(240, "操作理由は240文字以内で入力してください")
  )

export const updateAccessLevelInputSchema = z.object({
  accessLevel: accessLevelSchema,
  reason: adminReasonSchema,
})

export const revokeSessionsInputSchema = z.object({
  reason: adminReasonSchema,
})

export const identityLinkDecisionInputSchema = z.object({
  decision: z.enum(["approved", "rejected"]),
  reason: adminReasonSchema,
})

const linkedProvidersSchema = z.array(z.literal("discord"))

export const authStateSchema = z.discriminatedUnion("status", [
  z.object({
    status: z.literal("anonymous"),
    providers: z.object({ discord: z.boolean() }),
  }),
  z.object({
    status: z.literal("onboarding"),
    providers: z.object({ discord: z.boolean() }),
    linkedProviders: linkedProvidersSchema,
  }),
  z.object({
    status: z.literal("active"),
    member: z.object({
      displayName: z.string(),
      studentId: studentIdSchema,
      accessLevel: accessLevelSchema,
    }),
    providers: z.object({ discord: z.boolean() }),
    linkedProviders: linkedProvidersSchema,
  }),
])

export const adminMemberSchema = z.object({
  id: z.string().uuid(),
  displayName: z.string(),
  studentId: studentIdSchema,
  accessLevel: accessLevelSchema,
  isCurrentUser: z.boolean(),
  sessionCount: z.number().int().nonnegative(),
  createdAt: z.number().int().nonnegative(),
})

export const adminMembersResponseSchema = z.object({
  members: z.array(adminMemberSchema),
})

export const adminAuditLogSchema = z.object({
  id: z.string(),
  actorType: z.enum(["system_admin", "cloudflare_operator"]),
  actorDisplayName: z.string().nullable(),
  action: z.string(),
  targetDisplayName: z.string().nullable(),
  targetStudentId: studentIdSchema.nullable(),
  details: z.record(z.string(), z.unknown()).nullable(),
  createdAt: z.number().int().nonnegative(),
})

export const adminAuditLogsResponseSchema = z.object({
  auditLogs: z.array(adminAuditLogSchema),
})

export const identityLinkRequestSchema = z.object({
  id: z.string().uuid(),
  requesterDisplayName: z.string(),
  targetDisplayName: z.string(),
  targetStudentId: studentIdSchema,
  createdAt: z.number().int().nonnegative(),
  targetsCurrentAdmin: z.boolean(),
})

export const identityLinkRequestsResponseSchema = z.object({
  requests: z.array(identityLinkRequestSchema),
})

export const adminMutationResponseSchema = z.object({
  ok: z.literal(true),
})

export const revokeSessionsResponseSchema = adminMutationResponseSchema.extend({
  revokedSessions: z.number().int().nonnegative(),
})

export type AuthState = z.infer<typeof authStateSchema>
export type OnboardingInput = z.infer<typeof onboardingInputSchema>
export type AdminMember = z.infer<typeof adminMemberSchema>
export type AdminAuditLog = z.infer<typeof adminAuditLogSchema>
export type IdentityLinkRequest = z.infer<typeof identityLinkRequestSchema>

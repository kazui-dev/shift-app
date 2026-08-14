import { z } from "zod"

export const accessLevelSchema = z.enum([
  "system_admin",
  "leader",
  "member",
])

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

export type AuthState = z.infer<typeof authStateSchema>
export type OnboardingInput = z.infer<typeof onboardingInputSchema>

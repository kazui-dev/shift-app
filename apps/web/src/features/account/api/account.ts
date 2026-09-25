import * as v from "valibot"

import { authStateSchema, type OnboardingInput } from "@workspace/shared/auth"

import {
  ApiError,
  ApiNetworkError,
  apiJson,
  apiUpload,
  apiVoid,
} from "../../../lib/http/client"

export const getAccountState = () => apiJson("/api/account", authStateSchema)

const accountCreatedSchema = v.object({ ok: v.literal(true) })

export const createAccount = (input: OnboardingInput) =>
  apiJson("/api/account", accountCreatedSchema, {
    method: "PUT",
    body: JSON.stringify(input),
  })

/** Better Auth reports failures as a bare `{ code, message }` body. */
const authErrorSchema = v.object({ code: v.string(), message: v.string() })

const signedInSchema = v.object({ created: v.boolean() })

/**
 * Directory sign-in, used while Discord OAuth is off. The listed student ID and
 * name decide who may continue, so a refusal comes back as a message for the
 * form rather than an OAuth redirect. `created` marks a first sign-in.
 */
export async function signInFromDirectory(
  input: OnboardingInput
): Promise<boolean> {
  let response: Response
  try {
    response = await fetch("/api/auth/sign-in/roster", {
      method: "POST",
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    })
  } catch (error) {
    throw new ApiNetworkError(error)
  }
  if (response.ok) {
    return v.parse(signedInSchema, await response.json()).created
  }

  const parsed = v.safeParse(
    authErrorSchema,
    await response.json().catch(() => null)
  )
  throw new ApiError(
    parsed.success ? parsed.output.message : "利用を開始できませんでした。",
    response.status,
    parsed.success ? parsed.output.code : "SIGN_IN_FAILED"
  )
}

const avatarSchema = v.object({ image: v.pipe(v.string(), v.url()) })

/** Replaces the member's profile image; the server stores a square WebP. */
export const uploadAvatar = (image: Blob) =>
  apiUpload("/api/me/avatar", avatarSchema, image, { method: "PUT" })

/** Clears the member's profile image, leaving their initial. */
export const removeAvatar = () =>
  apiVoid("/api/me/avatar", { method: "DELETE" })

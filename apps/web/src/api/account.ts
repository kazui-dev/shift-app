import * as v from "valibot"

import { authStateSchema, type OnboardingInput } from "@workspace/shared/auth"

import { apiJson } from "./client"

export const getAccountState = () => apiJson("/api/account", authStateSchema)

const accountCreatedSchema = v.object({ ok: v.literal(true) })

export const createAccount = (input: OnboardingInput) =>
  apiJson("/api/account", accountCreatedSchema, {
    method: "PUT",
    body: JSON.stringify(input),
  })

import * as v from "valibot"
import { operatingYearSchema } from "./common"

export const createOperatingYearInputSchema = v.strictObject({
  year: operatingYearSchema,
})

export const replaceYearSettingsInputSchema = v.strictObject({
  defaultYear: operatingYearSchema,
})

export const yearSettingsResponseSchema = v.object({
  defaultYear: v.nullable(operatingYearSchema),
})

export const operatingYearResponseSchema = v.object({
  year: operatingYearSchema,
  isDefault: v.boolean(),
})

export const yearsResponseSchema = v.object({
  years: v.array(
    v.object({
      ...operatingYearResponseSchema.entries,
      canManage: v.boolean(),
    })
  ),
})

export const operatingYearEnvelopeSchema = v.object({
  year: operatingYearResponseSchema,
})

export const displayYearInputSchema = v.strictObject({
  year: operatingYearSchema,
})

export const displayYearResponseSchema = v.object({
  year: v.nullable(operatingYearSchema),
  defaultYear: v.nullable(operatingYearSchema),
  unavailableSelection: v.boolean(),
  years: v.array(operatingYearSchema),
})

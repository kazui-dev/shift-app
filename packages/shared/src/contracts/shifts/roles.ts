import * as v from "valibot"
import { operatingYearSchema } from "./common"

export const shiftPermissionSchema = v.picklist([
  "shift.create",
  "shift.manage",
  "member.manage",
  "role.manage",
])

export const createYearRoleInputSchema = v.object({
  name: v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(80)),
  color: v.pipe(
    v.string(),
    v.regex(/^#[0-9A-Fa-f]{6}$/),
    v.transform((value) => value.toUpperCase())
  ),
  permissions: v.optional(
    v.pipe(v.array(shiftPermissionSchema), v.maxLength(16)),
    []
  ),
})

export const yearRoleResponseSchema = v.object({
  id: v.pipe(v.string(), v.uuid()),
  year: operatingYearSchema,
  position: v.number(),
  name: v.string(),
  color: v.string(),
  permissions: v.array(shiftPermissionSchema),
  memberCount: v.pipe(v.unknown(), v.toNumber(), v.integer(), v.minValue(0)),
})

export const yearRolesResponseSchema = v.object({
  authority: v.object({
    systemAdmin: v.boolean(),
    position: v.nullable(v.number()),
    permissions: v.array(shiftPermissionSchema),
  }),
  roles: v.array(yearRoleResponseSchema),
})

export const yearRoleEnvelopeSchema = v.object({
  role: v.omit(yearRoleResponseSchema, ["memberCount"]),
})

export const roleMembershipResponseSchema = v.object({
  membership: v.object({
    roleId: v.pipe(v.string(), v.uuid()),
    memberId: v.pipe(v.string(), v.uuid()),
  }),
})

export type ShiftPermission = v.InferOutput<typeof shiftPermissionSchema>

export const updateRoleInputSchema = v.strictObject({
  name: v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(80)),
  color: v.pipe(v.string(), v.regex(/^#[0-9a-fA-F]{6}$/)),
  permissions: v.array(shiftPermissionSchema),
})

export const reorderRoleInputSchema = v.strictObject({
  roleIds: v.pipe(
    v.array(v.pipe(v.string(), v.uuid())),
    v.minLength(1),
    v.maxLength(200)
  ),
})

export const memberRoleChangesSchema = v.strictObject({
  memberIds: v.pipe(
    v.array(v.pipe(v.string(), v.uuid())),
    v.minLength(1),
    v.maxLength(200)
  ),
  addRoleIds: v.pipe(v.array(v.pipe(v.string(), v.uuid())), v.maxLength(50)),
  removeRoleIds: v.pipe(v.array(v.pipe(v.string(), v.uuid())), v.maxLength(50)),
})

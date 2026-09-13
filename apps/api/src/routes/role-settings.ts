import { Hono } from "hono"
import * as v from "valibot"
import { updateRoleInputSchema } from "@workspace/shared/shifts"
import { apiError, errors } from "../lib/errors"
import { type ApiEnv, readJson } from "../lib/http"
import { roleAuthority } from "../services/role-authority"

export const roleSettingsApp = new Hono<ApiEnv>()
roleSettingsApp.put("/:roleId", async (c) => {
  const input = v.safeParse(updateRoleInputSchema, await readJson(c.req.raw))
  if (!input.success) return apiError(c, errors.invalidRole)
  const id = c.req.param("roleId")
  const role = await c.env.shift_app
    .prepare("SELECT year, position FROM year_roles WHERE id = ?")
    .bind(id)
    .first<{ year: number; position: number }>()
  if (!role) return apiError(c, errors.roleNotFound)
  const authority = await roleAuthority(
    c.env.shift_app,
    c.get("member"),
    role.year
  )
  if (
    !authority.systemAdmin &&
    (!authority.permissions.has("role.manage") ||
      authority.position <= role.position ||
      input.output.permissions.some(
        (permission) => !authority.permissions.has(permission)
      ))
  )
    return apiError(c, errors.roleEditForbidden)
  const duplicate = await c.env.shift_app
    .prepare("SELECT id FROM year_roles WHERE year=? AND name=? AND id<>?")
    .bind(role.year, input.output.name, id)
    .first()
  if (duplicate) return apiError(c, errors.roleNameExists)
  const now = Date.now()
  await c.env.shift_app.batch([
    c.env.shift_app
      .prepare(
        "UPDATE year_roles SET name = ?, color = ?, updated_at = ? WHERE id = ?"
      )
      .bind(input.output.name, input.output.color, now, id),
    c.env.shift_app
      .prepare("DELETE FROM year_role_permissions WHERE role_id = ?")
      .bind(id),
    ...[...new Set(input.output.permissions)].map((permission) =>
      c.env.shift_app
        .prepare(
          "INSERT INTO year_role_permissions (role_id, permission, created_at) VALUES (?, ?, ?)"
        )
        .bind(id, permission, now)
    ),
  ])
  return c.body(null, 204)
})

roleSettingsApp.delete("/:roleId", async (c) => {
  const id = c.req.param("roleId")
  const role = await c.env.shift_app
    .prepare("SELECT year,position FROM year_roles WHERE id=?")
    .bind(id)
    .first<{ year: number; position: number }>()
  if (!role) return apiError(c, errors.roleNotFound)
  const authority = await roleAuthority(
    c.env.shift_app,
    c.get("member"),
    role.year
  )
  if (
    !authority.systemAdmin &&
    (!authority.permissions.has("role.manage") ||
      authority.position <= role.position)
  )
    return apiError(c, errors.roleEditForbidden)
  await c.env.shift_app.batch([
    c.env.shift_app
      .prepare(
        "DELETE FROM activity_responsibles WHERE target_type='role' AND target_id=?"
      )
      .bind(id),
    c.env.shift_app
      .prepare(
        "DELETE FROM chat_room_targets WHERE target_type='role' AND target_id=?"
      )
      .bind(id),
    c.env.shift_app.prepare("DELETE FROM year_roles WHERE id=?").bind(id),
  ])
  return c.body(null, 204)
})

import { Hono } from "hono"
import { createMiddleware } from "hono/factory"
import * as v from "valibot"
import {
  memberTagChangesSchema,
  tagInputSchema,
  reorderTagInputSchema,
} from "@workspace/shared/shifts"
import { canManageYear } from "../../../../auth/authorization/role-authority"
import { apiError, errors } from "../../../../lib/errors"
import { type ApiEnv, parseYear, readJson } from "../../../../lib/http"
import { announce } from "../../../../routes/announce"

export const yearTagsApp = new Hono<ApiEnv>()
const authorize = createMiddleware<ApiEnv>(async (c, next) => {
  const year = parseYear(c.req.param("year") ?? "")
  if (year === null) return apiError(c, errors.yearNotFound)
  if (
    !(await canManageYear(
      c.env.shift_app,
      c.get("member"),
      year,
      "member.manage"
    ))
  )
    return apiError(c, errors.memberManagementRequired)
  if (
    !(await c.env.shift_app
      .prepare("SELECT year FROM operating_years WHERE year = ?")
      .bind(year)
      .first())
  )
    return apiError(c, errors.yearNotFound)
  return next()
})
yearTagsApp.use("/:year/tags", authorize)
yearTagsApp.use("/:year/tags/*", authorize)
yearTagsApp.use("/:year/member-tags", authorize)
yearTagsApp.use("/:year/tag-order", authorize)

yearTagsApp.get("/:year/tags", async (c) => {
  const rows = await c.env.shift_app
    .prepare(`SELECT t.id, t.name, ym.member_id AS memberId
    FROM year_tags t
    LEFT JOIN member_year_tags mt ON mt.tag_id = t.id
    LEFT JOIN year_memberships ym ON ym.member_id = mt.member_id AND ym.year = t.year AND ym.status = 'active'
    WHERE t.year = ? ORDER BY t.position, t.name, t.id, ym.member_id`)
    .bind(parseYear(c.req.param("year")))
    .all<{ id: string; name: string; memberId: string | null }>()
  const tags = new Map<
    string,
    { id: string; name: string; memberIds: string[] }
  >()
  for (const row of rows.results) {
    const tag = tags.get(row.id) ?? {
      id: row.id,
      name: row.name,
      memberIds: [],
    }
    if (row.memberId) tag.memberIds.push(row.memberId)
    tags.set(row.id, tag)
  }
  return c.json({ tags: [...tags.values()] })
})

yearTagsApp.post(
  "/:year/tags",
  announce({ type: "access_changed" }),
  async (c) => {
    const input = v.safeParse(tagInputSchema, await readJson(c.req.raw))
    if (!input.success) return apiError(c, errors.invalidTag)
    const now = Date.now()
    const result = await c.env.shift_app
      .prepare(`INSERT OR IGNORE INTO year_tags (id, year, name, created_at, updated_at, position)
    VALUES (?, ?, ?, ?, ?, (SELECT COALESCE(MAX(position), -1) + 1 FROM year_tags WHERE year = ?)) RETURNING id`)
      .bind(
        crypto.randomUUID(),
        parseYear(c.req.param("year")),
        input.output.name,
        now,
        now,
        parseYear(c.req.param("year"))
      )
      .all()
    if (!result.results.length) return apiError(c, errors.tagNameExists)
    return c.body(null, 204)
  }
)

yearTagsApp.put(
  "/:year/tags/:tagId",
  announce({ type: "access_changed" }),
  async (c) => {
    const input = v.safeParse(tagInputSchema, await readJson(c.req.raw))
    if (!input.success) return apiError(c, errors.invalidTag)
    const year = parseYear(c.req.param("year"))
    const tagId = c.req.param("tagId")
    const result = await c.env.shift_app
      .prepare(`UPDATE OR IGNORE year_tags SET name = ?, updated_at = ?
    WHERE id = ? AND year = ? RETURNING id`)
      .bind(input.output.name, Date.now(), tagId, year)
      .all()
    if (!result.results.length) {
      const exists = await c.env.shift_app
        .prepare("SELECT id FROM year_tags WHERE id = ? AND year = ?")
        .bind(tagId, year)
        .first()
      return apiError(c, exists ? errors.tagNameExists : errors.tagNotFound)
    }
    return c.body(null, 204)
  }
)

yearTagsApp.delete(
  "/:year/tags/:tagId",
  announce({ type: "access_changed" }),
  async (c) => {
    const result = await c.env.shift_app
      .prepare("DELETE FROM year_tags WHERE id = ? AND year = ? RETURNING id")
      .bind(c.req.param("tagId"), parseYear(c.req.param("year")))
      .all()
    if (!result.results.length) return apiError(c, errors.tagNotFound)
    return c.body(null, 204)
  }
)

yearTagsApp.patch(
  "/:year/member-tags",
  announce({ type: "access_changed" }),
  async (c) => {
    const input = v.safeParse(memberTagChangesSchema, await readJson(c.req.raw))
    if (!input.success) return apiError(c, errors.invalidTagChanges)
    const year = parseYear(c.req.param("year"))
    const memberIds = [...new Set(input.output.memberIds)]
    const add = [...new Set(input.output.addTagIds)]
    const remove = [...new Set(input.output.removeTagIds)]
    const tags = [...add, ...remove]
    const [validMembers, validTags] = await Promise.all([
      c.env.shift_app
        .prepare(
          "SELECT member_id FROM year_memberships WHERE year = ? AND status = 'active' AND member_id IN (SELECT value FROM json_each(?))"
        )
        .bind(year, JSON.stringify(memberIds))
        .all(),
      c.env.shift_app
        .prepare(
          "SELECT id FROM year_tags WHERE year = ? AND id IN (SELECT value FROM json_each(?))"
        )
        .bind(year, JSON.stringify(tags))
        .all(),
    ])
    if (validMembers.results.length !== memberIds.length)
      return apiError(c, errors.memberNotInYear)
    if (validTags.results.length !== tags.length)
      return apiError(c, errors.tagNotFound)
    const statements = [
      ...add.map((id) =>
        c.env.shift_app
          .prepare(`INSERT OR IGNORE INTO member_year_tags (member_id, tag_id, created_at)
      SELECT ym.member_id, t.id, ? FROM year_memberships ym JOIN year_tags t ON t.year = ym.year
      WHERE ym.year = ? AND ym.status = 'active' AND t.id = ? AND ym.member_id IN (SELECT value FROM json_each(?))`)
          .bind(Date.now(), year, id, JSON.stringify(memberIds))
      ),
      ...remove.map((id) =>
        c.env.shift_app
          .prepare(
            "DELETE FROM member_year_tags WHERE tag_id = ? AND member_id IN (SELECT value FROM json_each(?))"
          )
          .bind(id, JSON.stringify(memberIds))
      ),
    ]
    if (statements.length) await c.env.shift_app.batch(statements)
    return c.body(null, 204)
  }
)

yearTagsApp.put(
  "/:year/tag-order",
  announce({ type: "access_changed" }),
  async (c) => {
    const input = v.safeParse(reorderTagInputSchema, await readJson(c.req.raw))
    if (!input.success) return apiError(c, errors.invalidTagOrder)
    const year = parseYear(c.req.param("year"))
    const ids = input.output.tagIds
    const json = JSON.stringify(ids)
    const result = await c.env.shift_app
      .prepare(`
    UPDATE year_tags SET
      position = (SELECT CAST(key AS INTEGER) FROM json_each(?) WHERE value = year_tags.id),
      updated_at = ?
    WHERE year = ?
      AND (SELECT COUNT(*) FROM year_tags WHERE year = ?) = ?
      AND NOT EXISTS (
        SELECT value FROM json_each(?) WHERE value NOT IN (SELECT id FROM year_tags WHERE year = ?)
      )
    RETURNING id
  `)
      .bind(json, Date.now(), year, year, ids.length, json, year)
      .all()
    if (result.results.length !== ids.length)
      return apiError(c, errors.tagOrderChanged)
    return c.body(null, 204)
  }
)

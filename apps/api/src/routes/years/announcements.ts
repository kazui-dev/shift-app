import { Hono } from "hono"
import * as v from "valibot"

import { createAnnouncementInputSchema } from "@workspace/shared/communications"

import {
  apiError,
  type ApiEnv,
  canAccessYear,
  canManageShifts,
  parseYear,
  readJson,
  toIso,
} from "../../lib/http"

type AnnouncementRow = {
  id: string
  year: number
  title: string
  body: string
  priority: "normal" | "important"
  publishedAt: number
  expiresAt: number | null
  authorDisplayName: string
}

function announcementJson(row: AnnouncementRow) {
  return {
    ...row,
    publishedAt: toIso(row.publishedAt),
    expiresAt: row.expiresAt === null ? null : toIso(row.expiresAt),
  }
}

function getYearParam(value: string): number | null {
  return parseYear(value)
}

export const yearAnnouncementsApp = new Hono<ApiEnv>()

yearAnnouncementsApp.get("/:year/announcements", async (c) => {
  const year = getYearParam(c.req.param("year"))
  if (year === null) {
    return apiError(c, 404, "YEAR_NOT_FOUND", "Operating year not found")
  }
  if (!(await canAccessYear(c.env, c.get("member"), year))) {
    return apiError(c, 403, "FORBIDDEN", "Active year membership is required")
  }
  const now = Date.now()
  const announcements = await c.env.shift_app
    .prepare(
      `SELECT announcement.id, announcement.year, announcement.title,
              announcement.body, announcement.priority,
              announcement.published_at AS publishedAt,
              announcement.expires_at AS expiresAt,
              member.display_name AS authorDisplayName
       FROM announcements announcement
       JOIN members member ON member.id = announcement.created_by
       WHERE announcement.year = ? AND announcement.status = 'published'
         AND announcement.published_at <= ?
         AND (announcement.expires_at IS NULL OR announcement.expires_at > ?)
       ORDER BY announcement.priority = 'important' DESC,
                announcement.published_at DESC
       LIMIT 200`
    )
    .bind(year, now, now)
    .all<AnnouncementRow>()
  return c.json({
    announcements: announcements.results.map(announcementJson),
  })
})

yearAnnouncementsApp.post("/:year/announcements", async (c) => {
  const year = getYearParam(c.req.param("year"))
  if (year === null) {
    return apiError(c, 404, "YEAR_NOT_FOUND", "Operating year not found")
  }
  const actor = c.get("member")
  if (!(await canManageShifts(c.env, actor, year))) {
    return apiError(
      c,
      403,
      "FORBIDDEN",
      "Shift management permission is required"
    )
  }
  const input = v.safeParse(
    createAnnouncementInputSchema,
    await readJson(c.req.raw)
  )
  if (!input.success) {
    return apiError(
      c,
      422,
      "INVALID_ANNOUNCEMENT",
      input.issues[0]?.message ?? "Invalid announcement"
    )
  }
  const id = crypto.randomUUID()
  const now = Date.now()
  const expiresAt = input.output.expiresAt
    ? Date.parse(input.output.expiresAt)
    : null
  if (expiresAt !== null && expiresAt <= now) {
    return apiError(
      c,
      422,
      "INVALID_EXPIRATION",
      "Expiration must be in the future"
    )
  }
  const result = await c.env.shift_app
    .prepare(
      `INSERT INTO announcements
        (id, year, title, body, priority, status, published_at, expires_at,
         created_by, archived_by, archived_at, created_at, updated_at)
       SELECT ?, year, ?, ?, ?, 'published', ?, ?, ?, NULL, NULL, ?, ?
       FROM operating_years WHERE year = ? AND status <> 'archived'`
    )
    .bind(
      id,
      input.output.title,
      input.output.body,
      input.output.priority,
      now,
      expiresAt,
      actor.id,
      now,
      now,
      year
    )
    .run()
  if (result.meta.changes !== 1) {
    return apiError(
      c,
      409,
      "YEAR_NOT_EDITABLE",
      "Operating year is archived or missing"
    )
  }
  return c.json(
    {
      announcement: {
        id,
        year,
        title: input.output.title,
        body: input.output.body,
        priority: input.output.priority,
        publishedAt: toIso(now),
        expiresAt: expiresAt === null ? null : toIso(expiresAt),
        authorDisplayName: actor.displayName,
      },
    },
    201
  )
})

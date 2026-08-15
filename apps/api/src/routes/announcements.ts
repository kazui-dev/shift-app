import { Hono } from "hono"
import { z } from "zod"

import { operatingYearSchema } from "@workspace/shared/shifts"

import {
  apiError,
  type ApiEnv,
  canAccessYear,
  canManageShifts,
  toIso,
} from "../http"

const idSchema = z.string().uuid()

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

export const announcementsApp = new Hono<ApiEnv>()

announcementsApp.get("/", async (c) => {
  const parsedYear = operatingYearSchema.safeParse(c.req.query("year"))
  if (!parsedYear.success) {
    return apiError(c, 422, "INVALID_YEAR", "A valid year is required")
  }
  if (!(await canAccessYear(c.env, c.get("member"), parsedYear.data))) {
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
    .bind(parsedYear.data, now, now)
    .all<AnnouncementRow>()
  return c.json({
    announcements: announcements.results.map(announcementJson),
  })
})

announcementsApp.delete("/:announcementId", async (c) => {
  const id = idSchema.safeParse(c.req.param("announcementId"))
  if (!id.success) {
    return apiError(c, 404, "ANNOUNCEMENT_NOT_FOUND", "Announcement not found")
  }
  const announcement = await c.env.shift_app
    .prepare("SELECT year, status FROM announcements WHERE id = ?")
    .bind(id.data)
    .first<{ year: number; status: "published" | "archived" }>()
  if (!announcement) {
    return apiError(c, 404, "ANNOUNCEMENT_NOT_FOUND", "Announcement not found")
  }
  const actor = c.get("member")
  if (!(await canManageShifts(c.env, actor, announcement.year))) {
    return apiError(
      c,
      403,
      "FORBIDDEN",
      "Shift management permission is required"
    )
  }
  if (announcement.status === "archived") {
    return c.body(null, 204)
  }
  const now = Date.now()
  await c.env.shift_app
    .prepare(
      `UPDATE announcements
       SET status = 'archived', archived_by = ?, archived_at = ?, updated_at = ?
       WHERE id = ? AND status = 'published'`
    )
    .bind(actor.id, now, now, id.data)
    .run()
  return c.body(null, 204)
})

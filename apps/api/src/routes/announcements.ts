import { Hono } from "hono"
import * as v from "valibot"

import { apiError, type ApiEnv, canManageShifts } from "../lib/http"

const idSchema = v.pipe(v.string(), v.uuid())

export const announcementsApp = new Hono<ApiEnv>()

announcementsApp.delete("/:announcementId", async (c) => {
  const id = v.safeParse(idSchema, c.req.param("announcementId"))
  if (!id.success) {
    return apiError(c, 404, "ANNOUNCEMENT_NOT_FOUND", "Announcement not found")
  }
  const announcement = await c.env.shift_app
    .prepare("SELECT year, status FROM announcements WHERE id = ?")
    .bind(id.output)
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
    .bind(actor.id, now, now, id.output)
    .run()
  return c.body(null, 204)
})

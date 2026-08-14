import { Hono } from "hono"
import { z } from "zod"

import { apiError, type ApiEnv, canManageShifts } from "../http"

const idSchema = z.string().uuid()

type AssignmentRow = {
  id: string
  year: number
  yearStatus: "draft" | "active" | "archived"
  status: "active" | "cancelled"
}

export const assignmentsApp = new Hono<ApiEnv>()

assignmentsApp.delete("/:assignmentId", async (c) => {
  const id = idSchema.safeParse(c.req.param("assignmentId"))
  if (!id.success) {
    return apiError(c, 404, "ASSIGNMENT_NOT_FOUND", "Assignment not found")
  }

  const assignment = await c.env.shift_app
    .prepare(
      `SELECT assignment.id, activity.year, operating_year.status AS yearStatus,
              assignment.status
       FROM shift_assignments assignment
       JOIN activities activity ON activity.id = assignment.activity_id
       JOIN operating_years operating_year ON operating_year.year = activity.year
       WHERE assignment.id = ?`
    )
    .bind(id.data)
    .first<AssignmentRow>()
  if (!assignment) {
    return apiError(c, 404, "ASSIGNMENT_NOT_FOUND", "Assignment not found")
  }

  const actor = c.get("member")
  if (!(await canManageShifts(c.env, actor, assignment.year))) {
    return apiError(
      c,
      403,
      "FORBIDDEN",
      "Shift management permission is required"
    )
  }
  if (assignment.status === "cancelled") {
    return c.body(null, 204)
  }
  if (assignment.yearStatus === "archived") {
    return apiError(c, 409, "YEAR_NOT_EDITABLE", "Operating year is archived")
  }
  const now = Date.now()
  await c.env.shift_app
    .prepare(
      `UPDATE shift_assignments
       SET status = 'cancelled', cancelled_by = ?, cancelled_at = ?, updated_at = ?
       WHERE id = ? AND status = 'active'`
    )
    .bind(actor.id, now, now, assignment.id)
    .run()
  return c.body(null, 204)
})

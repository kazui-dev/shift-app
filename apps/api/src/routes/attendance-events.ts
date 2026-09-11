import { Hono } from "hono"
import { apiError, type ApiEnv, toIso } from "../lib/http"
import { canManageActivity } from "../services/activity-access"
export const attendanceEventsApp = new Hono<ApiEnv>()
attendanceEventsApp.get("/:assignmentId/attendance/events", async (c) => {
  const id = c.req.param("assignmentId")
  const assignment = await c.env.shift_app
    .prepare(
      "SELECT a.member_id AS memberId, act.id AS activityId, act.year FROM shift_assignments a JOIN shift_slots s ON s.id=a.slot_id JOIN activities act ON act.id=s.activity_id WHERE a.id=?"
    )
    .bind(id)
    .first<{ memberId: string; activityId: string; year: number }>()
  if (!assignment)
    return apiError(c, 404, "ASSIGNMENT_NOT_FOUND", "シフトが見つかりません")
  const member = c.get("member")
  if (
    member.id !== assignment.memberId &&
    !(await canManageActivity(
      c.env,
      member,
      assignment.activityId,
      assignment.year
    ))
  )
    return apiError(c, 403, "FORBIDDEN", "本人または責任者のみ確認できます")
  const events = await c.env.shift_app
    .prepare(
      'SELECT e.id,e."before",e."after",e.reason,e.created_at AS createdAt,m.display_name AS actor FROM attendance_events e JOIN app_users m ON m.id=e.actor_id WHERE e.assignment_id=? ORDER BY e.created_at DESC'
    )
    .bind(id)
    .all<{
      id: string
      before: number | null
      after: number
      reason: string
      createdAt: number
      actor: string
    }>()
  return c.json({
    events: events.results.map((event) => ({
      ...event,
      before: event.before === null ? null : toIso(event.before),
      after: toIso(event.after),
      createdAt: toIso(event.createdAt),
    })),
  })
})

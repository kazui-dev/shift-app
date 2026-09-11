import { Hono } from "hono"
import * as v from "valibot"
import { apiError, type ApiEnv, readJson } from "../lib/http"
import { canEditActivity } from "../services/activity-access"
import { canManageYear } from "../services/role-authority"
import { readActivityEditor } from "../services/activity-editor"
import { sendMemberNotification } from "../services/push"
export const activityActionsApp = new Hono<ApiEnv>()
activityActionsApp.use("/:activityId/*", async (c, next) => {
  const activity = await c.env.shift_app
    .prepare("SELECT year FROM activities WHERE id=?")
    .bind(c.req.param("activityId"))
    .first<{ year: number }>()
  if (!activity)
    return apiError(c, 404, "ACTIVITY_NOT_FOUND", "シフトが見つかりません")
  if (
    !(await canEditActivity(
      c.env,
      c.get("member"),
      c.req.param("activityId"),
      activity.year
    ))
  )
    return apiError(c, 403, "FORBIDDEN", "責任者の権限が必要です")
  return next()
})
activityActionsApp.post("/:activityId/copies", async (c) => {
  const input = v.safeParse(
    v.object({ date: v.pipe(v.string(), v.isoDate()) }),
    await readJson(c.req.raw)
  )
  if (!input.success)
    return apiError(c, 422, "INVALID_DATE", "日付を指定してください")
  const old = await readActivityEditor(
    c.env.shift_app,
    c.req.param("activityId")
  )
  if (!old)
    return apiError(c, 404, "ACTIVITY_NOT_FOUND", "シフトが見つかりません")
  const actor = c.get("member")
  if (
    !(await canManageYear(
      c.env.shift_app,
      actor,
      old.activity.year,
      "shift.create"
    )) &&
    !(await canManageYear(
      c.env.shift_app,
      actor,
      old.activity.year,
      "shift.manage"
    ))
  )
    return apiError(c, 403, "FORBIDDEN", "シフト作成権限が必要です")
  const id = crypto.randomUUID(),
    now = Date.now()
  const date = new Date(Date.parse(old.activity.startsAt) + 9 * 3600000)
    .toISOString()
    .slice(0, 10)
  const delta =
    Date.parse(`${input.output.date}T00:00:00+09:00`) -
    Date.parse(`${date}T00:00:00+09:00`)
  await c.env.shift_app.batch([
    c.env.shift_app
      .prepare(`INSERT INTO activities (id,year,name,place,activity_type,starts_at,ends_at,color,notes,created_by,updated_by,created_at,updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`)
      .bind(
        id,
        old.activity.year,
        old.activity.name,
        old.activity.place,
        old.activity.activityType,
        Date.parse(old.activity.startsAt) + delta,
        Date.parse(old.activity.endsAt) + delta,
        old.activity.color,
        old.activity.notes,
        actor.id,
        actor.id,
        now,
        now
      ),
    ...old.responsibles.map((r) =>
      c.env.shift_app
        .prepare("INSERT INTO activity_responsibles VALUES (?,?,?)")
        .bind(id, r.targetType, r.targetId)
    ),
    ...old.candidateRoleIds.map((roleId) =>
      c.env.shift_app
        .prepare("INSERT INTO activity_candidate_roles VALUES (?,?)")
        .bind(id, roleId)
    ),
    ...old.slots.map((slot) =>
      c.env.shift_app
        .prepare(
          "INSERT INTO shift_slots (id,activity_id,starts_at,ends_at,capacity) VALUES (?,?,?,?,?)"
        )
        .bind(
          crypto.randomUUID(),
          id,
          Date.parse(slot.startsAt) + delta,
          Date.parse(slot.endsAt) + delta,
          slot.capacity
        )
    ),
  ])
  return c.json({ id }, 201)
})
activityActionsApp.post("/:activityId/notifications", async (c) => {
  const id = c.req.param("activityId")
  const activity = await c.env.shift_app
    .prepare("SELECT name,version,active FROM activities WHERE id=?")
    .bind(id)
    .first<{ name: string; version: number; active: number }>()
  if (!activity || !activity.active)
    return apiError(c, 409, "SHIFT_INACTIVE", "有効なシフトで通知できます")
  const now = Date.now()
  const recipients = await c.env.shift_app
    .prepare(`SELECT DISTINCT a.member_id AS memberId FROM shift_assignments a JOIN shift_slots s ON s.id=a.slot_id
    JOIN activities activity ON activity.id=s.activity_id JOIN year_memberships ym ON ym.year=activity.year AND ym.member_id=a.member_id AND ym.status='active'
    WHERE s.activity_id=? AND (a.status='active' OR a.updated_at>COALESCE((SELECT MAX(created_at) FROM activity_notifications WHERE activity_id=? AND status='sent'),0))`)
    .bind(id, id)
    .all<{ memberId: string }>()
  const deliveries = await Promise.all(
    recipients.results.map(async ({ memberId }) => {
      const claim = await c.env.shift_app
        .prepare(`INSERT INTO activity_notifications (activity_id,member_id,version,status,created_at) VALUES (?,?,?,'pending',?)
      ON CONFLICT(activity_id,member_id,version) DO UPDATE SET created_at=excluded.created_at WHERE activity_notifications.status='pending' AND activity_notifications.created_at<? RETURNING member_id`)
        .bind(id, memberId, activity.version, now, now - 60000)
        .all()
      if (!claim.results.length) return true
      const sent = await sendMemberNotification(
        c.env,
        memberId,
        "シフトが更新されました",
        activity.name,
        "/calendar",
        `shift-${id}`
      )
      if (sent)
        await c.env.shift_app
          .prepare(
            "UPDATE activity_notifications SET status='sent' WHERE activity_id=? AND member_id=? AND version=?"
          )
          .bind(id, memberId, activity.version)
          .run()
      else {
        await c.env.shift_app
          .prepare(
            "DELETE FROM activity_notifications WHERE activity_id=? AND member_id=? AND version=? AND status='pending'"
          )
          .bind(id, memberId, activity.version)
          .run()
      }
      return sent
    })
  )
  if (deliveries.some((sent) => !sent))
    return apiError(
      c,
      500,
      "NOTIFICATION_RETRY",
      "一部の通知を送れませんでした。もう一度お試しください"
    )
  return c.body(null, 204)
})

import { Hono } from "hono"
import * as v from "valibot"
import type { ShiftCoworker } from "@workspace/shared/shifts"
import { apiError, errors } from "../../../../lib/errors"
import { type ApiEnv, toIso } from "../../../../lib/http"

export const meCoworkersApp = new Hono<ApiEnv>()

meCoworkersApp.get("/assignments/:assignmentId/coworkers", async (c) => {
  const id = v.safeParse(
    v.pipe(v.string(), v.uuid()),
    c.req.param("assignmentId")
  )
  if (!id.success) return apiError(c, errors.assignmentNotFound)
  const actor = c.get("member")
  const own = await c.env.shift_app
    .prepare(`SELECT s.activity_id AS activityId,
    s.starts_at AS startsAt,s.ends_at AS endsAt,a.year
    FROM shift_assignments p JOIN shift_slots s ON s.id=p.slot_id
    JOIN activities a ON a.id=s.activity_id
    JOIN year_memberships ym ON ym.member_id=p.member_id AND ym.year=a.year AND ym.status='active'
    WHERE p.id=? AND p.member_id=? AND p.status='active' AND s.deleted=0 AND a.active=1`)
    .bind(id.output, actor.id)
    .first<{
      activityId: string
      startsAt: number
      endsAt: number
      year: number
    }>()
  if (!own) return apiError(c, errors.assignmentNotFound)

  const rows = await c.env.shift_app
    .prepare(`SELECT * FROM (
    SELECT p.id,s.activity_id AS activityId,p.member_id AS memberId,
      m.display_name AS name,m.student_id AS studentId,s.starts_at AS startsAt,s.ends_at AS endsAt,
      att.state,att.check_in_status AS checkInStatus,att.expected_at AS expectedAt
    FROM shift_slots s JOIN shift_assignments p ON p.slot_id=s.id AND p.status='active'
    JOIN app_users m ON m.id=p.member_id
    JOIN year_memberships ym ON ym.member_id=m.id AND ym.year=? AND ym.status='active'
    LEFT JOIN assignment_attendance att ON att.assignment_id=p.id
    WHERE s.activity_id=? AND s.deleted=0 AND s.starts_at<? AND s.ends_at>? AND p.member_id<>?
    UNION ALL
    SELECT p.id,s.activity_id AS activityId,submission.id AS memberId,
      directory.display_name AS name,directory.student_id AS studentId,s.starts_at AS startsAt,s.ends_at AS endsAt,
      att.state,att.check_in_status AS checkInStatus,att.expected_at AS expectedAt
    FROM shift_slots s JOIN directory_shift_assignments p ON p.slot_id=s.id
    JOIN student_directory directory ON directory.id=p.entry_id AND directory.status='active' AND directory.year=?
    JOIN directory_availability_submissions submission ON submission.entry_id=directory.id
    LEFT JOIN assignment_attendance att ON att.assignment_id=p.id
    WHERE s.activity_id=? AND s.deleted=0 AND s.starts_at<? AND s.ends_at>?
    ) ORDER BY startsAt,endsAt,studentId,id`)
    .bind(
      own.year,
      own.activityId,
      own.endsAt,
      own.startsAt,
      actor.id,
      own.year,
      own.activityId,
      own.endsAt,
      own.startsAt
    )
    .all<{
      id: string
      activityId: string
      memberId: string
      name: string
      studentId: string
      startsAt: number
      endsAt: number
      state: "present" | "late" | "absent" | null
      checkInStatus: "pending" | "confirmed" | null
      expectedAt: number | null
    }>()
  const members: ShiftCoworker[] = rows.results.map(
    ({ state, checkInStatus, expectedAt, ...row }) => ({
      ...row,
      startsAt: toIso(row.startsAt),
      endsAt: toIso(row.endsAt),
      attendance:
        state === null
          ? null
          : {
              state,
              checkInStatus,
              expectedAt: expectedAt === null ? null : toIso(expectedAt),
            },
    })
  )
  c.header("Cache-Control", "private, no-store")
  return c.json({ members })
})

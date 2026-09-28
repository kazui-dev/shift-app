import { toIso } from "../../../lib/http"

export async function listAttendanceEvents(
  db: D1Database,
  assignmentId: string
) {
  const events = await db
    .prepare(`SELECT e.id, m.display_name AS actor, e.action, e.expected_at AS expectedAt,
    e.checked_in_at AS checkedInAt, e.previous_checked_in_at AS previousCheckedInAt, e.reason,
    e.created_at AS createdAt
    FROM assignment_attendance_events e JOIN app_users m ON m.id = e.actor_id
    WHERE e.assignment_id = ? ORDER BY e.created_at DESC, e.id`)
    .bind(assignmentId)
    .all<{
      id: string
      actor: string
      action:
        | "late"
        | "absent"
        | "withdrawn"
        | "checked_in"
        | "corrected"
        | "resolved"
      expectedAt: number | null
      checkedInAt: number | null
      previousCheckedInAt: number | null
      reason: string
      createdAt: number
    }>()
  const iso = (value: number | null) => (value === null ? null : toIso(value))
  return events.results.map((event) => ({
    ...event,
    expectedAt: iso(event.expectedAt),
    checkedInAt: iso(event.checkedInAt),
    previousCheckedInAt: iso(event.previousCheckedInAt),
    createdAt: toIso(event.createdAt),
  }))
}

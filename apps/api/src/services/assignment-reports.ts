import { toIso } from "../lib/http"
import { sendMemberNotification } from "./push"

export const reportSelection = `SELECT r.id, r.assignment_id AS assignmentId, r.member_id AS memberId,
  m.display_name AS memberDisplayName, r.kind, r.message, r.status, r.eta,
  activity.id AS activityId, activity.name AS activityName, activity.year,
  s.starts_at AS startsAt, s.ends_at AS endsAt, r.created_at AS createdAt,
  r.updated_at AS updatedAt, r.resolved_at AS resolvedAt
  FROM assignment_reports r JOIN shift_assignments a ON a.id = r.assignment_id
  JOIN shift_slots s ON s.id = a.slot_id JOIN activities activity ON activity.id = s.activity_id
  JOIN app_users m ON m.id = r.member_id`
export type ReportRow = {
  id: string
  assignmentId: string
  memberId: string
  memberDisplayName: string
  kind: "late" | "absence"
  message: string
  status: "open" | "resolved" | "withdrawn"
  eta: number | null
  activityId: string
  activityName: string
  year: number
  startsAt: number
  endsAt: number
  createdAt: number
  updatedAt: number
  resolvedAt: number | null
}
export function reportJson(row: ReportRow) {
  return {
    ...row,
    startsAt: toIso(row.startsAt),
    endsAt: toIso(row.endsAt),
    createdAt: toIso(row.createdAt),
    updatedAt: toIso(row.updatedAt),
    eta: row.eta === null ? null : toIso(row.eta),
    resolvedAt: row.resolvedAt === null ? null : toIso(row.resolvedAt),
  }
}
export async function notifyReport(env: CloudflareBindings, report: ReportRow) {
  const recipients = await env.shift_app
    .prepare(`SELECT DISTINCT m.id FROM app_users m
    WHERE m.id <> ? AND (m.access_level = 'system_admin' OR EXISTS (
      SELECT 1 FROM year_memberships ym WHERE ym.member_id = m.id AND ym.year = ? AND ym.status = 'active'
      AND (EXISTS (SELECT 1 FROM activity_responsibles r WHERE r.activity_id = ?
        AND ((r.target_type = 'member' AND r.target_id = m.id) OR (r.target_type = 'role' AND EXISTS (SELECT 1 FROM member_year_roles mr WHERE mr.role_id = r.target_id AND mr.member_id = m.id))))
      OR EXISTS (SELECT 1 FROM member_year_roles mr JOIN year_role_permissions p ON p.role_id = mr.role_id JOIN year_roles role ON role.id = mr.role_id
        WHERE mr.member_id = m.id AND role.year = ym.year AND p.permission = 'shift.manage'))))`)
    .bind(report.memberId, report.year, report.activityId)
    .all<{ id: string }>()
  await Promise.all(
    recipients.results.map(({ id }) =>
      sendMemberNotification(
        env,
        id,
        `${report.activityName}の遅刻・欠勤連絡`,
        `${report.memberDisplayName}さんから連絡がありました。`,
        `/manage/shifts/${report.activityId}`,
        `report-${report.id}`
      )
    )
  )
}

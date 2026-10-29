import type {
  ActivityEditorInput,
  AssignmentOverwriteReview,
} from "@workspace/shared/shifts"
import type { MemberContext } from "../../../lib/http"
import { canEditActivity } from "../../activities/services/activity-access"
import { remainingAssignment } from "../domain/assignment-overwrite"

type Existing = {
  assignmentId: string
  slotId: string
  activityId: string
  activityName: string
  version: number
  memberId: string
  entryId: string | null
  startsAt: number
  endsAt: number
  capacity: number | null
  notes: string | null
  createdBy: string
  createdAt: number
}
export async function reviewAssignmentOverwrite(
  env: CloudflareBindings,
  actor: MemberContext,
  id: string,
  year: number,
  input: ActivityEditorInput,
  members: { id: string; displayName: string }[]
) {
  const memberIds = [...new Set(input.slots.flatMap((slot) => slot.memberIds))]
  const rows = memberIds.length
    ? await env.shift_app
        .prepare(`
    SELECT a.id AS assignmentId,s.id AS slotId,act.id AS activityId,act.name AS activityName,act.version,a.member_id AS memberId,NULL AS entryId,
      s.starts_at AS startsAt,s.ends_at AS endsAt,s.capacity,a.notes,a.created_by AS createdBy,a.created_at AS createdAt
    FROM shift_assignments a JOIN shift_slots s ON s.id=a.slot_id JOIN activities act ON act.id=s.activity_id
    WHERE a.status='active' AND s.deleted=0 AND act.id<>?1 AND act.year=?2 AND a.member_id IN (SELECT value FROM json_each(?3))
    UNION ALL
    SELECT a.id,s.id,act.id,act.name,act.version,survey.id,a.entry_id,s.starts_at,s.ends_at,s.capacity,NULL,a.created_by,a.created_at
    FROM directory_shift_assignments a JOIN shift_slots s ON s.id=a.slot_id JOIN activities act ON act.id=s.activity_id
      JOIN student_directory directory ON directory.id=a.entry_id AND directory.status='active'
      JOIN directory_availability_submissions survey ON survey.entry_id=a.entry_id
    WHERE s.deleted=0 AND act.id<>?1 AND act.year=?2 AND survey.id IN (SELECT value FROM json_each(?3))
    ORDER BY activityId,assignmentId`)
        .bind(id, year, JSON.stringify(memberIds))
        .all<Existing>()
    : { results: [] }
  const affected = rows.results.flatMap((row) => {
    const original = {
      startsAt: new Date(row.startsAt).toISOString(),
      endsAt: new Date(row.endsAt).toISOString(),
    }
    const remaining = remainingAssignment(
      original,
      input.slots.filter((slot) => slot.memberIds.includes(row.memberId))
    )
    if (
      remaining.length === 1 &&
      remaining[0]?.startsAt === original.startsAt &&
      remaining[0]?.endsAt === original.endsAt
    )
      return []
    return [{ ...row, remaining }]
  })
  const ids = [...new Set(affected.map((row) => row.activityId))]
  const access = await Promise.all(
    ids.map(async (activityId) => ({
      activityId,
      allowed: await canEditActivity(env, actor, activityId, year),
    }))
  )
  const existingSlots = ids.length
    ? await env.shift_app
        .prepare(
          "SELECT activity_id AS activityId,id,starts_at AS startsAt,ends_at AS endsAt,(SELECT COUNT(*) FROM shift_assignments a WHERE a.slot_id=shift_slots.id AND a.status='active')+(SELECT COUNT(*) FROM directory_shift_assignments a WHERE a.slot_id=shift_slots.id) AS assignmentCount FROM shift_slots WHERE deleted=0 AND activity_id IN (SELECT value FROM json_each(?))"
        )
        .bind(JSON.stringify(ids))
        .all<{
          activityId: string
          id: string
          startsAt: number
          endsAt: number
          assignmentCount: number
        }>()
    : { results: [] }
  const excessive = new Set(
    ids.filter((activityId) => {
      const slots = existingSlots.results.filter(
        (slot) => slot.activityId === activityId
      )
      const added = new Set(
        affected
          .filter((row) => row.activityId === activityId)
          .flatMap((row) => row.remaining)
          .filter(
            (piece) =>
              !slots.some(
                (slot) =>
                  slot.startsAt === Date.parse(piece.startsAt) &&
                  slot.endsAt === Date.parse(piece.endsAt)
              )
          )
          .map((piece) => `${piece.startsAt}:${piece.endsAt}`)
      )
      const removed = slots.filter((slot) => {
        const replaced = affected.filter((row) => row.slotId === slot.id).length
        return replaced > 0 && replaced === slot.assignmentCount
      }).length
      return slots.length + added.size - removed > 200
    })
  )
  const changes: AssignmentOverwriteReview["changes"] = affected.map((row) => ({
    assignmentId: row.assignmentId,
    activityId: row.activityId,
    activityName: row.activityName,
    memberId: row.memberId,
    memberName:
      members.find((member) => member.id === row.memberId)?.displayName ??
      "メンバー",
    startsAt: new Date(row.startsAt).toISOString(),
    endsAt: new Date(row.endsAt).toISOString(),
    remaining: row.remaining,
    blockedReason: !access.find((item) => item.activityId === row.activityId)
      ?.allowed
      ? "このシフトを変更する権限がありません。"
      : excessive.has(row.activityId)
        ? "分割後の勤務枠が上限の200件を超えます。"
        : null,
  }))
  const hash = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(
      JSON.stringify({ actor: actor.id, id, input, affected })
    )
  )
  const token = Array.from(new Uint8Array(hash), (value) =>
    value.toString(16).padStart(2, "0")
  ).join("")
  return { token, changes, affected, existingSlots: existingSlots.results }
}

export function overwriteStatements(
  db: D1Database,
  actor: string,
  targetId: string,
  review: Awaited<ReturnType<typeof reviewAssignmentOverwrite>>
) {
  const statements: D1PreparedStatement[] = [],
    now = Date.now()
  const ids = [...new Set(review.affected.map((row) => row.activityId))]
  for (const id of ids) {
    const rows = review.affected.filter((row) => row.activityId === id),
      row = rows[0]
    if (!row) continue
    // A stale shift or changed allocation aborts the entire batch; attendance stays on its original assignment.
    statements.push(
      db
        .prepare(`INSERT INTO activity_history(id,activity_id,actor_id,"before","after",created_at)
      SELECT ?,?,?,CASE WHEN EXISTS(SELECT 1 FROM activities WHERE id=? AND version=?) AND NOT EXISTS(
        SELECT 1 FROM json_each(?) j WHERE
          (json_extract(j.value,'$.entryId') IS NULL AND NOT EXISTS(SELECT 1 FROM shift_assignments a JOIN shift_slots s ON s.id=a.slot_id WHERE a.id=json_extract(j.value,'$.assignmentId') AND a.slot_id=json_extract(j.value,'$.slotId') AND a.member_id=json_extract(j.value,'$.memberId') AND a.status='active' AND s.deleted=0 AND s.starts_at=json_extract(j.value,'$.startsAt') AND s.ends_at=json_extract(j.value,'$.endsAt')))
          OR (json_extract(j.value,'$.entryId') IS NOT NULL AND NOT EXISTS(SELECT 1 FROM directory_shift_assignments a JOIN shift_slots s ON s.id=a.slot_id WHERE a.id=json_extract(j.value,'$.assignmentId') AND a.slot_id=json_extract(j.value,'$.slotId') AND a.entry_id=json_extract(j.value,'$.entryId') AND s.deleted=0 AND s.starts_at=json_extract(j.value,'$.startsAt') AND s.ends_at=json_extract(j.value,'$.endsAt')))
      ) THEN ? ELSE NULL END,?,?`)
        .bind(
          crypto.randomUUID(),
          id,
          actor,
          id,
          row.version,
          JSON.stringify(rows),
          JSON.stringify(rows),
          JSON.stringify({
            operation: "assignment-overwrite",
            targetId,
            changes: review.changes.filter(
              (change) => change.activityId === id
            ),
          }),
          now
        )
    )
  }
  for (const row of review.affected)
    statements.push(
      row.entryId === null
        ? db
            .prepare(
              "UPDATE shift_assignments SET status='cancelled',cancelled_by=?,cancelled_at=?,updated_at=? WHERE id=? AND status='active'"
            )
            .bind(actor, now, now, row.assignmentId)
        : db
            .prepare("DELETE FROM directory_shift_assignments WHERE id=?")
            .bind(row.assignmentId)
    )
  const slots = [...review.existingSlots]
  for (const row of review.affected) {
    row.remaining.forEach((piece, index) => {
      const from = Date.parse(piece.startsAt),
        to = Date.parse(piece.endsAt)
      let slot = slots.find(
        (item) =>
          item.activityId === row.activityId &&
          item.startsAt === from &&
          item.endsAt === to
      )
      if (!slot) {
        slot = {
          id: crypto.randomUUID(),
          activityId: row.activityId,
          startsAt: from,
          endsAt: to,
          assignmentCount: 0,
        }
        slots.push(slot)
        statements.push(
          db
            .prepare(
              "INSERT INTO shift_slots(id,activity_id,starts_at,ends_at,capacity,deleted) VALUES(?,?,?,?,?,0)"
            )
            .bind(slot.id, row.activityId, from, to, row.capacity)
        )
      }
      if (row.entryId !== null)
        statements.push(
          db
            .prepare(
              "INSERT INTO directory_shift_assignments(id,slot_id,entry_id,created_by,created_at,updated_at) VALUES(?,?,?,?,?,?)"
            )
            .bind(
              index === 0 ? row.assignmentId : crypto.randomUUID(),
              slot.id,
              row.entryId,
              index === 0 ? row.createdBy : actor,
              index === 0 ? row.createdAt : now,
              now
            )
        )
      else if (index === 0)
        statements.push(
          db
            .prepare(
              "UPDATE shift_assignments SET slot_id=?,status='active',cancelled_by=NULL,cancelled_at=NULL,updated_at=? WHERE id=?"
            )
            .bind(slot.id, now, row.assignmentId)
        )
      else
        statements.push(
          db
            .prepare(
              "INSERT INTO shift_assignments(id,slot_id,member_id,notes,status,created_by,created_at,updated_at) VALUES(?,?,?,?,'active',?,?,?)"
            )
            .bind(
              crypto.randomUUID(),
              slot.id,
              row.memberId,
              row.notes,
              actor,
              now,
              now
            )
        )
    })
  }
  for (const id of ids)
    statements.push(
      db
        .prepare(
          "UPDATE shift_slots SET deleted=1 WHERE activity_id=? AND id IN (SELECT value FROM json_each(?)) AND NOT EXISTS(SELECT 1 FROM shift_assignments a WHERE a.slot_id=shift_slots.id AND a.status='active') AND NOT EXISTS(SELECT 1 FROM directory_shift_assignments a WHERE a.slot_id=shift_slots.id)"
        )
        .bind(
          id,
          JSON.stringify(
            review.affected
              .filter((row) => row.activityId === id)
              .map((row) => row.slotId)
          )
        ),
      db
        .prepare(
          "UPDATE activities SET version=version+1,updated_by=?,updated_at=? WHERE id=?"
        )
        .bind(actor, now, id)
    )
  return statements
}

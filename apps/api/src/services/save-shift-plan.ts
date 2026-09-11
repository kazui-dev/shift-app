import type { ActivityEditorInput } from "@workspace/shared/shifts"

export async function saveShiftPlan(
  db: D1Database,
  id: string,
  actor: string,
  input: ActivityEditorInput,
  before: unknown
) {
  const now = Date.now()
  const previous = await db
    .prepare(
      `SELECT a.id, a.slot_id AS slotId, a.member_id AS memberId FROM shift_assignments a JOIN shift_slots s ON s.id = a.slot_id WHERE s.activity_id = ? AND a.status = 'active'`
    )
    .bind(id)
    .all<{ id: string; slotId: string; memberId: string }>()
  const statements = [
    // NOT NULL makes a stale revision abort the entire D1 batch before any write.
    db
      .prepare(
        `INSERT INTO activity_history (id,activity_id,actor_id,"before","after",created_at) SELECT ?,id,?,CASE WHEN version = ? AND NOT EXISTS (SELECT 1 FROM json_each(?) j JOIN shift_slots slot ON slot.id=json_extract(j.value,'$.id') WHERE slot.activity_id<>activities.id) THEN ? ELSE NULL END,?,? FROM activities WHERE id = ?`
      )
      .bind(
        crypto.randomUUID(),
        actor,
        input.version,
        JSON.stringify(input.slots),
        JSON.stringify(before),
        JSON.stringify(input),
        now,
        id
      ),
    db
      .prepare(
        `UPDATE activities SET name=?,place=?,activity_type=?,starts_at=?,ends_at=?,color=?,notes=?,active=?,version=version+1,updated_by=?,updated_at=? WHERE id=?`
      )
      .bind(
        input.name,
        input.place,
        input.activityType,
        Date.parse(input.startsAt),
        Date.parse(input.endsAt),
        input.color,
        input.notes,
        0,
        actor,
        now,
        id
      ),
    db
      .prepare(
        `UPDATE shift_assignments SET status='cancelled',cancelled_by=?,cancelled_at=?,updated_at=? WHERE slot_id IN (SELECT id FROM shift_slots WHERE activity_id=?) AND status='active'`
      )
      .bind(actor, now, now, id),
    db.prepare("UPDATE shift_slots SET deleted=1 WHERE activity_id=?").bind(id),
    db
      .prepare("DELETE FROM activity_responsibles WHERE activity_id=?")
      .bind(id),
    db
      .prepare("DELETE FROM activity_candidate_roles WHERE activity_id=?")
      .bind(id),
    ...input.candidateRoleIds.map((roleId) =>
      db
        .prepare(
          "INSERT INTO activity_candidate_roles (activity_id,role_id) VALUES (?,?)"
        )
        .bind(id, roleId)
    ),
    ...input.responsibles.map((target) =>
      db
        .prepare(
          "INSERT OR IGNORE INTO activity_responsibles (activity_id,target_type,target_id) VALUES (?,?,?)"
        )
        .bind(id, target.targetType, target.targetId)
    ),
  ]
  for (const slot of input.slots) {
    statements.push(
      db
        .prepare(
          `INSERT INTO shift_slots (id,activity_id,starts_at,ends_at,capacity,deleted) VALUES (?,?,?,?,?,0) ON CONFLICT(id) DO UPDATE SET starts_at=excluded.starts_at,ends_at=excluded.ends_at,capacity=excluded.capacity,deleted=0 WHERE shift_slots.activity_id=excluded.activity_id`
        )
        .bind(
          slot.id,
          id,
          Date.parse(slot.startsAt),
          Date.parse(slot.endsAt),
          slot.capacity
        )
    )
    for (const memberId of slot.memberIds) {
      const existing = previous.results.find(
        (item) => item.slotId === slot.id && item.memberId === memberId
      )
      if (existing)
        statements.push(
          db
            .prepare(
              "UPDATE shift_assignments SET status='active',cancelled_by=NULL,cancelled_at=NULL,updated_at=? WHERE id=?"
            )
            .bind(now, existing.id)
        )
      else
        statements.push(
          db
            .prepare(
              "INSERT INTO shift_assignments (id,slot_id,member_id,status,created_by,created_at,updated_at) VALUES (?,?,?,'active',?,?,?)"
            )
            .bind(crypto.randomUUID(), slot.id, memberId, actor, now, now)
        )
    }
  }
  statements.push(
    db
      .prepare("UPDATE activities SET active=? WHERE id=?")
      .bind(input.active ? 1 : 0, id)
  )
  await db.batch(statements)
}

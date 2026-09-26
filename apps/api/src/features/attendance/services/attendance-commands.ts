/** Writes one attendance change and its event in a D1 batch. */
export async function recordCheckIn(
  db: D1Database,
  assignmentId: string,
  memberId: string,
  locationConfirmed: boolean
) {
  const now = Date.now()
  const [result] = await db.batch([
    db
      .prepare(`INSERT INTO assignment_attendance
        (assignment_id, member_id, state, expected_at, reason, checked_in_at, check_in_status, created_at, updated_at)
        VALUES (?, ?, 'present', NULL, '', ?, ?, ?, ?)
        ON CONFLICT(assignment_id) DO UPDATE SET state = 'present', checked_in_at = excluded.checked_in_at,
        check_in_status = excluded.check_in_status, updated_at = MAX(excluded.updated_at, assignment_attendance.updated_at + 1)
        WHERE assignment_attendance.state <> 'present'`)
      .bind(
        assignmentId,
        memberId,
        now,
        locationConfirmed ? "confirmed" : "pending",
        now,
        now
      ),
    db
      .prepare(`INSERT INTO assignment_attendance_events (id, assignment_id, actor_id, action, checked_in_at, created_at)
        SELECT ?, ?, ?, 'checked_in', ?, ? WHERE changes() > 0`)
      .bind(crypto.randomUUID(), assignmentId, memberId, now, now),
  ])
  return Boolean(result)
}

export async function recordReport(
  db: D1Database,
  assignmentId: string,
  memberId: string,
  state: "late" | "absent",
  expectedAt: number | null,
  reason: string
) {
  const now = Date.now()
  const [result] = await db.batch([
    db
      .prepare(`INSERT INTO assignment_attendance
      (assignment_id, member_id, state, expected_at, reason, checked_in_at, check_in_status, resolved_by, resolved_at, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, NULL, NULL, NULL, NULL, ?, ?)
      ON CONFLICT(assignment_id) DO UPDATE SET state = excluded.state, expected_at = excluded.expected_at,
      reason = excluded.reason, resolved_by = NULL, resolved_at = NULL,
      updated_at = MAX(excluded.updated_at, assignment_attendance.updated_at + 1)
      WHERE assignment_attendance.state <> 'present'`)
      .bind(assignmentId, memberId, state, expectedAt, reason, now, now),
    db
      .prepare(`INSERT INTO assignment_attendance_events (id, assignment_id, actor_id, action, expected_at, reason, created_at)
      SELECT ?, ?, ?, ?, ?, ?, ? WHERE changes() > 0`)
      .bind(
        crypto.randomUUID(),
        assignmentId,
        memberId,
        state,
        expectedAt,
        reason,
        now
      ),
  ])
  return Boolean(result && result.meta.changes > 0)
}

export async function withdrawReport(
  db: D1Database,
  assignmentId: string,
  memberId: string
) {
  const now = Date.now()
  const [result] = await db.batch([
    db
      .prepare(
        "DELETE FROM assignment_attendance WHERE assignment_id = ? AND member_id = ? AND state IN ('late', 'absent')"
      )
      .bind(assignmentId, memberId),
    db
      .prepare(`INSERT INTO assignment_attendance_events (id, assignment_id, actor_id, action, created_at)
      SELECT ?, ?, ?, 'withdrawn', ? WHERE changes() > 0`)
      .bind(crypto.randomUUID(), assignmentId, memberId, now),
  ])
  return Boolean(result && result.meta.changes > 0)
}

export async function resolveReport(
  db: D1Database,
  assignmentId: string,
  actorId: string
) {
  const now = Date.now()
  const [result] = await db.batch([
    db
      .prepare(`UPDATE assignment_attendance SET resolved_by = ?, resolved_at = ?, updated_at = MAX(?, updated_at + 1)
        WHERE assignment_id = ? AND state IN ('late', 'absent') AND resolved_at IS NULL`)
      .bind(actorId, now, now, assignmentId),
    db
      .prepare(`INSERT INTO assignment_attendance_events (id, assignment_id, actor_id, action, created_at)
        SELECT ?, ?, ?, 'resolved', ? WHERE changes() > 0`)
      .bind(crypto.randomUUID(), assignmentId, actorId, now),
  ])
  return Boolean(result && result.meta.changes > 0)
}

export async function correctCheckIn(
  db: D1Database,
  assignmentId: string,
  memberId: string,
  actorId: string,
  checkedInAt: string,
  reason: string
) {
  const now = Date.now()
  const at = Date.parse(checkedInAt)
  await db.batch([
    db
      .prepare(`INSERT INTO assignment_attendance_events (id, assignment_id, actor_id, action, checked_in_at, previous_checked_in_at, reason, created_at)
      VALUES (?, ?, ?, 'corrected', ?, (SELECT checked_in_at FROM assignment_attendance WHERE assignment_id = ?), ?, ?)`)
      .bind(
        crypto.randomUUID(),
        assignmentId,
        actorId,
        at,
        assignmentId,
        reason,
        now
      ),
    db
      .prepare(`INSERT INTO assignment_attendance
      (assignment_id, member_id, state, expected_at, reason, checked_in_at, check_in_status, created_at, updated_at)
      VALUES (?, ?, 'present', NULL, '', ?, 'confirmed', ?, ?)
      ON CONFLICT(assignment_id) DO UPDATE SET state = 'present', checked_in_at = excluded.checked_in_at,
      check_in_status = 'confirmed', updated_at = MAX(excluded.updated_at, assignment_attendance.updated_at + 1)`)
      .bind(assignmentId, memberId, at, now, now),
  ])
}

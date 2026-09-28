import type { DatabaseSync } from "node:sqlite"

/** Work assigned to a participant, independent of whether they can sign in. */
export function participantWork(db: DatabaseSync, memberId: string) {
  db.prepare(`INSERT INTO activities
    (id,year,name,place,activity_type,starts_at,ends_at,color,created_by,updated_by,created_at,updated_at)
    VALUES ('work',2026,'受付','本館','shift',1000,2000,'#000000',?,?,0,0)`).run(
    memberId,
    memberId
  )
  db.exec(
    `INSERT INTO shift_slots (id,activity_id,starts_at,ends_at) VALUES ('slot','work',1000,2000);`
  )
  db.prepare(`INSERT INTO shift_assignments
    (id,slot_id,member_id,created_by,created_at,updated_at)
    VALUES ('assignment','slot',?,?,0,0)`).run(memberId, memberId)
  db.exec(`INSERT INTO availability_dates (id,year,date,starts_minute,ends_minute,created_at,updated_at)
    VALUES ('day',2026,'2026-10-31',510,1200,0,0);`)
  db.prepare(`INSERT INTO availability_submissions
    (id,year,member_id,status,submitted_at,created_at,updated_at)
    VALUES ('submission',2026,?,'submitted',0,0,0)`).run(memberId)
  db.exec(`INSERT INTO availability_day_answers VALUES ('submission','day',1,'all');
    INSERT INTO availability_windows VALUES ('window','submission','day',1793403000000,1793444400000,0);`)
}

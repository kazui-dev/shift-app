import type { DatabaseSync } from "node:sqlite"

/** Survey data belongs to the directory entry, before any member or identity exists. */
export function directoryWork(db: DatabaseSync, entryId: string) {
  db.exec(`INSERT INTO availability_dates (id,year,date,starts_minute,ends_minute,created_at,updated_at)
    VALUES ('day',2026,'2026-10-31',510,1200,0,0);`)
  db.prepare(
    `INSERT INTO directory_availability_submissions VALUES ('submission',?,0,0,0)`
  ).run(entryId)
  db.exec(`INSERT INTO directory_availability_day_answers VALUES ('submission','day',1,'all');
    INSERT INTO directory_availability_windows VALUES ('window','submission','day',1793403000000,1793444400000,0);`)
}

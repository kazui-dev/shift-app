import { expect, it } from "vite-plus/test"
import { applyMigration, migrated } from "../support/sqlite"

it("retains each year's existing tag name order and assignments during migration", () => {
  const db = migrated(53)
  try {
    db.exec(`INSERT INTO operating_years VALUES (2026,0,0),(2027,0,0);
      INSERT INTO year_tags VALUES ('z',2026,'Z',0,0),('a',2026,'A',0,0),('other',2027,'B',0,0);
      INSERT INTO user (id,name,email) VALUES ('u','Test','test@example.test');
      INSERT INTO app_users VALUES ('member','u','Test','26EC1','member',0,0);
      INSERT INTO member_year_tags VALUES ('member','z',0);`)
    applyMigration(db, "0053_nasty_omega_sentinel.sql")
    expect(
      db
        .prepare("SELECT id, position FROM year_tags ORDER BY year, position")
        .all()
    ).toEqual([
      { id: "a", position: 0 },
      { id: "z", position: 1 },
      { id: "other", position: 0 },
    ])
    expect(
      db.prepare("SELECT member_id, tag_id FROM member_year_tags").all()
    ).toEqual([{ member_id: "member", tag_id: "z" }])
  } finally {
    db.close()
  }
})

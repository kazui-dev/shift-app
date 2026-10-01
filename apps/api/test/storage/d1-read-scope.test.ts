import {
  memberPermissions,
  memberRoomPermissions,
  roomPermissions,
} from "../../src/features/chat/services/chat-permissions"
import { expect, it } from "vite-plus/test"
import { migrated, applyMigration } from "../support/sqlite"
import {
  planningAvailability,
  planningMemberRoles,
} from "../../src/features/directory/services/planning-inputs"
import { roleSelection } from "../../src/features/roles/services/role-list"

function fixture() {
  const db = migrated(48)
  db.exec(`INSERT INTO operating_years VALUES (2026,0,0),(2027,0,0);
    INSERT INTO user (id,name,email) VALUES ('u1','One','one@example.test'),('u2','Two','two@example.test');
    INSERT INTO app_users VALUES ('m1','u1','One','1','member',0,0),('m2','u2','Two','2','member',0,0);
    INSERT INTO year_roles (id,year,name,color,created_at,updated_at) VALUES ('r1',2026,'Role','#000',0,0),('r2',2027,'Other','#000',0,0);
    INSERT INTO member_year_roles VALUES ('m1','r1',0),('m2','r1',0);
    INSERT INTO activities (id,year,name,place,activity_type,starts_at,ends_at,color,created_by,updated_by,created_at,updated_at)
    VALUES ('direct',2026,'Direct','','shift',100,200,'#000','m1','m1',0,0),('role',2026,'Role','','shift',100,200,'#000','m1','m1',0,0),('both',2026,'Both','','shift',100,200,'#000','m1','m1',0,0);
    INSERT INTO activity_responsibles VALUES ('direct','member','m1'),('role','role','r1'),('both','member','m1'),('both','role','r1');
    UPDATE activities SET active=1;`)
  return db
}

it("preserves distinct responsible grants and role counts, excluding inactive and other-year holders", () => {
  const db = fixture()
  try {
    db.exec(
      "INSERT INTO activity_responsibles VALUES ('both','role','r2'); INSERT INTO member_year_roles VALUES ('m1','r2',0)"
    )
    const before = db
      .prepare(
        "SELECT * FROM activity_effective_responsibles ORDER BY activity_id,member_id"
      )
      .all()
    applyMigration(db, "0049_responsible_read_scope.sql")
    expect(
      db
        .prepare(
          "SELECT * FROM activity_effective_responsibles ORDER BY activity_id,member_id"
        )
        .all()
    ).toEqual(before)
    expect(db.prepare(roleSelection).all(2026)).toMatchObject([
      { id: "r1", memberCount: 2 },
    ])
    db.exec(
      "UPDATE year_memberships SET status='inactive' WHERE member_id='m2'"
    )
    expect(db.prepare(roleSelection).all(2026)).toMatchObject([
      { id: "r1", memberCount: 1 },
    ])
    expect(
      db
        .prepare(
          "SELECT DISTINCT member_id FROM activity_effective_responsibles"
        )
        .all()
    ).toEqual([{ member_id: "m1" }])
    const plan = db
      .prepare(`EXPLAIN QUERY PLAN ${roleSelection}`)
      .all(2026)
      .map((r) => String(r.detail))
    expect(
      plan.some((s) =>
        s.includes(
          "SEARCH membership USING INDEX member_year_roles_role_idx (role_id=?)"
        )
      )
    ).toBe(true)
    expect(db.prepare("PRAGMA foreign_key_check").all()).toEqual([])
  } finally {
    db.close()
  }
})

it.each([
  [
    "UPDATE year_memberships SET status='inactive' WHERE member_id='m1'",
    ["direct"],
  ],
  ["DELETE FROM year_memberships WHERE member_id='m1'", ["direct"]],
  ["DELETE FROM activity_responsibles WHERE activity_id='direct'", ["direct"]],
  [
    "UPDATE activity_responsibles SET target_id='nobody' WHERE activity_id='direct'",
    ["direct"],
  ],
  ["DELETE FROM member_year_roles WHERE role_id='r1'", ["role"]],
  ["UPDATE member_year_roles SET role_id='r2' WHERE role_id='r1'", ["role"]],
  ["DELETE FROM year_roles WHERE id='r1'", ["role"]],
  ["UPDATE year_roles SET year=2027 WHERE id='r1'", ["role"]],
])(
  "still deactivates only activities that lose their last responsible: %s",
  (sql, inactive) => {
    const db = fixture()
    try {
      applyMigration(db, "0049_responsible_read_scope.sql")
      db.exec(sql)
      expect(
        db
          .prepare("SELECT id FROM activities WHERE active=0 ORDER BY id")
          .all()
          .map((r) => r.id)
      ).toEqual(inactive)
      expect(db.prepare("PRAGMA foreign_key_check").all()).toEqual([])
    } finally {
      db.close()
    }
  }
)

it("does not invalidate activities for timestamps, role names/order, or redundant active membership updates", () => {
  const db = fixture()
  try {
    applyMigration(db, "0049_responsible_read_scope.sql")
    const before = db
      .prepare("SELECT id,active,version FROM activities ORDER BY id")
      .all()
    db.exec(
      "UPDATE year_memberships SET updated_at=99,status='active'; UPDATE year_roles SET name=name||'!',position=position+1,updated_at=99; UPDATE member_year_roles SET created_at=99"
    )
    expect(
      db.prepare("SELECT id,active,version FROM activities ORDER BY id").all()
    ).toEqual(before)
  } finally {
    db.close()
  }
})

it("pairs windows with their own source and keeps zero-window submitted members", () => {
  const db = fixture()
  try {
    db.exec(`INSERT INTO student_directory (id,year,student_id,display_name,created_at) VALUES ('entry',2026,'3','Three',0),('outside',2027,'4','Four',0),('hidden',2026,'5','Hidden',0);
      UPDATE student_directory SET status='inactive' WHERE id='hidden';
      INSERT INTO directory_availability_submissions (id,entry_id,submitted_at,created_at,updated_at) VALUES ('same','entry',1,0,0),('other','outside',1,0,0),('hidden-sub','hidden',1,0,0);
      INSERT INTO availability_dates (id,year,date,starts_minute,ends_minute,created_at,updated_at) VALUES ('date',2026,'2026-10-01',0,1440,0,0);
      INSERT INTO availability_submissions (id,year,member_id,status,created_at,updated_at) VALUES ('same',2026,'m1','submitted',0,0),('empty',2026,'m2','submitted',0,0);
      INSERT INTO availability_windows VALUES ('real','same','date',100,200,0);
      INSERT INTO directory_availability_windows VALUES ('directory','same','date',300,400,0);`)
    // IDs are unique within each source. Equal IDs across the two tables must
    // never attach the other source's window to a member.
    expect(db.prepare(planningAvailability).all(2026)).toEqual([
      { memberId: "m1", startsAt: 100, endsAt: 200 },
      { memberId: "m2", startsAt: null, endsAt: null },
      { memberId: "same", startsAt: 300, endsAt: 400 },
    ])
  } finally {
    db.close()
  }
})

it("deduplicates directory bureau/duty roles inside the selected year", () => {
  const db = fixture()
  try {
    db.exec(`INSERT INTO bureaus VALUES ('bureau',2026,'Bureau','r1',0);
      INSERT INTO duties VALUES ('duty','bureau','Duty','r1',0);
      INSERT INTO student_directory (id,year,student_id,display_name,bureau_id,created_at) VALUES ('entry',2026,'3','Three','bureau',0),('outside',2027,'4','Four','bureau',0);
      INSERT INTO directory_duties VALUES ('entry','duty');
      INSERT INTO directory_availability_submissions (id,entry_id,created_at,updated_at) VALUES ('directory','entry',0,0),('outside-sub','outside',0,0);`)
    expect(
      db
        .prepare(planningMemberRoles)
        .all(2026)
        .map((r) => [r.memberId, r.id])
    ).toEqual([
      ["directory", "r1"],
      ["m1", "r1"],
      ["m2", "r1"],
    ])
  } finally {
    db.close()
  }
})

it("keeps single-room and audience permission results equal to full member grants", () => {
  const db = fixture()
  try {
    applyMigration(db, "0049_responsible_read_scope.sql")
    db.exec(`INSERT INTO year_role_permissions VALUES ('r1','shift.manage',0);`)
    const targets = [
      ["member", "m1"],
      ["role", "r1"],
      ["year", "2026"],
      ["access_level", "member"],
      ["permission", "shift.manage"],
      ["responsible", "role"],
      ["activity", "direct"],
    ]
    for (const [index, [type, id]] of targets.entries()) {
      db.prepare(
        "INSERT INTO chat_rooms (id,year,name,created_by,created_at,updated_at) VALUES (?,2026,'Room','m1',0,0)"
      ).run(`room${index}`)
      db.prepare(
        "INSERT INTO chat_room_targets (room_id,target_type,target_id,can_read,can_post,can_manage,created_at) VALUES (?,?,?,1,1,0,0)"
      ).run(`room${index}`, type ?? "", id ?? "")
    }
    const rooms = targets.map((_, index) => `room${index}`)
    const verify = () => {
      for (const member of ["m1", "m2", "missing"]) {
        const all = db
          .prepare(`${memberPermissions} SELECT * FROM chat_permissions`)
          .all(member)
        for (const room of rooms) {
          const expected = all.filter((r) => r.room_id === room)
          expect(
            db
              .prepare(
                `${memberRoomPermissions} SELECT * FROM chat_permissions`
              )
              .all(member, room)
          ).toEqual(expected)
          expect(
            db
              .prepare(
                `${roomPermissions} SELECT * FROM chat_permissions WHERE member_id=?`
              )
              .all(room, member)
          ).toEqual(expected)
        }
      }
    }
    verify()
    db.exec(
      "INSERT INTO chat_room_exits VALUES ('room1','m1',0); UPDATE year_memberships SET status='inactive' WHERE member_id='m2'"
    )
    verify()
  } finally {
    db.close()
  }
})

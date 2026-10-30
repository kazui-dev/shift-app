import { Hono } from "hono"
import * as v from "valibot"
import { expect, it } from "vite-plus/test"
import { shiftCoworkersResponseSchema } from "@workspace/shared/shifts"
import { meCoworkersApp } from "../../src/features/assignments/routes/me/coworkers"
import type { ApiEnv } from "../../src/lib/http"
import { d1Binding, migrated } from "../support/sqlite"

const id = (n: number) =>
  `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`
const hour = (n: number) =>
  Date.parse(`2025-11-01T${String(n).padStart(2, "0")}:00:00+09:00`)

it("authorizes an active own assignment and exposes only overlapping members' public attendance fields", async () => {
  const db = migrated()
  try {
    db.exec("INSERT INTO operating_years VALUES (2026,0,0)")
    for (let n = 1; n <= 9; n++) {
      db.prepare("INSERT INTO user(id,name,email) VALUES (?,?,?)").run(
        id(n),
        `Member ${n}`,
        `${n}@example.test`
      )
      db.prepare("INSERT INTO app_users VALUES (?,?,?,?,?,0,0)").run(
        id(n),
        id(n),
        `Member ${n}`,
        `26EC00${n}`,
        "member"
      )
      db.prepare(
        "INSERT OR IGNORE INTO year_memberships(year,member_id,status,created_at,updated_at) VALUES (2026,?,'active',0,0)"
      ).run(id(n))
    }
    for (const n of [20, 21]) {
      db.prepare(
        "INSERT INTO activities(id,year,name,place,activity_type,starts_at,ends_at,color,created_by,updated_by,created_at,updated_at) VALUES (?,2026,'受付','','shift',?,?,'#64748B',?,?,0,0)"
      ).run(id(n), hour(8), hour(16), id(1), id(1))
      db.prepare("INSERT INTO activity_responsibles VALUES (?,'member',?)").run(
        id(n),
        id(9)
      )
    }
    db.exec("UPDATE activities SET active=1")
    const add = (
      n: number,
      member: number,
      start: number,
      end: number,
      activity = 20
    ) => {
      db.prepare(
        "INSERT INTO shift_slots(id,activity_id,starts_at,ends_at) VALUES (?,?,?,?)"
      ).run(id(n + 100), id(activity), hour(start), hour(end))
      db.prepare(
        "INSERT INTO shift_assignments(id,slot_id,member_id,status,created_by,created_at,updated_at) VALUES (?,?,?,'active',?,0,0)"
      ).run(id(n), id(n + 100), id(member), id(1))
    }
    add(30, 1, 9, 13)
    add(31, 2, 8, 10)
    add(32, 2, 11, 14)
    add(33, 3, 10, 12)
    add(34, 4, 8, 9)
    add(35, 5, 13, 15)
    add(36, 6, 10, 12, 21)
    add(37, 7, 10, 12)
    add(38, 8, 10, 12)
    db.prepare(
      "UPDATE shift_assignments SET status='cancelled' WHERE id=?"
    ).run(id(37))
    db.prepare(
      "UPDATE year_memberships SET status='inactive' WHERE member_id=?"
    ).run(id(8))
    db.prepare(
      "INSERT INTO assignment_attendance(assignment_id,member_id,state,reason,expected_at,created_at,updated_at) VALUES (?,?,'late','private reason',?,0,0)"
    ).run(id(32), id(2), hour(12))
    db.prepare(
      "INSERT INTO assignment_attendance(assignment_id,member_id,state,reason,created_at,updated_at) VALUES (?,?,'absent','private reason',0,0)"
    ).run(id(33), id(3))
    db.prepare(
      "INSERT INTO student_directory(id,year,student_id,display_name,created_at) VALUES (?,2026,'26EC999','Directory member',0)"
    ).run(id(50))
    db.prepare(
      "INSERT INTO directory_availability_submissions(id,entry_id,created_at,updated_at) VALUES (?,?,0,0)"
    ).run(id(51), id(50))
    db.prepare(
      "INSERT INTO directory_shift_assignments(id,slot_id,entry_id,created_by,created_at,updated_at) VALUES (?,?,?,?,0,0)"
    ).run(id(52), id(133), id(50), id(1))
    const app = new Hono<ApiEnv>()
    app.use("*", async (c, next) => {
      const actor = c.req.header("test-actor") ?? id(1)
      c.set("member", {
        id: actor,
        userId: actor,
        displayName: "Member",
        accessLevel: "member",
      })
      await next()
    })
    app.route("/", meCoworkersApp)
    const read = (assignment = id(30), actor = id(1)) =>
      app.request(
        `http://localhost/assignments/${assignment}/coworkers`,
        { headers: { "test-actor": actor } },
        { shift_app: d1Binding(db) }
      )
    const response = await read()
    expect(response.status).toBe(200)
    expect(response.headers.get("cache-control")).toBe("private, no-store")
    const raw: unknown = await response.json()
    expect(JSON.stringify(raw)).not.toContain("reason")
    const { members } = v.parse(shiftCoworkersResponseSchema, raw)
    expect(members.map((m) => m.id)).toEqual([id(31), id(33), id(52), id(32)])
    expect(members.find((m) => m.id === id(32))).toMatchObject({
      studentId: "26EC002",
      endsAt: new Date(hour(14)).toISOString(),
      attendance: {
        state: "late",
        expectedAt: new Date(hour(12)).toISOString(),
      },
    })
    expect(members.find((m) => m.id === id(52))).toMatchObject({
      name: "Directory member",
      studentId: "26EC999",
      attendance: null,
    })
    expect((await read("invalid")).status).toBe(404)
    expect((await read(id(999))).status).toBe(404)
    expect((await read(id(30), id(9))).status).toBe(404)
    expect((await read(id(37), id(7))).status).toBe(404)
    expect((await read(id(38), id(8))).status).toBe(404)
    db.prepare("UPDATE shift_slots SET deleted=1 WHERE id=?").run(id(133))
    const afterDelete = v.parse(
      shiftCoworkersResponseSchema,
      await (await read()).json()
    )
    expect(afterDelete.members.map((m) => m.id)).toEqual([id(31), id(32)])
    db.prepare("UPDATE activities SET active=0 WHERE id=?").run(id(20))
    expect((await read()).status).toBe(404)
  } finally {
    db.close()
  }
})

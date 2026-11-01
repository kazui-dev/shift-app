import { Hono } from "hono"
import * as v from "valibot"
import { expect, it } from "vite-plus/test"
import { shiftAttendanceResponseSchema } from "@workspace/shared/shifts"
import { activityAttendanceApp } from "../../src/features/activities/routes/activity-attendance"
import type { ApiEnv } from "../../src/lib/http"
import { d1Binding, migrated } from "../support/sqlite"

it("returns student IDs and current-year duties only for visible attendance", async () => {
  const db = migrated()
  try {
    db.exec(`INSERT INTO operating_years VALUES (2026,0,0),(2027,0,0);
      INSERT INTO user(id,name,email) VALUES ('a','Admin','a@example.test'),('m','Member','m@example.test'),('o','Other','o@example.test');
      INSERT INTO app_users VALUES ('a','a','Admin','26AJ001','system_admin',0,0),('m','m','Member','26AJ002','member',0,0),('o','o','Other','26AJ003','member',0,0);
      INSERT OR IGNORE INTO year_memberships(year,member_id,status,created_at,updated_at) VALUES (2026,'m','active',0,0),(2026,'o','active',0,0);
      INSERT INTO year_roles(id,year,name,color,position,created_at,updated_at) VALUES ('bureau',2026,'広報局','#000000',3,0,0),('web',2026,'Web','#000000',2,0,0),('desk',2026,'受付','#000000',1,0,0),('outside',2027,'翌年度担当','#000000',1,0,0);
      INSERT INTO bureaus VALUES ('b',2026,'広報局','bureau',0),('b2',2027,'翌年度局',NULL,0);
      INSERT INTO duties VALUES ('d1','b','Web','web',0),('d2','b','受付','desk',0),('d3','b2','翌年度担当','outside',0);
      INSERT INTO member_year_roles VALUES ('m','bureau',0),('m','web',0),('m','desk',0),('m','outside',0);
      INSERT INTO activities(id,year,name,place,activity_type,starts_at,ends_at,color,created_by,updated_by,created_at,updated_at) VALUES ('activity',2026,'受付','','shift',0,3600000,'#000000','a','a',0,0);
      INSERT INTO shift_slots VALUES ('s','activity',0,3600000,NULL,0);
      INSERT INTO shift_assignments(id,slot_id,member_id,status,created_by,created_at,updated_at) VALUES ('am','s','m','active','a',0,0),('ao','s','o','active','a',0,0);`)
    const app = new Hono<ApiEnv>()
    app.use("*", async (c, next) => {
      const id = c.req.header("test-actor") ?? "m"
      c.set("member", {
        id,
        userId: id,
        displayName: id,
        accessLevel: id === "a" ? "system_admin" : "member",
      })
      await next()
    })
    app.route("/", activityAttendanceApp)
    const read = async (actor: string) => {
      const response = await app.request(
        "http://localhost/activity/attendance",
        { headers: { "test-actor": actor } },
        { shift_app: d1Binding(db) }
      )
      expect(response.status).toBe(200)
      return v.parse(shiftAttendanceResponseSchema, await response.json())
    }
    db.exec(`
      INSERT INTO user(id,name,email) VALUES ('x','Elsewhere','x@example.test');
      INSERT INTO app_users VALUES ('x','x','Elsewhere','26AJ004','member',0,0);
      INSERT OR IGNORE INTO year_memberships(year,member_id,status,created_at,updated_at) VALUES (2026,'x','active',0,0),(2027,'x','active',0,0);
      INSERT INTO activities(id,year,name,place,activity_type,starts_at,ends_at,color,created_by,updated_by,created_at,updated_at) VALUES ('other',2026,'別シフト','','shift',0,7200000,'#000000','a','a',0,0),('outside',2027,'翌年度','','shift',0,3600000,'#000000','a','a',0,0);
      INSERT INTO student_directory(id,year,student_id,display_name,status,created_at) VALUES ('entry',2026,'26AJ005','未登録','active',0);
      INSERT INTO directory_availability_submissions(id,entry_id,created_at,updated_at) VALUES ('submission','entry',0,0);
      INSERT INTO directory_shift_assignments VALUES ('directory-assignment','s','entry','a',0,0);
    `)
    for (const [i, state] of [
      "late",
      "absent",
      "present",
      "unrecorded",
      "cancelled",
      "deleted",
      "after",
      "outside",
    ].entries()) {
      const startsAt = state === "after" ? 3600000 : i * 1000
      db.prepare("INSERT INTO shift_slots VALUES (?,?,?,?,NULL,0)").run(
        state,
        state === "outside" ? "outside" : "other",
        startsAt,
        startsAt + 1000
      )
      db.prepare(
        "INSERT INTO shift_assignments(id,slot_id,member_id,status,created_by,created_at,updated_at) VALUES (?,?,'x',?,'a',0,0)"
      ).run(state, state, state === "cancelled" ? "cancelled" : "active")
      if (["late", "absent", "present", "cancelled", "deleted"].includes(state))
        db.prepare(
          "INSERT INTO assignment_attendance(assignment_id,member_id,state,reason,check_in_status,resolved_at,created_at,updated_at) VALUES (?,'x',?,'非公開の理由',?,?,0,0)"
        ).run(
          state,
          state === "cancelled" || state === "deleted" ? "late" : state,
          state === "present" ? "pending" : null,
          state === "absent" ? 500 : null
        )
      if (state === "deleted")
        db.prepare("UPDATE shift_slots SET deleted=1 WHERE id=?").run(state)
    }
    const own = await read("m")
    expect(own.timelineAssignments).toEqual([])
    expect(own.assignments).toHaveLength(1)
    expect(own.assignments[0]).toMatchObject({
      memberId: "m",
      memberStudentId: "26AJ002",
      memberDuties: ["Web", "受付"],
    })
    const admin = await read("a")
    expect(admin.assignments).toHaveLength(2)
    expect(admin.assignments.find((a) => a.memberId === "o")).toMatchObject({
      memberStudentId: "26AJ003",
      memberDuties: [],
    })
    expect(admin.timelineAssignments?.map((item) => item.id).sort()).toEqual(
      [
        "am",
        "ao",
        "directory-assignment",
        "late",
        "absent",
        "present",
        "unrecorded",
      ].sort()
    )
    expect(
      admin.timelineAssignments?.find((item) => item.id === "absent")
        ?.attendance
    ).toMatchObject({
      state: "absent",
      resolvedAt: new Date(500).toISOString(),
    })
    expect(
      admin.timelineAssignments?.find((item) => item.id === "present")
        ?.attendance?.checkInStatus
    ).toBe("pending")
    expect(
      admin.timelineAssignments?.find(
        (item) => item.id === "directory-assignment"
      )
    ).toMatchObject({ memberId: "submission", attendance: null })
    expect(JSON.stringify(admin.timelineAssignments)).not.toContain(
      "非公開の理由"
    )
    db.exec(
      "INSERT INTO activity_responsibles VALUES ('activity','member','o')"
    )
    expect((await read("o")).timelineAssignments).toEqual(
      admin.timelineAssignments
    )
    db.exec(
      "UPDATE assignment_attendance SET state='present',check_in_status='confirmed' WHERE assignment_id='late'"
    )
    expect(
      (await read("a")).timelineAssignments?.find((item) => item.id === "late")
        ?.attendance?.state
    ).toBe("present")
    db.exec("DELETE FROM assignment_attendance WHERE assignment_id='late'")
    expect(
      (await read("a")).timelineAssignments?.find((item) => item.id === "late")
        ?.attendance
    ).toBeNull()
    const legacy = own.assignments.map(
      ({ memberStudentId, memberDuties, ...assignment }) => {
        expect(memberStudentId).toBeTruthy()
        expect(memberDuties).toHaveLength(2)
        return assignment
      }
    )
    expect(
      v.parse(shiftAttendanceResponseSchema, { ...own, assignments: legacy })
        .assignments[0]
    ).toMatchObject({ memberStudentId: "", memberDuties: [] })
  } finally {
    db.close()
  }
})

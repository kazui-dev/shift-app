import { Hono } from "hono"
import { expect, it } from "vite-plus/test"
import * as v from "valibot"
import { shiftOverviewResponseSchema } from "@workspace/shared/shifts"
import { d1Binding, migrated } from "../support/sqlite"
import { shiftOverviewApp } from "../../src/features/shifts/routes/overview"
import type { ApiEnv } from "../../src/lib/http"

it("restricts the overview to the responsible's shifts and rejects ordinary members", async () => {
  const db = migrated()
  try {
    db.exec(`INSERT INTO operating_years VALUES (2026,0,0);
      INSERT INTO user (id,name,email) VALUES ('10000000-0000-4000-8000-000000000001','Admin','a@example.test'),('10000000-0000-4000-8000-000000000002','Lead','l@example.test'),('10000000-0000-4000-8000-000000000003','Staff','s@example.test');
      INSERT INTO app_users VALUES ('10000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','Admin','26AJ001','system_admin',0,0),('10000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000002','Lead','26AJ002','member',0,0),('10000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000003','Staff','26AJ003','member',0,0);
      INSERT OR IGNORE INTO year_memberships (year,member_id,status,created_at,updated_at) VALUES (2026,'10000000-0000-4000-8000-000000000001','active',0,0),(2026,'10000000-0000-4000-8000-000000000002','active',0,0),(2026,'10000000-0000-4000-8000-000000000003','active',0,0);`)
    db.exec(`INSERT INTO year_roles (id,year,name,color,position,created_at,updated_at) VALUES
      ('20000000-0000-4000-8000-000000000001',2026,'広報局','#000000',2,0,0),
      ('20000000-0000-4000-8000-000000000002',2026,'web班','#000000',1,0,0);
      INSERT INTO bureaus (id,year,name,role_id,created_at) VALUES ('bureau',2026,'広報局','20000000-0000-4000-8000-000000000001',0);
      INSERT INTO duties (id,bureau_id,name,role_id,created_at) VALUES ('duty','bureau','web班','20000000-0000-4000-8000-000000000002',0);
      INSERT INTO member_year_roles (member_id,role_id,created_at) VALUES
      ('10000000-0000-4000-8000-000000000003','20000000-0000-4000-8000-000000000001',0),
      ('10000000-0000-4000-8000-000000000003','20000000-0000-4000-8000-000000000002',0);`)
    const day = Date.parse("2026-10-29T00:00:00+09:00")
    const hour = 3_600_000
    for (const [id, from, to] of [
      ["own", day + 9 * hour, day + 12 * hour],
      ["other", day + 13 * hour, day + 15 * hour],
      ["overnight", day - hour, day + hour],
      ["yesterday", day - 2 * hour, day],
    ] as const) {
      db.prepare(
        `INSERT INTO activities (id,year,name,place,activity_type,starts_at,ends_at,color,created_by,updated_by,created_at,updated_at) VALUES (?,2026,?,'','shift',?,?,'#000000','10000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001',0,0)`
      ).run(id, id, from, to)
      db.prepare("INSERT INTO shift_slots VALUES (?,?,?, ?,NULL,0)").run(
        id,
        id,
        from,
        to
      )
      db.prepare(
        `INSERT INTO shift_assignments (id,slot_id,member_id,status,created_by,created_at,updated_at) VALUES (?,?,?,'active','10000000-0000-4000-8000-000000000001',0,0)`
      ).run(
        id,
        id,
        id === "yesterday"
          ? "10000000-0000-4000-8000-000000000002"
          : "10000000-0000-4000-8000-000000000003"
      )
    }
    db.exec(
      "INSERT INTO activity_responsibles VALUES ('own','member','10000000-0000-4000-8000-000000000002')"
    )
    const app = new Hono<ApiEnv>()
    app.use("*", async (c, next) => {
      const id =
        c.req.header("test-actor") ?? "10000000-0000-4000-8000-000000000003"
      c.set("member", {
        id,
        userId: id,
        displayName: id,
        accessLevel:
          id === "10000000-0000-4000-8000-000000000001"
            ? "system_admin"
            : "member",
      })
      await next()
    })
    app.route("/", shiftOverviewApp)
    const request = (actor: string, date = "2026-10-29") =>
      app.request(
        `http://localhost/2026/shift-overview?date=${date}`,
        { headers: { "test-actor": actor } },
        { shift_app: d1Binding(db) }
      )
    const lead = await request("10000000-0000-4000-8000-000000000002")
    expect(lead.status).toBe(200)
    const scoped = v.parse(shiftOverviewResponseSchema, await lead.json())
    expect(scoped.roles).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "広報局", duty: false }),
        expect.objectContaining({ name: "web班", duty: true }),
      ])
    )
    expect(scoped.canEdit).toBe(false)
    expect(scoped.activities.map((a) => a.id)).toEqual(["own"])
    expect(scoped.assignments.map((a) => a.id)).toEqual(["own"])
    expect(scoped.members.map((m) => m.id)).toEqual([
      "10000000-0000-4000-8000-000000000003",
    ])
    expect(scoped.availabilityAnswers).toEqual([])
    const admin = await request("10000000-0000-4000-8000-000000000001")
    const all = v.parse(shiftOverviewResponseSchema, await admin.json())
    expect(all.canEdit).toBe(true)
    expect(all.assignments.map((a) => a.id)).toEqual([
      "overnight",
      "own",
      "other",
    ])
    expect(all.members).toHaveLength(3)
    expect((await request("10000000-0000-4000-8000-000000000003")).status).toBe(
      403
    )
    expect(
      (await request("10000000-0000-4000-8000-000000000001", "2026-02-30"))
        .status
    ).toBe(422)
    db.exec(
      "UPDATE year_memberships SET status='left' WHERE member_id='10000000-0000-4000-8000-000000000002'"
    )
    expect((await request("10000000-0000-4000-8000-000000000002")).status).toBe(
      403
    )
  } finally {
    db.close()
  }
})

import * as v from "valibot"
import { yearMembershipEnvelopeSchema } from "@workspace/shared/shifts"
import { Hono } from "hono"
import { expect, it } from "vite-plus/test"
import { migrated, d1Binding } from "../support/sqlite"
import { adminCommandsApp } from "../../src/features/admin/routes/commands"
import { adminQueriesApp } from "../../src/features/admin/routes/queries"
import { memberRolesApp } from "../../src/features/roles/routes/years/member-roles"
import { rosterApp } from "../../src/features/members/routes/years/roster"
import { settingsApp } from "../../src/features/chat/routes/settings"
import { readableRoom, type RoomEnv } from "../../src/features/chat/routes/room"
import {
  memberRoom,
  roomCommands,
} from "../../src/features/chat/services/chat-creation"
import { activityActionsApp } from "../../src/features/activities/routes/activity-actions"
import { readActivityEditor } from "../../src/features/activities/services/activity-editor"
import type { ApiEnv } from "../../src/lib/http"
import { yearMembershipsApp } from "../../src/features/admin/routes/year-memberships"
const actor = "10000000-0000-4000-8000-000000000001"
const target = "10000000-0000-4000-8000-000000000002"
const role = "20000000-0000-4000-8000-000000000001"
const work = "30000000-0000-4000-8000-000000000001"
const context = {
  waitUntil: (_promise: Promise<unknown>) => {},
  passThroughOnException() {},
  props: {},
}
function fixture(accessLevel: "system_admin" | "member" = "system_admin") {
  const db = migrated()
  db.exec(`INSERT INTO operating_years VALUES (2026,0,0);
    INSERT INTO user (id,name,email) VALUES ('u','管理者','u@example.test'),('v','メンバー','v@example.test');
    INSERT INTO app_users VALUES ('${actor}','u','管理者','26AJ001','system_admin',0,0),('${target}','v','メンバー','26AJ002','member',0,0);
    INSERT OR IGNORE INTO year_memberships VALUES (2026,'${actor}','active',0,0),(2026,'${target}','active',0,0);
    INSERT INTO year_roles VALUES ('${role}',2026,'受付','#64748B',0,0,0);`)
  const app = new Hono<{
    Bindings: CloudflareBindings
    Variables: ApiEnv["Variables"] & {
      adminUser: { id: string; userId: string }
    }
  }>()
  app.use("*", async (c, next) => {
    c.set("member", {
      id: actor,
      userId: "u",
      displayName: "管理者",
      accessLevel,
    })
    c.set("adminUser", { id: actor, userId: "u" })
    await next()
  })
  app
    .route("/admin", adminCommandsApp)
    .route("/admin", adminQueriesApp)
    .route("/years", yearMembershipsApp)
    .route("/years", memberRolesApp)
    .route("/years", rosterApp)
    .route("/activities", activityActionsApp)
  const chat = new Hono<RoomEnv>()
  chat.use("/:roomId/*", readableRoom).route("/:roomId", settingsApp)
  app.route("/rooms", chat)
  const env = {
    shift_app: d1Binding(db),
    CHAT_DIRECTORY: {
      getByName: () => ({ broadcast: async () => {}, publish: async () => {} }),
    },
  }
  const request = (url: string, method = "GET", body?: unknown) =>
    app.request(
      url,
      { method, ...(body === undefined ? {} : { body: JSON.stringify(body) }) },
      env,
      context
    )
  return { db, env, request }
}
it("persists role additions/removals and system access across fresh reads", async () => {
  const { db, request } = fixture()
  try {
    expect(
      (
        await request("/years/2026/memberships", "PATCH", {
          memberIds: [target],
          addRoleIds: [role],
          removeRoleIds: [],
        })
      ).status
    ).toBe(204)
    expect(await (await request("/years/2026/roster")).json()).toMatchObject({
      members: expect.arrayContaining([
        expect.objectContaining({
          id: target,
          roles: expect.arrayContaining([
            expect.objectContaining({ id: role }),
          ]),
        }),
      ]),
    })
    expect(
      (
        await request(`/admin/users/${target}`, "PATCH", {
          accessLevel: "leader",
          reason: "検証",
        })
      ).status
    ).toBe(200)
    expect(await (await request("/admin/users")).json()).toMatchObject({
      users: expect.arrayContaining([
        expect.objectContaining({ id: target, accessLevel: "leader" }),
      ]),
    })
    expect(
      (
        await request("/years/2026/memberships", "PATCH", {
          memberIds: [target],
          addRoleIds: [],
          removeRoleIds: [role],
        })
      ).status
    ).toBe(204)
    expect(db.prepare("SELECT * FROM member_year_roles").all()).toEqual([])
  } finally {
    db.close()
  }
})
it("persists a chat permission while keeping an accessible manager", async () => {
  const { db, request } = fixture()
  try {
    const room = memberRoom(
      {
        year: 2026,
        name: "確認",
        targets: [{ targetType: "role", targetId: role }],
      },
      actor
    )
    for (const command of roomCommands(room, 0))
      db.prepare(command.sql).run(...command.params)
    const targets = room.targets.map((t) =>
      t.targetType === "role" ? { ...t, canPost: false } : t
    )
    expect(
      (
        await request(`/rooms/${room.id}/settings`, "PUT", {
          name: room.name,
          allowExit: true,
          targets,
        })
      ).status
    ).toBe(204)
    expect(
      await (await request(`/rooms/${room.id}/settings`)).json()
    ).toMatchObject({
      targets: expect.arrayContaining([
        {
          targetType: "role",
          targetId: role,
          canRead: true,
          canPost: false,
          canManage: false,
        },
      ]),
    })
  } finally {
    db.close()
  }
})
it("copies the requested time range and headcounts without assigned members", async () => {
  const { db, env, request } = fixture()
  try {
    const start = Date.parse("2026-11-01T00:00:00Z"),
      end = start + 9 * 3600000
    db.prepare(
      `INSERT INTO activities (id,year,name,place,activity_type,starts_at,ends_at,color,notes,created_by,updated_by,created_at,updated_at) VALUES (?,2026,'受付','入口','shift',?,?,'#123456','備考',?,?,0,0)`
    ).run(work, start, end, actor, actor)
    db.prepare("INSERT INTO activity_responsibles VALUES (?,'member',?)").run(
      work,
      actor
    )
    db.prepare("INSERT INTO activity_candidate_roles VALUES (?,?)").run(
      work,
      role
    )
    db.prepare("INSERT INTO shift_slots VALUES ('slot',?,?,?,4,0)").run(
      work,
      start,
      end
    )
    db.prepare("INSERT INTO shift_requirements VALUES ('req',?,?,?,3)").run(
      work,
      start,
      end
    )
    db.prepare(
      "INSERT INTO shift_assignments(id,slot_id,member_id,status,created_by,created_at,updated_at) VALUES ('assignment','slot',?,'active',?,0,0)"
    ).run(target, actor)
    const from = "2026-11-03T01:00:00.000Z",
      to = "2026-11-03T04:00:00.000Z"
    const response = await request(`/activities/${work}/copies`, "POST", {
      date: "2026-11-03",
      startsAt: from,
      endsAt: to,
    })
    expect(response.status).toBe(201)
    const copy = db.prepare("SELECT id FROM activities WHERE id<>?").get(work)
    if (typeof copy?.id !== "string") throw new Error("copy missing")
    const copyId = copy.id
    const app = new Hono<{ Bindings: CloudflareBindings }>()
    app.get("/", async (c) =>
      c.json(await readActivityEditor(c.env.shift_app, copyId))
    )
    expect(await (await app.request("/", {}, env)).json()).toMatchObject({
      activity: {
        name: "受付",
        place: "入口",
        color: "#123456",
        notes: "備考",
        startsAt: from,
        endsAt: to,
      },
      candidateRoleIds: [role],
      slots: [{ startsAt: from, endsAt: to, memberIds: [] }],
      requirements: [{ startsAt: from, endsAt: to, requiredCount: 3 }],
    })
    expect(
      (
        await request(`/activities/${work}/copies`, "POST", {
          date: "2026-11-03",
          startsAt: to,
          endsAt: from,
        })
      ).status
    ).toBe(422)
  } finally {
    db.close()
  }
})

it("limits year participation changes to system administrators while retaining member role editing", async () => {
  const { db, request } = fixture("member")
  try {
    db.exec(`UPDATE app_users SET access_level='member' WHERE id='${actor}';
      INSERT INTO year_roles VALUES ('20000000-0000-4000-8000-000000000002',2026,'管理者','#64748B',0,0,10);
      INSERT INTO year_role_permissions VALUES ('20000000-0000-4000-8000-000000000002','member.manage',0);
      INSERT INTO member_year_roles VALUES ('${actor}','20000000-0000-4000-8000-000000000002',0);`)
    expect((await request("/years/2026/memberships")).status).toBe(404)
    expect(
      (await request(`/years/2026/memberships/${target}`, "PUT")).status
    ).toBe(403)
    expect(
      (await request(`/years/2026/memberships/${target}`, "DELETE")).status
    ).toBe(403)
    expect(
      db
        .prepare("SELECT status FROM year_memberships WHERE member_id=?")
        .get(target)?.status
    ).toBe("active")
    expect(
      (
        await request("/years/2026/memberships", "PATCH", {
          memberIds: [target],
          addRoleIds: [role],
          removeRoleIds: [],
        })
      ).status
    ).toBe(204)
  } finally {
    db.close()
  }
})
it("preserves administrator participation changes for the user screen", async () => {
  const { db, request } = fixture()
  try {
    expect((await request("/years/2026/memberships")).status).toBe(404)
    expect(
      (await request(`/years/2026/memberships/${target}`, "DELETE")).status
    ).toBe(204)
    expect(
      db
        .prepare("SELECT status FROM year_memberships WHERE member_id=?")
        .get(target)?.status
    ).toBe("inactive")
    const joined = await request(`/years/2026/memberships/${target}`, "PUT")
    expect(joined.status).toBe(200)
    expect(
      v.safeParse(yearMembershipEnvelopeSchema, await joined.json()).success
    ).toBe(true)
    expect(
      db
        .prepare("SELECT status FROM year_memberships WHERE member_id=?")
        .get(target)?.status
    ).toBe("active")
  } finally {
    db.close()
  }
})

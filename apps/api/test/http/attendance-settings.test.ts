import { Hono } from "hono"
import { expect, it } from "vite-plus/test"
import { attendanceSettingsApp } from "../../src/features/attendance/routes/settings"
import type { ApiEnv } from "../../src/lib/http"
import { d1Binding, migrated } from "../support/sqlite"

const actor = "10000000-0000-4000-8000-000000000001",
  member = "10000000-0000-4000-8000-000000000002",
  role = "20000000-0000-4000-8000-000000000001",
  foreign = "20000000-0000-4000-8000-000000000002"
function fixture() {
  const db = migrated()
  db.exec(`INSERT INTO operating_years VALUES(2026,0,0),(2027,0,0);
 INSERT INTO user(id,name,email) VALUES('a','管理者','a@example.test'),('b','メンバー','b@example.test');
 INSERT INTO app_users VALUES('${actor}','a','管理者','26AJ001','system_admin',0,0),('${member}','b','メンバー','26AJ002','member',0,0);
 INSERT OR IGNORE INTO year_memberships VALUES(2026,'${actor}','active',0,0),(2026,'${member}','active',0,0);
 INSERT INTO year_roles(id,year,name,color,created_at,updated_at) VALUES('${role}',2026,'管理','#64748B',0,0),('${foreign}',2027,'別年度','#64748B',0,0);
 INSERT INTO member_year_roles VALUES('${actor}','${role}',0);
 INSERT INTO year_role_permissions VALUES('${role}','shift.manage',0);`)
  const app = new Hono<ApiEnv>()
  app.use("*", async (c, next) => {
    c.set("member", {
      id: c.req.header("x-denied") ? member : actor,
      userId: "a",
      displayName: "管理者",
      accessLevel: c.req.header("x-mode") ? "member" : "system_admin",
    })
    return next()
  })
  app.route("/years", attendanceSettingsApp)
  const env = {
    shift_app: d1Binding(db),
    CHAT_DIRECTORY: { getByName: () => ({ broadcast: async () => {} }) },
  }
  const request = (
    method = "GET",
    body?: unknown,
    year: string | number = 2026,
    mode = "",
    denied = ""
  ) =>
    Promise.resolve(
      app.request(
        `/years/${year}/attendance-settings`,
        {
          method,
          headers: {
            "content-type": "application/json",
            "x-mode": mode,
            "x-denied": denied,
          },
          ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        },
        env,
        { waitUntil: () => {}, passThroughOnException: () => {}, props: {} }
      )
    )
  return { db, request }
}
it("saves and replaces yearly multi-selection atomically, including empty selections", async () => {
  const { db, request } = fixture()
  try {
    expect(await (await request()).json()).toEqual({
      noticeAudience: "selected",
      roleIds: [],
      memberIds: [],
    })
    const selected = {
      noticeAudience: "selected",
      roleIds: [role],
      memberIds: [actor, member],
    }
    expect((await request("PUT", selected, 2026, "role")).status).toBe(204)
    expect(await (await request()).json()).toEqual(selected)
    expect(await (await request("GET", undefined, 2027)).json()).toEqual({
      noticeAudience: "selected",
      roleIds: [],
      memberIds: [],
    })
    await Promise.all(
      [
        { ...selected, roleIds: [foreign] },
        { ...selected, memberIds: [foreign] },
        { ...selected, roleIds: [role, role] },
        { ...selected, noticeAudience: "unknown" },
        { ...selected, extra: true },
      ].map(async (invalid) => {
        expect((await request("PUT", invalid)).status).toBe(422)
      })
    )
    expect(await (await request()).json()).toEqual(selected)
    expect(
      (
        await request("PUT", {
          noticeAudience: "room_members",
          roleIds: [role],
          memberIds: [member],
        })
      ).status
    ).toBe(204)
    expect(
      (
        await request("PUT", {
          noticeAudience: "selected",
          roleIds: [],
          memberIds: [],
        })
      ).status
    ).toBe(204)
    expect(await (await request()).json()).toEqual({
      noticeAudience: "selected",
      roleIds: [],
      memberIds: [],
    })
  } finally {
    db.close()
  }
})
it("requires shift management, validates the year and rejects inactive members", async () => {
  const { db, request } = fixture()
  try {
    await Promise.all(
      ["GET", "PUT"].map(async (method) => {
        expect(
          (
            await request(
              method,
              method === "PUT"
                ? { noticeAudience: "selected", roleIds: [], memberIds: [] }
                : undefined,
              2026,
              "member",
              "1"
            )
          ).status
        ).toBe(403)
      })
    )
    expect((await request("GET", undefined, "no")).status).toBe(404)
    expect((await request("GET", undefined, 2028)).status).toBe(404)
    db.exec(
      `UPDATE year_memberships SET status='inactive' WHERE member_id='${member}'`
    )
    expect(
      (
        await request("PUT", {
          noticeAudience: "selected",
          roleIds: [],
          memberIds: [member],
        })
      ).status
    ).toBe(422)
  } finally {
    db.close()
  }
})

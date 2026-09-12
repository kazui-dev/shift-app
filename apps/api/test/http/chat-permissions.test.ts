import { chatImagesApp } from "../../src/routes/chat-images"
import { activityActionsApp } from "../../src/routes/activity-actions"
import { readFileSync, readdirSync } from "node:fs"
import { DatabaseSync, type SQLInputValue } from "node:sqlite"
import { Hono } from "hono"
import { afterEach, expect, it, vi } from "vite-plus/test"
import type { ApiEnv } from "../../src/lib/http"
import { chatApp } from "../../src/routes/chat"
import { chatMembershipsApp } from "../../src/routes/me/chat-memberships"
import { yearLifecycleApp } from "../../src/routes/years/lifecycle"
import { yearActivitiesApp } from "../../src/routes/years/activities"
import { meAssignmentsApp } from "../../src/routes/me/assignments"
import {
  activityRoom,
  yearRoom,
  roomCommands,
} from "../../src/services/chat-creation"
import { chatPermissions } from "../../src/services/chat-permissions"

vi.mock("../../src/services/push", () => ({
  notifyRoomMessage: async () => {},
  sendMemberNotification: async () => {},
}))

const databases: DatabaseSync[] = []
afterEach(() => {
  for (const db of databases.splice(0)) db.close()
})
const admin = "10000000-0000-4000-8000-000000000001",
  member = "10000000-0000-4000-8000-000000000002",
  other = "10000000-0000-4000-8000-000000000003"
const activity = "20000000-0000-4000-8000-000000000001",
  role = "30000000-0000-4000-8000-000000000001"
function fixture() {
  const db = new DatabaseSync(":memory:")
  databases.push(db)
  for (const file of readdirSync("migrations")
    .filter((f) => f.endsWith(".sql"))
    .sort())
    db.exec(readFileSync(`migrations/${file}`, "utf8"))
  db.exec(
    "PRAGMA foreign_keys=ON; INSERT INTO operating_years VALUES(2026,0,0),(2027,0,0)"
  )
  for (const [i, id] of [admin, member, other].entries()) {
    db.prepare("INSERT INTO user(id,name,email) VALUES(?,?,?)").run(
      id,
      id,
      `${i}@example.com`
    )
    db.prepare("INSERT INTO app_users VALUES(?,?,?,?,?,0,0)").run(
      id,
      id,
      id,
      `26AJ00${i}`,
      id === admin ? "system_admin" : "member"
    )
    db.prepare(
      "INSERT OR IGNORE INTO year_memberships VALUES(2026,?,'active',0,0)"
    ).run(id)
  }
  let actor = admin
  let beforeBatch = () => {}
  const prepare = (sql: string) => {
    const statement = (params: SQLInputValue[]) => ({
      bind: (...values: SQLInputValue[]) => statement(values),
      first: () => Promise.resolve(db.prepare(sql).get(...params) ?? null),
      all: () => {
        const results = db.prepare(sql).all(...params)
        return Promise.resolve({
          success: true,
          results,
          meta: {
            changes: Number(db.prepare("SELECT changes() AS n").get()?.n),
          },
        })
      },
      run: () => {
        const result = db.prepare(sql).run(...params)
        return Promise.resolve({
          success: true,
          results: [],
          meta: { changes: Number(result.changes) },
        })
      },
    })
    return statement([])
  }
  const delivered = {
    id: "40000000-0000-4000-8000-000000000001",
    sequence: 1,
    memberId: admin,
    memberDisplayName: "管理者",
    content: "投稿",
    attachments: [],
    createdAt: "2026-09-13T00:00:00Z",
  }
  const published = vi.fn<(recipients: string[], event: unknown) => void>()
  const tasks: Promise<unknown>[] = []
  const env = {
    CHAT_ROOMS: { getByName: () => ({ sendMessage: async () => delivered }) },
    CHAT_DIRECTORY: { getByName: () => ({ publish: published }) },
    shift_app: {
      prepare,
      batch: async (statements: { all: () => Promise<unknown> }[]) => {
        beforeBatch()
        db.exec("BEGIN")
        try {
          const result = await Promise.all(
            statements.map((statement) => statement.all())
          )
          db.exec("COMMIT")
          return result
        } catch (error) {
          db.exec("ROLLBACK")
          throw error
        }
      },
    },
  }
  const app = new Hono<ApiEnv>()
  app.use("*", async (c, next) => {
    c.set("member", {
      id: actor,
      userId: actor,
      displayName: actor,
      accessLevel: actor === admin ? "system_admin" : "member",
    })
    await next()
  })
  app.route("/activities", activityActionsApp)
  app.route("/chat", chatApp)
  app.route("/chat", chatImagesApp)
  app.route("/me/chat-memberships", chatMembershipsApp)
  app.route("/years", yearLifecycleApp)
  app.route("/years", yearActivitiesApp)
  app.route("/me", meAssignmentsApp)
  const create = (room: ReturnType<typeof yearRoom>) => {
    for (const { sql, params } of roomCommands(room, 100))
      db.prepare(sql).run(...params)
    return room.id
  }
  const request = async (path: string, method = "GET", body?: unknown) => {
    const response = await app.request(
      path,
      {
        method,
        ...(body === undefined
          ? {}
          : {
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(body),
            }),
      },
      env,
      {
        waitUntil: (task) => tasks.push(task),
        passThroughOnException() {},
        props: {},
      }
    )
    await Promise.all(tasks.splice(0))
    return response
  }
  return {
    published,
    db,
    create,
    request,
    beforeBatch: (callback: () => void) => {
      beforeBatch = callback
    },
    as: (id: string) => {
      actor = id
    },
  }
}

it("resolves year membership at request time without materializing members or implicit creator rights", async () => {
  const f = fixture()
  const id = f.create(yearRoom(2026, member))
  f.as(member)
  expect(await (await f.request(`/chat/rooms/${id}`)).json()).toMatchObject({
    room: { canPost: false, canManage: false, allowExit: false },
  })
  f.db.prepare("DELETE FROM year_memberships WHERE member_id=?").run(other)
  f.as(other)
  expect((await f.request(`/chat/rooms/${id}`)).status).toBe(404)
  f.db
    .prepare(
      "INSERT OR IGNORE INTO year_memberships VALUES(2026,?,'active',0,0)"
    )
    .run(other)
  expect((await f.request(`/chat/rooms/${id}`)).status).toBe(200)
  expect(
    f.db
      .prepare("SELECT count(*) AS n FROM chat_room_targets WHERE room_id=?")
      .get(id)?.n
  ).toBe(2)
  f.db
    .prepare("UPDATE year_memberships SET status='inactive' WHERE member_id=?")
    .run(other)
  expect((await f.request(`/chat/rooms/${id}`)).status).toBe(404)
  f.db
    .prepare("INSERT INTO year_memberships VALUES(2027,?,'active',0,0)")
    .run(other)
  expect((await f.request(`/chat/rooms/${id}`)).status).toBe(404)
})

it("applies role, responsibility and assignment changes to the same recipient set", async () => {
  const f = fixture()
  f.db
    .prepare(
      `INSERT INTO activities(id,year,name,place,activity_type,starts_at,ends_at,color,created_by,updated_by,created_at,updated_at) VALUES(?,2026,'受付','入口','勤務',100,500,'#888888',?,?,0,0)`
    )
    .run(activity, admin, admin)
  f.db
    .prepare("INSERT INTO activity_responsibles VALUES(?,'member',?)")
    .run(activity, member)
  f.db
    .prepare(
      "INSERT INTO year_roles(id,year,name,color,created_at,updated_at) VALUES(?,2026,'担当','#888888',0,0)"
    )
    .run(role)
  f.db.prepare("INSERT INTO member_year_roles VALUES(?,?,0)").run(other, role)
  f.db
    .prepare("INSERT INTO year_role_permissions VALUES(?,'shift.manage',0)")
    .run(role)
  const id = f.create(
    activityRoom({ id: activity, year: 2026, name: "受付", createdBy: admin })
  )
  expect(id).not.toBe(activity)
  f.as(member)
  expect(await (await f.request(`/chat/rooms/${id}`)).json()).toMatchObject({
    room: { canManage: true, canPost: false, activityId: activity },
  })
  f.db.prepare("UPDATE activities SET active=1 WHERE id=?").run(activity)
  expect(await (await f.request(`/chat/rooms/${id}`)).json()).toMatchObject({
    room: { canPost: true },
  })
  f.as(other)
  expect((await f.request(`/chat/rooms/${id}`)).status).toBe(200)
  f.db.prepare("DELETE FROM year_role_permissions WHERE role_id=?").run(role)
  expect((await f.request(`/chat/rooms/${id}`)).status).toBe(404)
  f.db
    .prepare(
      "INSERT INTO shift_slots(id,activity_id,starts_at,ends_at) VALUES('slot',?,100,200)"
    )
    .run(activity)
  f.db
    .prepare(
      "INSERT INTO shift_assignments(id,slot_id,member_id,status,created_by,created_at,updated_at) VALUES('assignment','slot',?,'active',?,0,0)"
    )
    .run(other, admin)
  expect(await (await f.request(`/chat/rooms/${id}`)).json()).toMatchObject({
    room: { canPost: true, canManage: false },
  })
  f.db.exec(
    "UPDATE shift_assignments SET status='cancelled' WHERE id='assignment'"
  )
  expect(
    f.db
      .prepare(
        `${chatPermissions} SELECT member_id FROM chat_permissions WHERE room_id=?`
      )
      .all(id)
      .map((r) => r.member_id)
  ).toEqual(expect.arrayContaining([admin, member]))
  expect((await f.request(`/chat/rooms/${id}`)).status).toBe(404)
})

it("treats the year room as editable grants, validates scopes, and preserves a manager", async () => {
  const f = fixture()
  const id = f.create(yearRoom(2026, admin))
  const settings = {
    name: "連絡",
    allowExit: true,
    targets: [
      {
        targetType: "member",
        targetId: member,
        canRead: true,
        canPost: true,
        canManage: true,
      },
    ],
  }
  expect(
    (
      await f.request(`/chat/rooms/${id}/settings`, "PUT", {
        ...settings,
        targets: [],
      })
    ).status
  ).toBe(409)
  expect(
    (
      await f.request(`/chat/rooms/${id}/settings`, "PUT", {
        ...settings,
        targets: [
          ...settings.targets,
          {
            targetType: "year",
            targetId: "2027",
            canRead: true,
            canPost: false,
            canManage: false,
          },
        ],
      })
    ).status
  ).toBe(422)
  expect(
    (await f.request(`/chat/rooms/${id}/settings`, "PUT", settings)).status
  ).toBe(204)
  expect(f.published).toHaveBeenCalledWith([member], {
    type: "room_changed",
    roomId: id,
  })
  expect(f.published).toHaveBeenLastCalledWith([admin, other], {
    type: "room_removed",
    roomId: id,
  })
  expect((await f.request(`/chat/rooms/${id}`)).status).toBe(404)
  f.as(member)
  expect(await (await f.request(`/chat/rooms/${id}`)).json()).toMatchObject({
    room: { name: "連絡", canManage: true, allowExit: true },
  })
  expect((await f.request(`/me/chat-memberships/${id}`, "DELETE")).status).toBe(
    204
  )
})

it("revokes exited members from lists, direct links, history and current recipients", async () => {
  const f = fixture()
  const room = yearRoom(2026, admin)
  room.allowExit = true
  const id = f.create(room)
  f.as(member)
  expect((await f.request(`/me/chat-memberships/${id}`, "DELETE")).status).toBe(
    204
  )
  expect(f.published).toHaveBeenCalledWith(
    expect.arrayContaining([admin, other]),
    { type: "room_changed", roomId: id }
  )
  expect(f.published).toHaveBeenLastCalledWith([member], {
    type: "room_removed",
    roomId: id,
  })
  expect((await f.request(`/chat/rooms/${id}`)).status).toBe(404)
  expect(
    f.db
      .prepare(
        `${chatPermissions} SELECT member_id FROM chat_permissions WHERE room_id=? AND member_id=?`
      )
      .get(id, member)
  ).toBeUndefined()
  expect((await f.request(`/chat/rooms/${id}/members`)).status).toBe(404)
  expect((await f.request(`/chat/rooms/${id}/messages`)).status).toBe(404)
  expect(
    (await f.request(`/chat/rooms/${id}/attachments/${other}`)).status
  ).toBe(404)
  expect(await (await f.request("/chat/rooms?year=2026")).json()).toEqual({
    rooms: [],
  })
  expect((await f.request(`/me/chat-memberships/${id}`, "DELETE")).status).toBe(
    404
  )
})

it("allows the last manager to leave only when no other resolved readers remain", async () => {
  const f = fixture()
  const room = yearRoom(2026, admin)
  room.allowExit = true
  const id = f.create(room)
  expect((await f.request(`/me/chat-memberships/${id}`, "DELETE")).status).toBe(
    409
  )
  f.as(member)
  expect((await f.request(`/me/chat-memberships/${id}`, "DELETE")).status).toBe(
    204
  )
  f.as(other)
  expect((await f.request(`/me/chat-memberships/${id}`, "DELETE")).status).toBe(
    204
  )
  f.as(admin)
  expect((await f.request(`/me/chat-memberships/${id}`, "DELETE")).status).toBe(
    204
  )
  expect((await f.request(`/chat/rooms/${id}`)).status).toBe(404)
})

it("deletes a managed room, revokes all readers and queues message and image cleanup", async () => {
  const f = fixture()
  const id = f.create(yearRoom(2026, admin))
  f.as(member)
  expect((await f.request(`/chat/rooms/${id}`, "DELETE")).status).toBe(403)
  f.db.prepare("UPDATE chat_rooms SET allow_exit=1 WHERE id=?").run(id)
  expect((await f.request(`/me/chat-memberships/${id}`, "DELETE")).status).toBe(
    204
  )
  expect((await f.request(`/chat/rooms/${id}`)).status).toBe(404)
  f.as(admin)
  expect((await f.request(`/chat/rooms/${id}`, "DELETE")).status).toBe(204)
  expect(f.published).toHaveBeenLastCalledWith(
    expect.arrayContaining([admin, other]),
    { type: "room_removed", roomId: id }
  )
  expect(f.published.mock.calls.at(-1)?.[0]).not.toContain(member)
  expect(
    f.db
      .prepare("SELECT room_id FROM chat_room_deletions WHERE room_id=?")
      .get(id)
  ).toMatchObject({ room_id: id })
  expect(
    f.db
      .prepare("SELECT room_id FROM chat_room_targets WHERE room_id=?")
      .all(id)
  ).toEqual([])
  expect((await f.request(`/chat/rooms/${id}`)).status).toBe(404)
  f.as(member)
  expect((await f.request(`/chat/rooms/${id}`)).status).toBe(404)
  expect(await (await f.request("/chat/rooms?year=2026")).json()).toMatchObject(
    { rooms: [] }
  )
})

it("rechecks management in the deletion transaction before queuing cleanup", async () => {
  const f = fixture()
  const id = f.create(yearRoom(2026, admin))
  f.beforeBatch(() => {
    f.db
      .prepare("DELETE FROM chat_room_targets WHERE room_id=? AND can_manage=1")
      .run(id)
  })
  expect((await f.request(`/chat/rooms/${id}`, "DELETE")).status).toBe(409)
  expect(
    f.db.prepare("SELECT id FROM chat_rooms WHERE id=?").get(id)
  ).toMatchObject({ id })
  expect(
    f.db
      .prepare("SELECT room_id FROM chat_room_deletions WHERE room_id=?")
      .get(id)
  ).toBeUndefined()
})

it("creates annual rooms in the server transaction and rejects duplicate years without creating another room", async () => {
  const f = fixture()
  expect((await f.request("/years", "POST", { year: 2028 })).status).toBe(201)
  expect(
    f.db.prepare("SELECT name FROM chat_rooms WHERE year=2028").all()
  ).toEqual([{ name: "全体連絡" }])
  expect((await f.request("/years", "POST", { year: 2028 })).status).toBe(409)
  expect(
    f.db.prepare("SELECT count(*) AS n FROM chat_rooms WHERE year=2028").get()
      ?.n
  ).toBe(1)
  f.db.exec("INSERT INTO operating_years VALUES(2029,0,0)")
  expect(
    f.db.prepare("SELECT count(*) AS n FROM chat_rooms WHERE year=2029").get()
      ?.n
  ).toBe(0)
})

it("creates and copies a shift with distinct linked rooms and retains the calendar report destination", async () => {
  const f = fixture()
  const response = await f.request("/years/2026/activities", "POST", {
    name: "受付",
    place: "入口",
    activityType: "勤務",
    startsAt: "2026-09-13T10:00:00+09:00",
    endsAt: "2026-09-13T11:00:00+09:00",
    color: "#888888",
    responsibles: [{ targetType: "member", targetId: member }],
  })
  expect(response.status).toBe(201)
  const link = f.db
    .prepare("SELECT activity_id,room_id FROM activity_chat_rooms")
    .get()
  expect(link).toBeDefined()
  const activityId = String(link?.activity_id),
    roomId = String(link?.room_id)
  expect(activityId).not.toBe(roomId)
  f.db.prepare("UPDATE activities SET active=1 WHERE id=?").run(activityId)
  f.db
    .prepare(
      "INSERT INTO shift_slots(id,activity_id,starts_at,ends_at) VALUES('slot',?,?,?)"
    )
    .run(
      activityId,
      Date.parse("2026-09-13T10:00:00+09:00"),
      Date.parse("2026-09-13T11:00:00+09:00")
    )
  f.db
    .prepare(
      "INSERT INTO shift_assignments(id,slot_id,member_id,status,created_by,created_at,updated_at) VALUES('assignment','slot',?,'active',?,0,0)"
    )
    .run(member, admin)
  f.as(member)
  const assignments = await f.request(
    "/me/assignments?year=2026&from=2026-09-01T00:00:00Z&to=2026-10-01T00:00:00Z"
  )
  expect(await assignments.json()).toMatchObject({
    assignments: [{ activityId, roomId }],
  })
  expect(await (await f.request(`/chat/rooms/${roomId}`)).json()).toMatchObject(
    { room: { activityId, canPost: true, canManage: true } }
  )
  f.as(admin)
  const copy = await f.request(`/activities/${activityId}/copies`, "POST", {
    date: "2026-09-14",
  })
  expect(copy.status).toBe(201)
  expect(
    f.db.prepare("SELECT room_id FROM activity_chat_rooms").all()
  ).toHaveLength(2)
})

it("re-invites an exited member only when an explicit grant is newly added", async () => {
  const f = fixture()
  const room = yearRoom(2026, admin)
  room.allowExit = true
  const id = f.create(room)
  f.as(member)
  await f.request(`/me/chat-memberships/${id}`, "DELETE")
  f.as(admin)
  const settings = { name: room.name, allowExit: true, targets: room.targets }
  expect(
    (await f.request(`/chat/rooms/${id}/settings`, "PUT", settings)).status
  ).toBe(204)
  f.as(member)
  expect((await f.request(`/chat/rooms/${id}`)).status).toBe(404)
  f.as(admin)
  expect(
    (
      await f.request(`/chat/rooms/${id}/settings`, "PUT", {
        ...settings,
        targets: [
          ...settings.targets,
          {
            targetType: "member",
            targetId: member,
            canRead: true,
            canPost: false,
            canManage: false,
          },
        ],
      })
    ).status
  ).toBe(204)
  f.as(member)
  expect(await (await f.request(`/chat/rooms/${id}`)).json()).toMatchObject({
    room: { canPost: false },
  })
})

it("rolls back a settings write if authority is revoked after validation", async () => {
  const f = fixture()
  const room = yearRoom(2026, admin)
  const id = f.create(room)
  f.beforeBatch(() => {
    f.db
      .prepare(
        "DELETE FROM chat_room_targets WHERE room_id=? AND target_type='access_level'"
      )
      .run(id)
  })
  const response = await f.request(`/chat/rooms/${id}/settings`, "PUT", {
    name: "Changed",
    allowExit: true,
    targets: room.targets,
  })
  expect(response.status).toBe(409)
  expect(
    f.db.prepare("SELECT name,allow_exit FROM chat_rooms WHERE id=?").get(id)
  ).toMatchObject({ name: room.name, allow_exit: 0 })
  expect(
    f.db
      .prepare("SELECT target_type FROM chat_room_targets WHERE room_id=?")
      .all(id)
  ).toEqual([{ target_type: "year" }])
})

it("keeps room settings changes out of latest-post ordering", async () => {
  const f = fixture()
  const older = yearRoom(2026, admin),
    newer = yearRoom(2026, admin)
  f.create(older)
  f.create(newer)
  f.db
    .prepare("UPDATE chat_rooms SET updated_at=200,last_sequence=1 WHERE id=?")
    .run(newer.id)
  const response = await f.request(`/chat/rooms/${older.id}/settings`, "PUT", {
    name: "変更後",
    allowExit: true,
    targets: older.targets,
  })
  expect(response.status).toBe(204)
  expect(
    f.db.prepare("SELECT updated_at FROM chat_rooms WHERE id=?").get(older.id)
      ?.updated_at
  ).toBe(100)
  expect(await (await f.request("/chat/rooms?year=2026")).json()).toMatchObject(
    { rooms: [{ id: newer.id }, { id: older.id }] }
  )
})

it("commits room order and the sender's read position before publishing a post to the shared stream", async () => {
  const f = fixture()
  const id = f.create(yearRoom(2026, admin))
  f.published.mockImplementation(() => {
    expect(
      f.db.prepare("SELECT last_sequence FROM chat_rooms WHERE id=?").get(id)
    ).toMatchObject({ last_sequence: 1 })
    expect(
      f.db
        .prepare(
          "SELECT last_read FROM chat_room_preferences WHERE room_id=? AND member_id=?"
        )
        .get(id, admin)
    ).toMatchObject({ last_read: 1 })
  })
  const response = await f.request(`/chat/rooms/${id}/messages`, "POST", {
    id: "40000000-0000-4000-8000-000000000001",
    content: "投稿",
    attachmentIds: [],
  })
  expect(response.status).toBe(201)
  expect(f.published).toHaveBeenCalledWith(
    expect.arrayContaining([admin, member, other]),
    expect.objectContaining({
      type: "message",
      roomId: id,
      message: expect.objectContaining({ content: "投稿", memberImage: null }),
    })
  )
  const preferences = await f.request(
    `/chat/rooms/${id}/preferences`,
    "PATCH",
    { muted: true, lastRead: 1 }
  )
  expect(preferences.status).toBe(204)
  expect(f.published).toHaveBeenLastCalledWith([admin], {
    type: "preferences_changed",
    roomId: id,
    lastRead: 1,
    muted: true,
  })
})

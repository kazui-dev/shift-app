import { Hono } from "hono"
import type { DatabaseSync } from "node:sqlite"
import * as v from "valibot"
import { afterEach, expect, it } from "vite-plus/test"

import { findAccessibleRoom } from "../../src/features/chat/services/chat-access"
import {
  activityRoom,
  roomCommands,
} from "../../src/features/chat/services/chat-creation"
import {
  messageAudience,
  privateReaders,
  readsPrivate,
} from "../../src/features/chat/services/private-messages"
import { d1Binding, migrated } from "../support/sqlite"

const databases: DatabaseSync[] = []
afterEach(() => {
  for (const db of databases.splice(0)) db.close()
})

const id = (n: number) => `10000000-0000-4000-8000-00000000000${n}`
const admin = id(1),
  responsible = id(2),
  roleResponsible = id(3),
  manager = id(4),
  reporter = id(5),
  participant = id(6)
const shift = "20000000-0000-4000-8000-000000000001"
const keepers = "30000000-0000-4000-8000-000000000001",
  managers = "30000000-0000-4000-8000-000000000002"

/**
 * A shift room with every kind of reader: an administrator, a responsible
 * named directly and one through a role, a member who manages shifts, the
 * reporter and another participant.
 */
function fixture() {
  const db = migrated()
  databases.push(db)
  db.exec("INSERT INTO operating_years VALUES(2026,0,0)")
  for (const [i, member] of [
    admin,
    responsible,
    roleResponsible,
    manager,
    reporter,
    participant,
  ].entries()) {
    db.prepare("INSERT INTO user(id,name,email) VALUES(?,?,?)").run(
      member,
      member,
      `${i}@example.com`
    )
    db.prepare("INSERT INTO app_users VALUES(?,?,?,?,?,0,0)").run(
      member,
      member,
      member,
      `26AJ00${i}`,
      member === admin ? "system_admin" : "member"
    )
    db.prepare(
      "INSERT OR IGNORE INTO year_memberships VALUES(2026,?,'active',0,0)"
    ).run(member)
  }
  db.prepare(
    `INSERT INTO activities(id,year,name,place,activity_type,starts_at,ends_at,color,created_by,updated_by,created_at,updated_at) VALUES(?,2026,'受付','入口','勤務',100,500,'#888888',?,?,0,0)`
  ).run(shift, admin, admin)
  for (const [role, name] of [
    [keepers, "受付係"],
    [managers, "シフト担責"],
  ] as const)
    db.prepare(
      "INSERT INTO year_roles(id,year,name,color,created_at,updated_at) VALUES(?,2026,?,'#888888',0,0)"
    ).run(role, name)
  db.prepare(
    "INSERT INTO year_role_permissions VALUES(?,'shift.manage',0)"
  ).run(managers)
  db.prepare("INSERT INTO member_year_roles VALUES(?,?,0)").run(
    roleResponsible,
    keepers
  )
  db.prepare("INSERT INTO member_year_roles VALUES(?,?,0)").run(
    manager,
    managers
  )
  db.prepare("INSERT INTO activity_responsibles VALUES(?,'member',?)").run(
    shift,
    responsible
  )
  db.prepare("INSERT INTO activity_responsibles VALUES(?,'role',?)").run(
    shift,
    keepers
  )
  db.exec(
    `INSERT INTO shift_slots(id,activity_id,starts_at,ends_at) VALUES('slot','${shift}',100,200)`
  )
  for (const [n, member] of [reporter, participant].entries())
    db.prepare(
      `INSERT INTO shift_assignments(id,slot_id,member_id,status,created_by,created_at,updated_at) VALUES(?,'slot',?,'active',?,0,0)`
    ).run(`assignment-${n}`, member, admin)
  const room = activityRoom({
    id: shift,
    year: 2026,
    name: "受付",
    createdBy: admin,
  })
  for (const { sql, params } of roomCommands(room, 100))
    db.prepare(sql).run(...params)
  return { db, env: { shift_app: d1Binding(db) }, room: room.id }
}

const everyone = [
  admin,
  responsible,
  roleResponsible,
  manager,
  reporter,
  participant,
]

/** The services under test, reached as the Worker reaches them. */
const app = new Hono<{ Bindings: CloudflareBindings }>()
app.get("/rooms/:room/readers/:member", async (c) =>
  c.json({
    reads: await readsPrivate(
      c.env,
      c.req.param("room"),
      c.req.param("member")
    ),
    unread:
      (
        await findAccessibleRoom(
          c.env,
          c.req.param("room"),
          c.req.param("member")
        )
      )?.unreadCount ?? null,
  })
)
app.get("/rooms/:room/private/:about", async (c) => {
  const readers = await privateReaders(
    c.env,
    c.req.param("room"),
    c.req.param("about"),
    everyone
  )
  return c.json({
    members: readers.members.toSorted(),
    responsibles: [...readers.responsibles].toSorted(),
  })
})
app.get("/rooms/:room/audience/:about", async (c) => {
  const audience = await messageAudience(
    c.env,
    c.req.param("room"),
    c.req.param("about"),
    true
  )
  return c.json({
    members: audience.members.toSorted(),
    devices: audience.devices.map((device) => device.id).toSorted(),
  })
})
const readerSchema = v.object({
  reads: v.boolean(),
  unread: v.nullable(v.number()),
})
async function reader(f: ReturnType<typeof fixture>, member: string) {
  const response = await app.request(
    `/rooms/${f.room}/readers/${member}`,
    {},
    f.env
  )
  return v.parse(readerSchema, await response.json())
}

it("lets the shift's keepers read private messages, and nobody else", async () => {
  const f = fixture()
  const allowed = await Promise.all(
    everyone.map(async (member) => (await reader(f, member)).reads)
  )
  expect(allowed).toEqual([true, true, true, true, false, false])
  const readers = await (
    await app.request(`/rooms/${f.room}/private/${reporter}`, {}, f.env)
  ).json()
  expect(readers).toEqual({
    members: [
      admin,
      responsible,
      roleResponsible,
      manager,
      reporter,
    ].toSorted(),
    // Only responsibles hear a notice through a muted room.
    responsibles: [responsible, roleResponsible].toSorted(),
  })
  // Someone who stops being responsible stops reading, earlier notices too.
  f.db
    .prepare("DELETE FROM activity_responsibles WHERE target_id=?")
    .run(responsible)
  expect((await reader(f, responsible)).reads).toBe(false)
})

it("counts a private message as unread only for those who may read it", async () => {
  const f = fixture()
  f.db
    .prepare(
      "INSERT INTO chat_message_index(room_id,sequence,member_id,private_to) VALUES(?,1,'bot',?)"
    )
    .run(f.room, reporter)
  expect((await reader(f, reporter)).unread).toBe(1)
  expect((await reader(f, responsible)).unread).toBe(1)
  expect((await reader(f, participant)).unread).toBe(0)
})

it("reaches a private notice's readers only, ringing muted responsibles but no other muted reader", async () => {
  const f = fixture()
  for (const [device, member] of [
    ["responsible-phone", responsible],
    ["manager-phone", manager],
    ["reporter-phone", reporter],
    ["participant-phone", participant],
  ] as const)
    f.db
      .prepare(
        "INSERT INTO notification_devices(id,member_id,enabled,endpoint,p256dh,auth,created_at,updated_at) VALUES(?,?,1,?,'k','a',0,0)"
      )
      .run(device, member, `https://push.test/${device}`)
  for (const member of [responsible, manager])
    f.db
      .prepare(
        "INSERT INTO chat_room_preferences(room_id,member_id,muted,last_read) VALUES(?,?,1,0)"
      )
      .run(f.room, member)
  const audience = await (
    await app.request(`/rooms/${f.room}/audience/${reporter}`, {}, f.env)
  ).json()
  expect(audience).toEqual({
    members: [
      admin,
      responsible,
      roleResponsible,
      manager,
      reporter,
    ].toSorted(),
    devices: ["reporter-phone", "responsible-phone"],
  })
})

import { Hono } from "hono"
import { expect, it } from "vite-plus/test"
import * as v from "valibot"
import {
  activityEditorResponseSchema,
  myAssignmentsResponseSchema,
  type ActivityEditorInput,
} from "@workspace/shared/shifts"
import { activitiesApp } from "../../src/features/activities/routes/activities"
import { meAssignmentsApp } from "../../src/features/assignments/routes/me/assignments"
import type { ApiEnv } from "../../src/lib/http"
import { d1Binding, migrated } from "../support/sqlite"

const id = (n: number) =>
  `10000000-0000-4000-8000-${String(n).padStart(12, "0")}`
const iso = (n: number) => new Date(n).toISOString()
const admin = id(1),
  staff = id(2),
  work = id(10),
  other = id(11)

function fixture() {
  const db = migrated()
  db.exec("INSERT INTO operating_years VALUES (2026,0,0)")
  for (const person of [admin, staff]) {
    db.prepare("INSERT INTO user(id,name,email) VALUES (?,?,?)").run(
      person,
      person,
      `${person}@example.test`
    )
    db.prepare("INSERT INTO app_users VALUES (?,?,?,?,?,0,0)").run(
      person,
      person,
      person,
      person,
      person === admin ? "system_admin" : "member"
    )
    db.prepare(
      "INSERT OR IGNORE INTO year_memberships VALUES (2026,?,'active',0,0)"
    ).run(person)
  }
  for (const activity of [work, other]) {
    db.prepare(
      "INSERT INTO activities(id,year,name,place,activity_type,starts_at,ends_at,color,created_by,updated_by,created_at,updated_at) VALUES (?,2026,'受付','','shift',1000,10000,'#000000',?,?,0,0)"
    ).run(activity, admin, admin)
    db.prepare("INSERT INTO activity_responsibles VALUES (?,'member',?)").run(
      activity,
      admin
    )
    db.prepare("UPDATE activities SET active=1 WHERE id=?").run(activity)
  }
  for (const [slot, from, to] of [
    [id(20), 1000, 3000],
    [id(21), 5000, 7000],
  ] as const) {
    db.prepare("INSERT INTO shift_slots VALUES (?,?,?,?,NULL,0)").run(
      slot,
      work,
      from,
      to
    )
    db.prepare(
      "INSERT INTO shift_assignments(id,slot_id,member_id,created_by,created_at,updated_at) VALUES (?,?,?,?,0,0)"
    ).run(id(from), slot, staff, admin)
  }
  db.prepare("INSERT INTO activity_notices VALUES (?,?,?,?,?)").run(
    other,
    id(40),
    1000,
    10000,
    "別の仕事"
  )
  let person = admin
  const app = new Hono<ApiEnv>()
  app.use("*", async (c, next) => {
    c.set("member", {
      id: person,
      userId: person,
      displayName: person,
      accessLevel: person === admin ? "system_admin" : "member",
    })
    await next()
  })
  app.route("/activities", activitiesApp)
  app.route("/me", meAssignmentsApp)
  const env = {
    shift_app: d1Binding(db),
    CHAT_DIRECTORY: { getByName: () => ({ broadcast: async () => {} }) },
  }
  const request = (path: string, input?: unknown) =>
    app.request(
      path,
      input === undefined
        ? {}
        : {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(input),
          },
      env,
      { waitUntil() {}, passThroughOnException() {}, props: {} }
    )
  const plan = async (): Promise<ActivityEditorInput> => {
    const current = v.parse(
      activityEditorResponseSchema,
      await (await request(`/activities/${work}`)).json()
    )
    return {
      ...current.activity,
      candidateRoleIds: current.candidateRoleIds,
      responsibles: current.responsibles,
      slots: current.slots,
      requirements: current.requirements,
      notices: current.notices,
    }
  }
  return {
    db,
    request,
    plan,
    asStaff: () => {
      person = staff
    },
    asAdmin: () => {
      person = admin
    },
  }
}

it("saves notices atomically with the shift, preserves them for old clients, rejects stale and invalid saves, and supports deletion", async () => {
  const f = fixture()
  try {
    const initial = await f.plan()
    const notices = [
      {
        id: id(30),
        startsAt: iso(1000),
        endsAt: iso(3000),
        content: "  午前の連絡  ",
      },
    ]
    const response = await f.request(`/activities/${work}`, {
      ...initial,
      notices,
    })
    expect(response.status).toBe(200)
    expect(
      v.parse(activityEditorResponseSchema, await response.json()).notices?.[0]
        ?.content
    ).toBe("午前の連絡")
    expect(
      (await f.request(`/activities/${work}`, { ...initial, notices: [] }))
        .status
    ).toBe(409)
    const { notices: savedNotices, ...legacy } = await f.plan()
    expect(savedNotices).toHaveLength(1)
    expect((await f.request(`/activities/${work}`, legacy)).status).toBe(200)
    expect((await f.plan()).notices).toHaveLength(1)
    const latest = await f.plan()
    const invalidInputs = [
      [{ ...notices[0], endsAt: iso(1000) }],
      [{ ...notices[0], content: " " }],
      [...notices, ...notices],
    ]
    const rejected = await Promise.all(
      invalidInputs.map(async (invalid) =>
        f.request(`/activities/${work}`, { ...latest, notices: invalid })
      )
    )
    expect(rejected.map((rejection) => rejection.status)).toEqual([
      422, 422, 422,
    ])
    f.asStaff()
    expect(
      (await f.request(`/activities/${work}`, { ...latest, notices: [] }))
        .status
    ).toBe(403)
    expect((await f.request(`/activities/${work}`)).status).toBe(403)
    f.asAdmin()
    expect(
      (await f.request(`/activities/${work}`, { ...latest, notices: [] }))
        .status
    ).toBe(200)
    expect((await f.plan()).notices).toEqual([])
  } finally {
    f.db.close()
  }
})

it("returns the own activity's notice schedule independently of work and query times, and removes access with inactive membership", async () => {
  const f = fixture()
  try {
    const notice = (n: number, from: number, to: number, content: string) => ({
      id: id(n),
      startsAt: iso(from),
      endsAt: iso(to),
      content,
    })
    const notices = [
      notice(30, 1000, 3000, "午前"),
      notice(31, 5000, 7000, "午後"),
      notice(32, 3000, 5000, "境界の間"),
      notice(33, 20000, 30000, "取得期間外の表示期間"),
    ]
    expect(
      (await f.request(`/activities/${work}`, { ...(await f.plan()), notices }))
        .status
    ).toBe(200)
    f.asStaff()
    const path = `/me/assignments?year=2026&from=${iso(0)}&to=${iso(10000)}`
    const result = v.parse(
      myAssignmentsResponseSchema,
      await (await f.request(path)).json()
    )
    expect(
      result.assignments.map((assignment) =>
        assignment.notices?.map((item) => item.content)
      )
    ).toEqual([
      ["午前", "境界の間", "午後", "取得期間外の表示期間"],
      ["午前", "境界の間", "午後", "取得期間外の表示期間"],
    ])
    f.db
      .prepare(
        "UPDATE year_memberships SET status='inactive' WHERE member_id=?"
      )
      .run(staff)
    expect(
      v.parse(myAssignmentsResponseSchema, await (await f.request(path)).json())
        .assignments
    ).toEqual([])
  } finally {
    f.db.close()
  }
})

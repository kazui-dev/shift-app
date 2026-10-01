import { Hono } from "hono"
import { describe, expect, it } from "vite-plus/test"
import { availabilitySubmissionsApp } from "../../src/features/availability/routes/years/availability-submissions"
import { meAvailabilityApp } from "../../src/features/availability/routes/me/availability"
import type { ApiEnv } from "../../src/lib/http"
import { migrated, d1Binding } from "../support/sqlite"

const target = "10000000-0000-4000-8000-000000000001"
const actor = "10000000-0000-4000-8000-000000000002"
const directoryId = "10000000-0000-4000-8000-000000000003"
const app = new Hono<ApiEnv>()
app.use("*", async (c, next) => {
  const self = c.req.header("x-self") === "1"
  c.set("member", {
    id: self ? target : actor,
    userId: self ? "u" : "a",
    displayName: self ? "本人" : "担当者",
    accessLevel: self ? "member" : "system_admin",
  })
  await next()
})
app.route("/years", availabilitySubmissionsApp)
app.route("/me", meAvailabilityApp)
const context = {
  waitUntil: () => {},
  passThroughOnException: () => {},
  props: {},
}
const answer = (date = "2026-10-29", choice = "all") => ({
  date,
  version: 1,
  choice,
  times: [],
})
function fixture() {
  const db = migrated()
  db.exec(`INSERT INTO operating_years VALUES (2026,0,0);
    INSERT INTO user (id,name,email) VALUES ('u','本人','u@example.com'),('a','担当者','a@example.com');
    INSERT INTO app_users (id,user_id,display_name,student_id,access_level,created_at,updated_at) VALUES
      ('${target}','u','本人','26AJ001','member',0,0),('${actor}','a','担当者','26AJ002','system_admin',0,0);
    INSERT INTO availability_dates (id,year,date,starts_minute,ends_minute,accepting,created_at,updated_at) VALUES
      ('d1',2026,'2026-10-29',540,1080,1,0,0),('d2',2026,'2026-10-30',540,1080,1,0,0),('d3',2026,'2026-10-31',540,1080,0,0,0);`)
  let beforeBatch = () => {}
  const env = {
    shift_app: d1Binding(db, { beforeBatch: () => beforeBatch() }),
    CHAT_DIRECTORY: {
      getByName: () => ({ broadcast: () => Promise.resolve() }),
    },
  }
  const path = (member = target) =>
    `/years/2026/availability-submissions/${member}`
  const save = (
    revision: number,
    answers: unknown[],
    member = target,
    self = false
  ) =>
    app.request(
      path(member),
      {
        method: "PATCH",
        headers: { "x-self": self ? "1" : "0" },
        body: JSON.stringify({ revision, answers }),
      },
      env,
      context
    )
  return {
    db,
    env,
    path,
    save,
    race: (action: () => void) => {
      beforeBatch = () => {
        beforeBatch = () => {}
        action()
      }
    },
  }
}

describe("editing a member's availability", () => {
  it("saves partial and closed-day answers, records the actor, and preserves the member's draft", async () => {
    const { db, env, save, path } = fixture()
    try {
      db.prepare(
        "INSERT INTO availability_drafts (year,member_id,answers,revision,updated_at) VALUES (2026,?,?,0,0)"
      ).run(target, JSON.stringify([answer("2026-10-29", "no")]))
      expect((await save(0, [answer()])).status).toBe(200)
      expect(
        db.prepare("SELECT answers,revision FROM availability_drafts").get()
      ).toMatchObject({
        revision: 0,
        answers: JSON.stringify([answer("2026-10-29", "no")]),
      })
      const progress = () =>
        app.request("/years/2026/availability-submissions", {}, env)
      expect(await (await progress()).json()).toMatchObject({
        progress: expect.arrayContaining([
          {
            memberId: target,
            displayName: "本人",
            studentId: "26AJ001",
            image: null,
            complete: false,
            hasHistory: true,
          },
        ]),
      })
      expect(
        (await save(1, [answer("2026-10-30", "no"), answer("2026-10-31")]))
          .status
      ).toBe(200)
      expect(await (await progress()).json()).toMatchObject({
        progress: expect.arrayContaining([
          expect.objectContaining({ memberId: target, complete: true }),
        ]),
      })
      expect(
        await (await app.request(`${path()}/history`, {}, env)).json()
      ).toMatchObject({
        changes: expect.arrayContaining([
          expect.objectContaining({
            changedBy: actor,
            changedByName: "担当者",
            before: { choice: "unanswered", times: [] },
            after: { choice: "all", times: [] },
          }),
        ]),
      })
      expect(await (await app.request(path(), {}, env)).json()).toMatchObject({
        answers: expect.arrayContaining([
          expect.objectContaining({ date: "2026-10-29", choice: "all" }),
        ]),
        draftRevision: null,
      })
    } finally {
      db.close()
    }
  })
  it("rejects unauthorized, missing, malformed, overlapping and outdated requests", async () => {
    const { db, env, save, path } = fixture()
    try {
      expect((await save(0, [answer()], target, true)).status).toBe(403)
      expect(
        (await app.request(path(), { headers: { "x-self": "1" } }, env)).status
      ).toBe(403)
      expect((await save(0, [answer()], directoryId)).status).toBe(404)
      expect((await save(0, [answer()], "bad")).status).toBe(404)
      expect((await save(0, [answer("2027-01-01")])).status).toBe(422)
      expect((await save(0, [answer(), answer()])).status).toBe(422)
      expect((await save(0, [{ ...answer(), version: 0 }])).status).toBe(422)
      expect(
        (
          await save(0, [
            {
              ...answer(),
              choice: "times",
              times: [{ id: "1", from: 500, to: 700 }],
            },
          ])
        ).status
      ).toBe(422)
      expect(
        (
          await save(0, [
            {
              ...answer(),
              choice: "times",
              times: [
                { id: "1", from: 540, to: 800 },
                { id: "2", from: 700, to: 900 },
              ],
            },
          ])
        ).status
      ).toBe(422)
      expect((await save(0, [answer()])).status).toBe(200)
      expect((await save(0, [answer("2026-10-29", "no")])).status).toBe(409)
      const self = await app.request(
        "/me/2026",
        {
          method: "PUT",
          headers: { "x-self": "1" },
          body: JSON.stringify({
            revision: 0,
            submit: true,
            answers: [answer(), answer("2026-10-30")],
          }),
        },
        env,
        context
      )
      expect(self.status).toBe(409)
      const legacy = await app.request(
        "/me/2026",
        {
          method: "PUT",
          headers: { "x-self": "1" },
          body: JSON.stringify({
            submit: true,
            answers: [answer(), answer("2026-10-30")],
          }),
        },
        env,
        context
      )
      expect(legacy.status).toBe(409)

      expect(
        db
          .prepare(
            "SELECT choice FROM availability_day_answers WHERE date_id='d1'"
          )
          .get()?.choice
      ).toBe("all")
    } finally {
      db.close()
    }
  })
  it("rolls back racing writes and date changes", async () => {
    const { db, save, race } = fixture()
    try {
      expect((await save(0, [answer()])).status).toBe(200)
      race(() => {
        db.exec("UPDATE availability_submissions SET revision=revision+1")
      })
      expect((await save(1, [answer("2026-10-29", "no")])).status).toBe(409)
      race(() => {
        db.exec("UPDATE availability_dates SET version=version+1 WHERE id='d1'")
      })
      expect((await save(2, [answer("2026-10-29", "no")])).status).toBe(409)
      expect(
        db.prepare("SELECT revision FROM availability_submissions").get()
          ?.revision
      ).toBe(2)
      expect(
        db
          .prepare("SELECT COUNT(*) AS n FROM availability_submission_changes")
          .get()?.n
      ).toBe(1)
    } finally {
      db.close()
    }
  })
  it("edits directory participants and carries their history through first sign-in", async () => {
    const { db, env, save, path } = fixture()
    try {
      db.exec(`INSERT INTO student_directory (id,year,student_id,display_name,created_at) VALUES ('entry',2026,'26AJ003','参加者',0);
        INSERT INTO directory_availability_submissions (id,entry_id,created_at,updated_at) VALUES ('${directoryId}','entry',0,0);`)
      expect((await save(0, [answer()], directoryId)).status).toBe(200)
      expect((await save(0, [answer()], directoryId)).status).toBe(409)
      expect(
        await (
          await app.request(`${path(directoryId)}/history`, {}, env)
        ).json()
      ).toMatchObject({
        changes: [
          expect.objectContaining({
            changedBy: actor,
            changedByName: "担当者",
          }),
        ],
      })
      db.exec(`INSERT INTO user (id,name,email) VALUES ('new','参加者','new@example.com');
        INSERT INTO app_users (id,user_id,display_name,student_id,access_level,created_at,updated_at) VALUES ('new-member','new','参加者','26AJ003','member',0,0);`)
      expect(
        db
          .prepare(
            "SELECT changed_by,changed_by_name,changed_at FROM availability_submission_changes WHERE submission_id=?"
          )
          .get(directoryId)
      ).toMatchObject({
        changed_by: actor,
        changed_by_name: "担当者",
        changed_at: expect.any(Number),
      })
      expect(
        db
          .prepare("SELECT member_id FROM availability_submissions WHERE id=?")
          .get(directoryId)?.member_id
      ).toBe("new-member")
      expect(
        db
          .prepare(
            "SELECT COUNT(*) AS n FROM directory_availability_submission_changes"
          )
          .get()?.n
      ).toBe(0)
    } finally {
      db.close()
    }
  })
})

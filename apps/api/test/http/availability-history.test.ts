import { Hono } from "hono"
import * as v from "valibot"
import { describe, expect, it } from "vite-plus/test"
import { availabilityHistoryResponseSchema } from "@workspace/shared/shifts"
import type { ApiEnv } from "../../src/lib/http"
import { meAvailabilityApp } from "../../src/features/availability/routes/me/availability"
import { availabilitySubmissionsApp } from "../../src/features/availability/routes/years/availability-submissions"
import { d1Binding, migrated } from "../support/sqlite"

const memberId = "10000000-0000-4000-8000-000000000001"
const dateId = "20000000-0000-4000-8000-000000000001"
const app = new Hono<ApiEnv>()
app.use("*", async (c, next) => {
  c.set("member", {
    id: memberId,
    userId: "u",
    displayName: "Aoi",
    accessLevel:
      c.req.header("x-test-member") === "1" ? "member" : "system_admin",
  })
  await next()
})
app.route("/me/availability", meAvailabilityApp)
app.route("/years", availabilitySubmissionsApp)

describe("availability change history", () => {
  it("records only changed resubmissions and serves them to managers", async () => {
    const db = migrated()
    try {
      db.exec(`INSERT INTO operating_years VALUES (2026,0,0);
        INSERT INTO user (id,name,email) VALUES ('u','Aoi','aoi@example.com');
        INSERT INTO app_users (id,user_id,display_name,student_id,access_level,created_at,updated_at)
          VALUES ('${memberId}','u','Aoi','26AJ001','member',0,0);
        INSERT INTO availability_dates (id,year,date,starts_minute,ends_minute,created_at,updated_at)
          VALUES ('${dateId}',2026,'2026-10-29',510,1200,0,0);`)
      const env = {
        shift_app: d1Binding(db),
        CHAT_DIRECTORY: {
          getByName: () => ({ broadcast: () => Promise.resolve() }),
        },
      }
      const context = {
        waitUntil: () => {},
        passThroughOnException: () => {},
        props: {},
      }
      const submit = (choice: "all" | "times", from = 510, to = 930) =>
        app.request(
          "/me/availability/2026",
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              submit: true,
              answers: [
                {
                  date: "2026-10-29",
                  version: 1,
                  choice,
                  times:
                    choice === "times"
                      ? [{ id: crypto.randomUUID(), from, to }]
                      : [],
                },
              ],
            }),
          },
          env,
          context
        )
      expect((await submit("all")).status).toBe(200)
      expect((await submit("all")).status).toBe(200)
      expect(
        db
          .prepare("SELECT COUNT(*) AS n FROM availability_submission_changes")
          .get()?.n
      ).toBe(0)
      expect((await submit("times")).status).toBe(200)
      expect((await submit("times")).status).toBe(200)
      const response = await app.request(
        `/years/2026/availability-submissions/${memberId}/history`,
        {},
        env
      )
      expect(response.status).toBe(200)
      const history = v.parse(
        availabilityHistoryResponseSchema,
        await response.json()
      )
      expect(history.changes).toMatchObject([
        {
          date: "2026-10-29",
          before: { choice: "all", times: [] },
          after: { choice: "times", times: [{ from: 510, to: 930 }] },
        },
      ])
      db.exec(`INSERT INTO availability_dates (id,year,date,starts_minute,ends_minute,created_at,updated_at)
        VALUES ('30000000-0000-4000-8000-000000000001',2026,'2026-10-30',510,1200,0,0);`)
      const addedDate = await app.request(
        "/me/availability/2026",
        {
          method: "PUT",
          body: JSON.stringify({
            submit: true,
            answers: [
              {
                date: "2026-10-29",
                version: 1,
                choice: "times",
                times: [{ id: crypto.randomUUID(), from: 510, to: 930 }],
              },
              { date: "2026-10-30", version: 1, choice: "no", times: [] },
            ],
          }),
        },
        env,
        context
      )
      expect(addedDate.status).toBe(200)
      expect(
        db
          .prepare(
            "SELECT before_choice,after_choice FROM availability_submission_changes WHERE date='2026-10-30'"
          )
          .get()
      ).toEqual({ before_choice: "unanswered", after_choice: "no" })
      const denied = await app.request(
        `/years/2026/availability-submissions/${memberId}/history`,
        { headers: { "x-test-member": "1" } },
        env
      )
      expect(denied.status).toBe(403)
      const progress = await app.request(
        "/years/2026/availability-submissions",
        {},
        env
      )
      expect(await progress.json()).toMatchObject({
        progress: [{ memberId, hasHistory: true }],
      })
      const otherYear = await app.request(
        `/years/2025/availability-submissions/${memberId}/history`,
        {},
        env
      )
      expect(await otherYear.json()).toEqual({ changes: [] })
    } finally {
      db.close()
    }
  })
})

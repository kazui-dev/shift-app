import * as v from "valibot"
import { availabilitySubmissionsResponseSchema } from "@workspace/shared/shifts"
import { Hono } from "hono"
import { describe, expect, it } from "vite-plus/test"

import type { ApiEnv } from "../../src/lib/http"
import { availabilitySubmissionsApp } from "../../src/features/availability/routes/years/availability-submissions"
import { d1Binding, migrated } from "../support/sqlite"
import { directoryWork } from "../support/directory-work"

const app = new Hono<ApiEnv>()
app.use("*", async (c, next) => {
  c.set("member", {
    id: "m",
    userId: "u",
    displayName: "Aoi",
    accessLevel: "system_admin",
  })
  await next()
})
app.route("/years", availabilitySubmissionsApp)

describe("availability submission progress", () => {
  it("returns client-compatible UUIDs when directory keys are only UUID-shaped", async () => {
    const db = migrated()
    try {
      db.exec(`INSERT INTO operating_years VALUES (2026,0,0);
        INSERT INTO student_directory (id,year,student_id,display_name,created_at)
        VALUES ('11111111-2222-f333-4444-555555555555',2026,'26AJ001','Participant',0);
        INSERT INTO directory_availability_submissions VALUES
        ('11111111-2222-4333-8444-555555555555','11111111-2222-f333-4444-555555555555',0,0,0);
        INSERT INTO availability_dates (id,year,date,created_at,updated_at)
        VALUES ('11111111-2222-4333-8444-555555555556',2026,'2026-10-31',0,0);
        INSERT INTO directory_availability_day_answers VALUES
        ('11111111-2222-4333-8444-555555555555','11111111-2222-4333-8444-555555555556',1,'all');
        INSERT INTO directory_availability_windows VALUES
        ('11111111-2222-4333-8444-555555555557','11111111-2222-4333-8444-555555555555','11111111-2222-4333-8444-555555555556',1793403000000,1793444400000,0);`)
      const response = await app.request(
        "/years/2026/availability-submissions",
        {},
        { shift_app: d1Binding(db) }
      )
      expect(response.status).toBe(200)
      const body = v.parse(
        availabilitySubmissionsResponseSchema,
        await response.json()
      )
      expect(body.progress[0]?.memberId).toBe(
        "11111111-2222-4333-8444-555555555555"
      )
      expect(body.submissions[0]?.member.id).toBe(body.progress[0]?.memberId)
      expect(body.progress[0]?.complete).toBe(true)
      expect(db.prepare("SELECT COUNT(*) AS n FROM app_users").get()?.n).toBe(0)
    } finally {
      db.close()
    }
  })

  it("counts submitted days independently of first sign-in and leaves unknown days incomplete", async () => {
    const db = migrated()
    try {
      db.exec(`INSERT INTO operating_years VALUES (2026,0,0);
        INSERT INTO student_directory (id,year,student_id,display_name,created_at)
        VALUES ('pending',2026,'26AJ001','未サインイン',0);`)
      directoryWork(db, "pending")
      const request = () =>
        app.request(
          "/years/2026/availability-submissions",
          {},
          { shift_app: d1Binding(db) }
        )
      const complete = await request()
      expect(await complete.json()).toMatchObject({
        progress: [{ memberId: "submission", image: null, complete: true }],
        submissions: [{ member: { id: "submission" } }],
      })
      db.exec(`INSERT INTO availability_dates (id,year,date,created_at,updated_at)
        VALUES ('unknown',2026,'2026-11-01',0,0);`)
      const partial = await request()
      expect(await partial.json()).toMatchObject({
        progress: [{ memberId: "submission", complete: false }],
        submissions: [{ member: { id: "submission" } }],
      })
      expect(db.prepare("SELECT COUNT(*) AS n FROM user").get()?.n).toBe(0)
    } finally {
      db.close()
    }
  })

  it("reads each member's avatar from their linked identity", async () => {
    const db = migrated()
    try {
      db.exec(`INSERT INTO operating_years VALUES (2026,0,0);
        INSERT INTO user (id,name,email,image) VALUES ('u','Aoi','aoi@example.com','https://cdn.example/aoi.png');
        INSERT INTO app_users VALUES ('m','u','Aoi','26AJ001','member',0,0);`)
      const response = await app.request(
        "/years/2026/availability-submissions",
        {},
        { shift_app: d1Binding(db) }
      )
      expect(response.status).toBe(200)
      expect(await response.json()).toMatchObject({
        progress: [
          {
            memberId: "m",
            displayName: "Aoi",
            image: "https://cdn.example/aoi.png",
          },
        ],
      })
    } finally {
      db.close()
    }
  })
})

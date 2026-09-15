import { Hono } from "hono"
import { describe, expect, it } from "vite-plus/test"

import type { ApiEnv } from "../../src/lib/http"
import { availabilitySubmissionsApp } from "../../src/routes/years/availability-submissions"
import { d1Binding, migrated } from "../support/sqlite"

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

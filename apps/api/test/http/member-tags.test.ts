import { Hono } from "hono"
import * as v from "valibot"
import { describe, expect, it } from "vite-plus/test"
import { yearTagsResponseSchema } from "@workspace/shared/shifts"
import { yearTagsApp } from "../../src/features/members/routes/years/tags"
import type { ApiEnv } from "../../src/lib/http"
import { migrated, d1Binding } from "../support/sqlite"

const actor = "10000000-0000-4000-8000-000000000001"
const target = "10000000-0000-4000-8000-000000000002"
const outsider = "10000000-0000-4000-8000-000000000003"
const role = "20000000-0000-4000-8000-000000000001"
const missing = "30000000-0000-4000-8000-000000000001"
const context = {
  waitUntil: () => {},
  passThroughOnException: () => {},
  props: {},
}
function fixture() {
  const db = migrated()
  db.exec(`INSERT INTO operating_years VALUES (2026,0,0),(2027,0,0);
    INSERT INTO user (id,name,email) VALUES ('u','管理者','u@example.test'),('v','メンバー','v@example.test'),('w','年度外','w@example.test');
    INSERT INTO app_users VALUES ('${actor}','u','管理者','26AJ001','system_admin',0,0),('${target}','v','メンバー','26AJ002','member',0,0),('${outsider}','w','年度外','26AJ003','member',0,0);
    INSERT OR IGNORE INTO year_memberships VALUES (2026,'${actor}','active',0,0),(2026,'${target}','active',0,0),(2027,'${outsider}','active',0,0);
    DELETE FROM year_memberships WHERE member_id='${outsider}' AND year=2026;
    INSERT INTO year_roles VALUES ('${role}',2026,'メンバー管理','#64748B',0,0,0);
    INSERT INTO member_year_roles VALUES ('${actor}','${role}',0);
    INSERT INTO year_role_permissions VALUES ('${role}','member.manage',0);`)
  const app = new Hono<ApiEnv>()
  app.use("*", async (c, next) => {
    const mode = c.req.header("x-mode")
    c.set("member", {
      id: actor,
      userId: "u",
      displayName: "管理者",
      accessLevel: mode ? "member" : "system_admin",
    })
    if (mode === "denied")
      c.set("member", {
        id: target,
        userId: "v",
        displayName: "メンバー",
        accessLevel: "member",
      })
    return next()
  })
  app.route("/years", yearTagsApp)
  const env = {
    shift_app: d1Binding(db),
    CHAT_DIRECTORY: { getByName: () => ({ broadcast: async () => {} }) },
  }
  const request = (
    path = "tags",
    method = "GET",
    body?: unknown,
    year = 2026,
    mode = ""
  ) =>
    Promise.resolve(
      app.request(
        `/years/${year}/${path}`,
        {
          method,
          headers: { "x-mode": mode, "Content-Type": "application/json" },
          ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        },
        env,
        context
      )
    )
  const list = async (year = 2026) =>
    v.parse(
      yearTagsResponseSchema,
      await (await request("tags", "GET", undefined, year)).json()
    ).tags
  const create = async (name: string, year = 2026) => {
    expect((await request("tags", "POST", { name }, year)).status).toBe(204)
    const tag = (await list(year)).find((item) => item.name === name.trim())
    if (!tag) throw new Error("created tag missing")
    return tag.id
  }
  const change = (
    memberIds: string[],
    addTagIds: string[],
    removeTagIds: string[] = [],
    mode = ""
  ) =>
    request(
      "member-tags",
      "PATCH",
      { memberIds, addTagIds, removeTagIds },
      2026,
      mode
    )
  return { db, request, list, create, change }
}

describe("year member tags", () => {
  it("creates, renames, assigns individually and in bulk, and removes only the requested assignments", async () => {
    const { db, request, list, create, change } = fixture()
    try {
      const tag = await create("  受取済  ")
      const other = await create("準備済")
      expect((await change([target], [tag])).status).toBe(204)
      expect(
        (await change([actor, target, target], [tag, other, other])).status
      ).toBe(204)
      expect(await list()).toEqual(
        expect.arrayContaining([
          { id: tag, name: "受取済", memberIds: [actor, target] },
        ])
      )
      expect((await change([target], [], [tag])).status).toBe(204)
      expect(
        (await request(`tags/${tag}`, "PUT", { name: "変更後" })).status
      ).toBe(204)
      expect(await list()).toEqual(
        expect.arrayContaining([
          { id: tag, name: "変更後", memberIds: [actor] },
          { id: other, name: "準備済", memberIds: [actor, target] },
        ])
      )
      expect(
        db.prepare("SELECT COUNT(*) AS n FROM member_year_roles").get()?.n
      ).toBe(1)
    } finally {
      db.close()
    }
  })
  it("isolates years and refuses invalid targets before applying any part of a bulk change", async () => {
    const { db, request, list, create, change } = fixture()
    try {
      const tag = await create("同名")
      const next = await create("同名", 2027)
      expect((await change([target, outsider], [tag])).status).toBe(409)
      expect((await change([target], [tag, next])).status).toBe(404)
      expect((await change([target], [missing])).status).toBe(404)
      expect(
        (await request(`tags/${next}`, "PUT", { name: "別名" })).status
      ).toBe(404)
      expect((await request(`tags/${next}`, "DELETE")).status).toBe(404)
      expect(await list()).toEqual([{ id: tag, name: "同名", memberIds: [] }])
      expect(await list(2027)).toEqual([
        { id: next, name: "同名", memberIds: [] },
      ])
      db.exec(
        `UPDATE year_memberships SET status='inactive' WHERE member_id='${target}' AND year=2026`
      )
      expect((await change([target], [tag])).status).toBe(409)
    } finally {
      db.close()
    }
  })
  it("requires member management permission for reads and every write, including year isolation for managers", async () => {
    const { db, request, create, change } = fixture()
    try {
      const tag = await create("管理対象")
      const deniedRequests = [
        ["tags", "GET", undefined],
        ["tags", "POST", { name: "不許可" }],
        [`tags/${tag}`, "PUT", { name: "不許可" }],
        [`tags/${tag}`, "DELETE", undefined],
        [
          "member-tags",
          "PATCH",
          { memberIds: [target], addTagIds: [tag], removeTagIds: [] },
        ],
      ] satisfies [string, string, unknown][]
      const denied = await Promise.all(
        deniedRequests.map(([path, method, body]) =>
          request(path, method, body, 2026, "denied")
        )
      )
      expect(denied.map((response) => response.status)).toEqual([
        403, 403, 403, 403, 403,
      ])
      expect(
        (await request("tags", "GET", undefined, 2026, "manager")).status
      ).toBe(200)
      expect((await change([target], [tag], [], "manager")).status).toBe(204)
      expect(
        (
          await request(
            `tags/${tag}`,
            "PUT",
            { name: "管理者更新" },
            2026,
            "manager"
          )
        ).status
      ).toBe(204)
      expect(
        (await request("tags", "GET", undefined, 2027, "manager")).status
      ).toBe(403)
      expect((await request("tags", "GET", undefined, 2030)).status).toBe(404)
    } finally {
      db.close()
    }
  })
  it("validates names, duplicate names, IDs, empty selections, and conflicting changes", async () => {
    const { db, request, create, change } = fixture()
    try {
      const tag = await create("Ready")
      const other = await create("Other")
      const invalidNames = await Promise.all(
        ["", "   ", "a".repeat(101)].map((name) =>
          request("tags", "POST", { name })
        )
      )
      expect(invalidNames.map((response) => response.status)).toEqual([
        422, 422, 422,
      ])
      expect((await request("tags", "POST", { name: " ready " })).status).toBe(
        409
      )
      expect(
        (await request(`tags/${other}`, "PUT", { name: "READY" })).status
      ).toBe(409)
      expect((await request(`tags/${tag}`, "PUT", { name: " " })).status).toBe(
        422
      )
      expect(
        (await request(`tags/${missing}`, "PUT", { name: "名前" })).status
      ).toBe(404)
      expect((await change([], [tag])).status).toBe(422)
      expect((await change([target], [tag], [tag])).status).toBe(422)
      expect((await change(["bad"], [tag])).status).toBe(422)
      expect((await change([target], ["bad"])).status).toBe(422)
      expect((await change([target], [], [])).status).toBe(204)
    } finally {
      db.close()
    }
  })
  it("cascades tag deletion without deleting members, other tags, or assignments in another year", async () => {
    const { db, request, list, create, change } = fixture()
    try {
      const tag = await create("削除対象")
      const other = await create("保持")
      const next = await create("削除対象", 2027)
      expect((await change([actor, target], [tag, other])).status).toBe(204)
      expect((await request(`tags/${tag}`, "DELETE")).status).toBe(204)
      expect((await request(`tags/${tag}`, "DELETE")).status).toBe(404)
      expect(await list()).toEqual([
        { id: other, name: "保持", memberIds: [actor, target] },
      ])
      expect(await list(2027)).toEqual([
        { id: next, name: "削除対象", memberIds: [] },
      ])
      expect(db.prepare("SELECT COUNT(*) AS n FROM app_users").get()?.n).toBe(3)
      expect(
        db
          .prepare("SELECT COUNT(*) AS n FROM member_year_tags WHERE tag_id=?")
          .get(tag)?.n
      ).toBe(0)
    } finally {
      db.close()
    }
  })
})

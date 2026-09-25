import { DatabaseSync, type SQLInputValue } from "node:sqlite"
import { Hono } from "hono"
import { expect, it } from "vite-plus/test"
import type { ApiEnv } from "../../src/lib/http"
import { withMemberImages } from "../../src/features/chat/services/chat-profiles"
it("resolves current profile images without modifying stored posts", async () => {
  const db = new DatabaseSync(":memory:")
  try {
    db.exec(
      "CREATE TABLE user(id TEXT,image TEXT);CREATE TABLE app_users(id TEXT,user_id TEXT);INSERT INTO user VALUES('u','https://cdn.discordapp.com/embed/avatars/0.png');INSERT INTO app_users VALUES('m','u');INSERT INTO user VALUES('u2','https://cdn.discordapp.com/embed/avatars/2.png');INSERT INTO app_users VALUES('m2','u2')"
    )
    const env = {
      shift_app: {
        prepare: (sql: string) => ({
          bind: (...values: SQLInputValue[]) => {
            if (values.length > 100) throw Error("Too many bound parameters")
            return {
              all: () =>
                Promise.resolve({ results: db.prepare(sql).all(...values) }),
            }
          },
        }),
      },
    }
    const messages = [
      { id: "post", memberId: "m", content: "既存の本文" },
      {
        id: "missing",
        memberId: "gone",
        content: "本文",
        reply: { memberId: "m2", content: "返信元" },
      },
    ]
    const app = new Hono<ApiEnv>()
    app.get("/", async (c) => c.json(await withMemberImages(c.env, messages)))
    const page = Array.from({ length: 100 }, (_, index) => ({
      memberId: `writer-${index}`,
      reply: { memberId: `target-${index}`, content: "返信元" },
    }))
    app.get("/history", async (c) =>
      c.json(await withMemberImages(c.env, page))
    )
    expect(await (await app.request("/", {}, env)).json()).toEqual([
      {
        ...messages[0],
        memberImage: "https://cdn.discordapp.com/embed/avatars/0.png",
      },
      {
        ...messages[1],
        memberImage: null,
        reply: {
          memberId: "m2",
          content: "返信元",
          memberImage: "https://cdn.discordapp.com/embed/avatars/2.png",
        },
      },
    ])
    db.exec(
      "UPDATE user SET image='https://cdn.discordapp.com/embed/avatars/1.png'"
    )
    expect(await (await app.request("/", {}, env)).json()).toMatchObject([
      {
        id: "post",
        content: "既存の本文",
        memberImage: "https://cdn.discordapp.com/embed/avatars/1.png",
      },
      {
        id: "missing",
        memberImage: null,
        reply: {
          memberImage: "https://cdn.discordapp.com/embed/avatars/1.png",
        },
      },
    ])
    expect(messages[0]).toEqual({
      id: "post",
      memberId: "m",
      content: "既存の本文",
    })
    const response = await app.request("/history", {}, env)
    expect(response.status).toBe(200)
    expect(await response.json()).toHaveLength(100)
  } finally {
    db.close()
  }
})

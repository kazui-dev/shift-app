import { eq } from "drizzle-orm"
import { drizzle } from "drizzle-orm/d1"
import { Hono } from "hono"
import { bodyLimit } from "hono/body-limit"

import { appUsers } from "@workspace/db/schema"

import { createAuth } from "../../auth"
import { apiErrorBody, requireSameOriginForMutation } from "../../lib/http"
import { adminCommandsApp } from "./commands"
import type { AdminEnv } from "./context"
import { adminQueriesApp } from "./queries"

export const adminApp = new Hono<AdminEnv>()

adminApp.use(
  "*",
  bodyLimit({
    maxSize: 4 * 1024,
    onError: (c) =>
      c.json(apiErrorBody("BODY_TOO_LARGE", "Request body is too large"), 413),
  })
)
adminApp.use("*", requireSameOriginForMutation)

adminApp.use("*", async (c, next) => {
  const auth = createAuth(c.env)
  const authSession = await auth.api.getSession({
    headers: c.req.raw.headers,
  })
  if (!authSession) {
    return c.json(
      apiErrorBody("UNAUTHORIZED", "Authentication is required"),
      401
    )
  }

  const db = drizzle(c.env.shift_app)
  const [member] = await db
    .select({
      id: appUsers.id,
      userId: appUsers.userId,
      accessLevel: appUsers.accessLevel,
    })
    .from(appUsers)
    .where(eq(appUsers.userId, authSession.user.id))
    .limit(1)

  if (!member || member.accessLevel !== "system_admin") {
    return c.json(
      apiErrorBody("FORBIDDEN", "System administrator access is required"),
      403
    )
  }

  c.set("adminUser", { id: member.id, userId: member.userId })
  c.header("Cache-Control", "private, no-store")
  return next()
})

adminApp.route("/", adminQueriesApp)
adminApp.route("/", adminCommandsApp)

import { Hono } from "hono"
import { bodyLimit } from "hono/body-limit"

import {
  apiError,
  type ApiEnv,
  requireMember,
  requireSameOriginForMutation,
} from "../lib/http"
import { activitiesApp } from "./activities"
import { assignmentsApp } from "./assignments"
import { chatApp } from "./chat"
import { chatTargetsApp } from "./chat-targets"
import { meApp } from "./me/index"
import { pushApp } from "./push"
import { reportsApp } from "./reports"
import { rolesApp } from "./roles"
import { yearsApp } from "./years/index"

export const apiApp = new Hono<ApiEnv>()

apiApp.use(
  "*",
  bodyLimit({
    maxSize: 32 * 1024,
    onError: (c) =>
      c.json(
        {
          error: {
            code: "BODY_TOO_LARGE",
            message: "Request body is too large",
          },
        },
        413
      ),
  })
)
apiApp.use("*", requireMember)
apiApp.use("*", requireSameOriginForMutation)

apiApp.route("/me", meApp)
apiApp.route("/push", pushApp)
apiApp.route("/years", yearsApp)
apiApp.route("/roles", rolesApp)
apiApp.route("/activities", activitiesApp)
apiApp.route("/assignments", assignmentsApp)
apiApp.route("/chat", chatTargetsApp)
apiApp.route("/chat", chatApp)
apiApp.route("/reports", reportsApp)

apiApp.notFound((c) => apiError(c, 404, "NOT_FOUND", "API route not found"))

apiApp.onError((error, c) => {
  console.error(
    JSON.stringify({
      message: "Unhandled shift API error",
      error: error.message,
      path: new URL(c.req.url).pathname,
    })
  )
  return apiError(c, 500, "INTERNAL_ERROR", "Internal server error")
})

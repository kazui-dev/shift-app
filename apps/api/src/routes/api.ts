import { Hono } from "hono"
import { bodyLimit } from "hono/body-limit"

import { apiError, errors } from "../lib/errors"
import {
  type ApiEnv,
  requireMember,
  requireSameOriginForMutation,
} from "../lib/http"
import { activitiesApp } from "./activities"
import { assignmentsApp } from "./assignments"
import { chatApp } from "./chat/index"
import { meApp } from "./me/index"
import { pushApp, notificationDevicesApp } from "./push"
import { reportsApp } from "./reports"
import { rolesApp } from "./roles"
import { yearSettingsApp } from "./year-settings"
import { yearsApp } from "./years/index"

export const apiApp = new Hono<ApiEnv>()

apiApp.use("*", (c, next) =>
  bodyLimit({
    maxSize:
      c.req.method === "POST" &&
      /^\/api\/chat\/rooms\/[^/]+\/attachments$/.test(c.req.path)
        ? 10 * 1024 * 1024
        : 32 * 1024,
    onError: (context) => apiError(context, errors.bodyTooLarge),
  })(c, next)
)
apiApp.use("*", requireMember)
apiApp.use("*", requireSameOriginForMutation)

apiApp.route("/me", meApp)
apiApp.route("/push", pushApp)
apiApp.route("/me/notification-devices", notificationDevicesApp)
apiApp.route("/years", yearsApp)
apiApp.route("/year-settings", yearSettingsApp)
apiApp.route("/roles", rolesApp)
apiApp.route("/activities", activitiesApp)
apiApp.route("/assignments", assignmentsApp)
apiApp.route("/chat", chatApp)
apiApp.route("/reports", reportsApp)

apiApp.notFound((c) => apiError(c, errors.routeNotFound))

apiApp.onError((error, c) => {
  console.error(
    JSON.stringify({
      message: "Unhandled shift API error",
      error: error.message,
      path: new URL(c.req.url).pathname,
    })
  )
  return apiError(c, errors.internalError)
})

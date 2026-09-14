import { Hono } from "hono"

import { apiError, errors } from "../lib/errors"

import {
  type ApiEnv,
  limitRequestBody,
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

apiApp.use("*", limitRequestBody)
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

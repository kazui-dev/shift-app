import { Hono } from "hono"

import { apiError, errors } from "../lib/errors"

import {
  type ApiEnv,
  limitRequestBody,
  requireMember,
  requireSameOriginForMutation,
} from "../lib/http"
import { activitiesApp } from "../features/activities/routes/activities"
import { assignmentsApp } from "../features/assignments/routes/assignments"
import { chatApp } from "../features/chat/routes/index"
import { openLiveEvents } from "../features/live/routes/events"
import { meApp } from "./me/index"
import { membersApp } from "../features/members/routes/members"
import {
  pushApp,
  notificationDevicesApp,
} from "../features/notifications/routes/push"
import { rolesApp } from "../features/roles/routes/roles"
import { yearSettingsApp } from "../features/years/routes/year-settings"
import { yearsApp } from "./years/index"

export const apiApp = new Hono<ApiEnv>()

apiApp.use("*", limitRequestBody)
apiApp.use("*", requireMember)
apiApp.use("*", requireSameOriginForMutation)

apiApp.get("/events", openLiveEvents)
apiApp.route("/me", meApp)
apiApp.route("/members", membersApp)
apiApp.route("/push", pushApp)
apiApp.route("/me/notification-devices", notificationDevicesApp)
apiApp.route("/years", yearsApp)
apiApp.route("/year-settings", yearSettingsApp)
apiApp.route("/roles", rolesApp)
apiApp.route("/activities", activitiesApp)
apiApp.route("/assignments", assignmentsApp)
apiApp.route("/chat", chatApp)

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

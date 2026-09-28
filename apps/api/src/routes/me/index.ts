import { chatMembershipsApp } from "../../features/chat/routes/me/chat-memberships"
import { Hono } from "hono"

import type { ApiEnv } from "../../lib/http"
import { meAssignmentsApp } from "../../features/assignments/routes/me/assignments"
import { meAvailabilityApp } from "../../features/availability/routes/me/availability"
import { meAvatarApp } from "../../features/account/routes/me/avatar"

import { displayYearApp } from "../../features/years/routes/me/display-year"

export const meApp = new Hono<ApiEnv>()

meApp.route("/", meAssignmentsApp)
meApp.route("/availability", meAvailabilityApp)
meApp.route("/avatar", meAvatarApp)

meApp.route("/display-year", displayYearApp)

meApp.route("/chat-memberships", chatMembershipsApp)

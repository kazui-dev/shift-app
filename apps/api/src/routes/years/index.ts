import { memberRolesApp } from "../../features/roles/routes/years/member-roles"
import { Hono } from "hono"

import type { ApiEnv } from "../../lib/http"
import { yearActivitiesApp } from "../../features/activities/routes/years/activities"
import { availabilityDatesApp } from "../../features/availability/routes/years/availability-dates"
import { availabilitySubmissionsApp } from "../../features/availability/routes/years/availability-submissions"
import { yearLifecycleApp } from "../../features/years/routes/lifecycle"
import { yearMembershipsApp } from "../../features/members/routes/years/memberships"
import { yearRolesApp } from "../../features/roles/routes/years/roles"
import { rosterApp } from "../../features/members/routes/years/roster"

export const yearsApp = new Hono<ApiEnv>()

yearsApp.route("/", yearLifecycleApp)
yearsApp.route("/", yearRolesApp)
yearsApp.route("/", rosterApp)
yearsApp.route("/", yearActivitiesApp)
yearsApp.route("/", availabilityDatesApp)
yearsApp.route("/", availabilitySubmissionsApp)
yearsApp.route("/", yearMembershipsApp)

yearsApp.route("/", memberRolesApp)

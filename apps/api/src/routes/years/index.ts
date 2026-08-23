import { Hono } from "hono"

import type { ApiEnv } from "../../lib/http"
import { yearActivitiesApp } from "./activities"
import { availabilityDatesApp } from "./availability-dates"
import { availabilitySubmissionsApp } from "./availability-submissions"
import { yearLifecycleApp } from "./lifecycle"
import { yearMembershipsApp } from "./memberships"
import { yearReportsApp } from "./reports"
import { yearRolesApp } from "./roles"
import { rosterApp } from "./roster"

export const yearsApp = new Hono<ApiEnv>()

yearsApp.route("/", yearLifecycleApp)
yearsApp.route("/", yearRolesApp)
yearsApp.route("/", rosterApp)
yearsApp.route("/", yearActivitiesApp)
yearsApp.route("/", availabilityDatesApp)
yearsApp.route("/", availabilitySubmissionsApp)
yearsApp.route("/", yearMembershipsApp)
yearsApp.route("/", yearReportsApp)

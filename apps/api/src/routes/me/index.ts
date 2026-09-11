import { Hono } from "hono"

import type { ApiEnv } from "../../lib/http"
import { meAssignmentsApp } from "./assignments"
import { meAvailabilityApp } from "./availability"

import { displayYearApp } from "./display-year"

export const meApp = new Hono<ApiEnv>()

meApp.route("/", meAssignmentsApp)
meApp.route("/availability", meAvailabilityApp)

meApp.route("/display-year", displayYearApp)

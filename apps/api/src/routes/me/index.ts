import { Hono } from "hono"

import type { ApiEnv } from "../../lib/http"
import { meAvailabilityApp } from "./availability"
import { timelineApp } from "./timeline"

export const meApp = new Hono<ApiEnv>()

meApp.route("/", timelineApp)
meApp.route("/availability", meAvailabilityApp)

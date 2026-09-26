import { Hono } from "hono"
import type { ApiEnv } from "../../../lib/http"
import { roleSettingsApp } from "./role-settings"
export const rolesApp = new Hono<ApiEnv>()
rolesApp.route("/", roleSettingsApp)

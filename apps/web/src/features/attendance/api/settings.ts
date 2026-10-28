import * as v from "valibot"
import {
  attendanceSettingsSchema,
  type AttendanceSettings,
} from "@workspace/shared/shifts"
import { apiJson, apiVoid } from "@/lib/http/client"
export const getAttendanceSettings = (year: number) =>
  apiJson(`/api/years/${year}/attendance-settings`, attendanceSettingsSchema)
export const saveAttendanceSettings = (
  year: number,
  settings: AttendanceSettings
) =>
  apiVoid(`/api/years/${year}/attendance-settings`, {
    method: "PUT",
    body: JSON.stringify(v.parse(attendanceSettingsSchema, settings)),
  })

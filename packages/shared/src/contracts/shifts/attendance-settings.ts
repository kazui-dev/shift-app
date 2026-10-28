import * as v from "valibot"
const ids = v.pipe(
  v.array(v.pipe(v.string(), v.uuid())),
  v.maxLength(10000),
  v.check(
    (values) => new Set(values).size === values.length,
    "対象が重複しています。"
  )
)
export const attendanceSettingsSchema = v.strictObject({
  noticeAudience: v.picklist(["selected", "room_members"]),
  roleIds: ids,
  memberIds: ids,
})
export type AttendanceSettings = v.InferOutput<typeof attendanceSettingsSchema>

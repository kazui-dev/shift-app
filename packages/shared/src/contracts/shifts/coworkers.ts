import * as v from "valibot"
import { instantSchema } from "./common"
import { attendanceSchema } from "./attendance"

const shiftCoworkerSchema = v.object({
  id: v.pipe(v.string(), v.uuid()),
  activityId: v.pipe(v.string(), v.uuid()),
  memberId: v.pipe(v.string(), v.uuid()),
  name: v.string(),
  studentId: v.string(),
  startsAt: instantSchema,
  endsAt: instantSchema,
  attendance: v.nullable(
    v.pick(attendanceSchema, ["state", "checkInStatus", "expectedAt"])
  ),
})

export const shiftCoworkersResponseSchema = v.object({
  members: v.array(shiftCoworkerSchema),
})
export type ShiftCoworker = v.InferOutput<typeof shiftCoworkerSchema>

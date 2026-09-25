import * as v from "valibot"
import { instantSchema } from "./common"
import { attendanceSchema } from "./attendance"

export const assignmentResponseSchema = v.object({
  id: v.pipe(v.string(), v.uuid()),
  roomId: v.nullable(v.pipe(v.string(), v.uuid())),
  activityId: v.pipe(v.string(), v.uuid()),
  memberId: v.pipe(v.string(), v.uuid()),
  memberDisplayName: v.string(),
  startsAt: instantSchema,
  endsAt: instantSchema,
  notes: v.nullable(v.string()),
  attendance: v.optional(v.nullable(attendanceSchema)),
})

export const myAssignmentResponseSchema = v.object({
  ...assignmentResponseSchema.entries,
  activityName: v.string(),
  place: v.string(),
  activityType: v.string(),
  color: v.string(),
})

export const assignmentMutationResponseSchema = v.object({
  assignment: assignmentResponseSchema,
  warnings: v.array(v.picklist(["OUTSIDE_SUBMITTED_AVAILABILITY"])),
})

export const myAssignmentsResponseSchema = v.object({
  assignments: v.array(myAssignmentResponseSchema),
})

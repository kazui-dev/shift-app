import * as v from "valibot"
import { activityEditorResponseSchema } from "./activities"
import { attendanceSchema } from "./attendance"
import { instantSchema } from "./common"

export const shiftOverviewResponseSchema = v.object({
  canEdit: v.boolean(),
  members: activityEditorResponseSchema.entries.members,
  roles: activityEditorResponseSchema.entries.roles,
  availability: activityEditorResponseSchema.entries.availability,
  availabilityAnswers: activityEditorResponseSchema.entries.availabilityAnswers,
  activities: v.array(
    v.object({
      id: v.string(),
      name: v.string(),
      color: v.string(),
      active: v.boolean(),
      startsAt: instantSchema,
      endsAt: instantSchema,
    })
  ),
  assignments: v.array(
    v.object({
      id: v.string(),
      slotId: v.string(),
      activityId: v.string(),
      memberId: v.string(),
      startsAt: instantSchema,
      endsAt: instantSchema,
      attendance: v.nullable(
        v.pick(attendanceSchema, [
          "state",
          "checkInStatus",
          "checkedInAt",
          "expectedAt",
          "resolvedAt",
        ])
      ),
    })
  ),
})
export type ShiftOverview = v.InferOutput<typeof shiftOverviewResponseSchema>

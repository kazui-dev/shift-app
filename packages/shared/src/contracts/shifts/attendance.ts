import * as v from "valibot"
import { instantSchema } from "./common"

const attendanceReasonSchema = v.optional(
  v.pipe(v.string(), v.trim(), v.maxLength(1000)),
  ""
)

/** What a member sets for their own shift: checked in, late or absent. */

export const submitAttendanceInputSchema = v.variant("state", [
  v.strictObject({
    state: v.literal("present"),
    locationConfirmed: v.boolean(),
  }),
  v.strictObject({
    state: v.literal("late"),
    expectedAt: v.optional(v.nullable(instantSchema), null),
    reason: attendanceReasonSchema,
  }),
  v.strictObject({
    state: v.literal("absent"),
    reason: attendanceReasonSchema,
  }),
])

/** What a responsible does: correct a check-in, or mark late or absent as handled. */

export const manageAttendanceInputSchema = v.variant("action", [
  v.strictObject({
    action: v.literal("correct"),
    checkedInAt: instantSchema,
    reason: v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(1000)),
  }),
  v.strictObject({ action: v.literal("resolve") }),
])

/** An assignment's attendance as members and responsibles see it. */

export const attendanceSchema = v.object({
  state: v.picklist(["late", "absent", "present"]),
  expectedAt: v.nullable(instantSchema),
  reason: v.string(),
  checkedInAt: v.nullable(instantSchema),
  checkInStatus: v.nullable(v.picklist(["pending", "confirmed"])),
  resolvedAt: v.nullable(instantSchema),
  updatedAt: instantSchema,
})

export type Attendance = v.InferOutput<typeof attendanceSchema>

export const attendanceEnvelopeSchema = v.object({
  attendance: v.nullable(attendanceSchema),
})

export const shiftAttendanceResponseSchema = v.object({
  canManage: v.boolean(),
  assignments: v.array(
    v.object({
      id: v.string(),
      own: v.boolean(),
      memberId: v.string(),
      memberDisplayName: v.string(),
      startsAt: instantSchema,
      endsAt: instantSchema,
      active: v.boolean(),
      attendance: v.nullable(attendanceSchema),
    })
  ),
})

export const attendanceEventsResponseSchema = v.object({
  events: v.array(
    v.object({
      id: v.string(),
      actor: v.string(),
      action: v.picklist([
        "late",
        "absent",
        "withdrawn",
        "checked_in",
        "corrected",
        "resolved",
      ]),
      expectedAt: v.nullable(instantSchema),
      checkedInAt: v.nullable(instantSchema),
      previousCheckedInAt: v.nullable(instantSchema),
      reason: v.string(),
      createdAt: instantSchema,
    })
  ),
})

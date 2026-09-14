import * as v from "valibot"
import { japanDateStart, japanDateTime } from "./japan-time"

export const operatingYearSchema = v.pipe(
  v.unknown(),
  v.toNumber(),
  v.integer(),
  v.minValue(2000),
  v.maxValue(2100)
)
export const shiftPermissionSchema = v.picklist([
  "shift.create",
  "shift.manage",
  "member.manage",
  "role.manage",
])

const dateOnlyPattern = /^\d{4}-\d{2}-\d{2}$/

export const dateOnlySchema = v.pipe(
  v.string(),
  v.check((value) => {
    if (!dateOnlyPattern.test(value)) {
      return false
    }
    const date = new Date(`${value}T00:00:00.000Z`)
    return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value)
  }, "日付をYYYY-MM-DD形式で入力してください")
)

const instantPattern =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/

export const instantSchema = v.pipe(
  v.string(),
  v.check(
    (value) => instantPattern.test(value) && !Number.isNaN(Date.parse(value)),
    "Invalid datetime"
  )
)

function isOrdered(start: string, end: string): boolean {
  return Date.parse(start) < Date.parse(end)
}

function dateInJapan(value: string): string {
  return japanDateTime(value).date
}

const timeWindowEntries = {
  startsAt: instantSchema,
  endsAt: instantSchema,
}

const orderedWindowCheck = v.forward(
  v.check(
    (value: { startsAt: string; endsAt: string }) =>
      isOrdered(value.startsAt, value.endsAt),
    "終了日時は開始日時より後にしてください"
  ),
  ["endsAt"]
)

export const timeWindowSchema = v.pipe(
  v.object(timeWindowEntries),
  orderedWindowCheck
)

const availabilityWindowEntries = {
  date: dateOnlySchema,
  ...timeWindowEntries,
}

type AvailabilityWindowValue = {
  date: string
  startsAt: string
  endsAt: string
}

export const availabilityWindowSchema = v.pipe(
  v.object(availabilityWindowEntries),
  v.forward(
    v.check(
      (value: AvailabilityWindowValue) =>
        isOrdered(value.startsAt, value.endsAt),
      "終了日時は開始日時より後にしてください"
    ),
    ["endsAt"]
  ),
  v.forward(
    v.check(
      (value: AvailabilityWindowValue) =>
        dateInJapan(value.startsAt) === value.date &&
        (dateInJapan(value.endsAt) === value.date ||
          Date.parse(value.endsAt) === japanDateStart(value.date) + 86_400_000),
      "希望時間帯は同じ日付の中で入力してください"
    ),
    ["date"]
  )
)

const availabilityWindowResponseSchema = v.intersect([
  availabilityWindowSchema,
  v.object({ id: v.optional(v.pipe(v.string(), v.uuid())) }),
])

const availabilityWindowWithIdResponseSchema = v.intersect([
  availabilityWindowSchema,
  v.object({ id: v.pipe(v.string(), v.uuid()) }),
])

export const createOperatingYearInputSchema = v.strictObject({
  year: operatingYearSchema,
})

export const replaceYearSettingsInputSchema = v.strictObject({
  defaultYear: operatingYearSchema,
})

export const yearSettingsResponseSchema = v.object({
  defaultYear: v.nullable(operatingYearSchema),
})

export const createYearRoleInputSchema = v.object({
  name: v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(80)),
  color: v.pipe(
    v.string(),
    v.regex(/^#[0-9A-Fa-f]{6}$/),
    v.transform((value) => value.toUpperCase())
  ),
  permissions: v.optional(
    v.pipe(v.array(shiftPermissionSchema), v.maxLength(16)),
    []
  ),
})

const activityFields = {
  name: v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(120)),
  place: v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(120)),
  activityType: v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(80)),
  startsAt: instantSchema,
  endsAt: instantSchema,
  color: v.pipe(
    v.string(),
    v.regex(/^#[0-9A-Fa-f]{6}$/),
    v.transform((value) => value.toUpperCase())
  ),
  notes: v.optional(
    v.nullable(v.pipe(v.string(), v.trim(), v.maxLength(2000))),
    null
  ),
}

const responsibleSchema = v.object({
  targetType: v.picklist(["member", "role"]),
  targetId: v.pipe(v.string(), v.uuid()),
})
export const createActivityInputSchema = v.pipe(
  v.object({
    ...activityFields,
    responsibles: v.optional(
      v.pipe(v.array(responsibleSchema), v.maxLength(100)),
      []
    ),
    candidateRoleIds: v.optional(
      v.pipe(v.array(v.pipe(v.string(), v.uuid())), v.maxLength(100)),
      []
    ),
  }),
  v.forward(
    v.check(
      (value) => isOrdered(value.startsAt, value.endsAt),
      "終了日時は開始日時より後にしてください"
    ),
    ["endsAt"]
  )
)

export const replaceAvailabilityInputSchema = v.pipe(
  v.object({
    status: v.picklist(["draft", "submitted"]),
    windows: v.pipe(v.array(availabilityWindowSchema), v.maxLength(64)),
  }),
  v.forward(
    v.check((value) => {
      const windows = [...value.windows].sort(
        (left, right) => Date.parse(left.startsAt) - Date.parse(right.startsAt)
      )
      for (let index = 1; index < windows.length; index += 1) {
        const previous = windows[index - 1]
        const current = windows[index]
        if (
          previous &&
          current &&
          Date.parse(previous.endsAt) > Date.parse(current.startsAt)
        ) {
          return false
        }
      }
      return true
    }, "希望時間帯を重複させることはできません"),
    ["windows"]
  )
)

/** A reason, which may be left out when there is no time to write one. */
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

export const operatingYearResponseSchema = v.object({
  year: operatingYearSchema,
  isDefault: v.boolean(),
})

export const activityResponseSchema = v.object({
  active: v.boolean(),
  version: v.number(),
  id: v.pipe(v.string(), v.uuid()),
  year: operatingYearSchema,
  name: v.string(),
  place: v.string(),
  activityType: v.string(),
  startsAt: instantSchema,
  endsAt: instantSchema,
  color: v.string(),
  notes: v.nullable(v.string()),
})

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

export const yearRoleResponseSchema = v.object({
  id: v.pipe(v.string(), v.uuid()),
  year: operatingYearSchema,
  position: v.number(),
  name: v.string(),
  color: v.string(),
  permissions: v.array(shiftPermissionSchema),
  memberCount: v.pipe(v.unknown(), v.toNumber(), v.integer(), v.minValue(0)),
})

export const yearMemberResponseSchema = v.object({
  image: v.nullable(v.pipe(v.string(), v.url())),
  id: v.pipe(v.string(), v.uuid()),
  displayName: v.string(),
  studentId: v.string(),
  roles: v.array(
    v.object({
      id: v.pipe(v.string(), v.uuid()),
      name: v.string(),
      color: v.string(),
    })
  ),
})

export const yearMembershipResponseSchema = v.object({
  year: operatingYearSchema,
  member: v.object({
    image: v.nullable(v.pipe(v.string(), v.url())),
    id: v.pipe(v.string(), v.uuid()),
    displayName: v.string(),
    studentId: v.string(),
  }),
  status: v.nullable(v.picklist(["active", "inactive"])),
  updatedAt: v.nullable(instantSchema),
})

export const availabilityResponseSchema = v.object({
  year: operatingYearSchema,
  status: v.picklist(["draft", "submitted"]),
  submittedAt: v.nullable(instantSchema),
  updatedAt: v.optional(instantSchema),
  dates: v.array(dateOnlySchema),
  windows: v.array(availabilityWindowResponseSchema),
})

export const availabilitySubmissionResponseSchema = v.object({
  id: v.pipe(v.string(), v.uuid()),
  member: v.object({
    id: v.pipe(v.string(), v.uuid()),
    displayName: v.string(),
    studentId: v.string(),
  }),
  status: v.picklist(["draft", "submitted"]),
  submittedAt: v.nullable(instantSchema),
  windows: v.array(availabilityWindowWithIdResponseSchema),
})

export const myAssignmentResponseSchema = v.object({
  ...assignmentResponseSchema.entries,
  activityName: v.string(),
  place: v.string(),
  activityType: v.string(),
  color: v.string(),
})

export const yearsResponseSchema = v.object({
  years: v.array(
    v.object({
      ...operatingYearResponseSchema.entries,
      canManage: v.boolean(),
    })
  ),
})

export const yearRolesResponseSchema = v.object({
  authority: v.object({
    systemAdmin: v.boolean(),
    position: v.nullable(v.number()),
    permissions: v.array(shiftPermissionSchema),
  }),
  roles: v.array(yearRoleResponseSchema),
})

export const rosterResponseSchema = v.object({
  members: v.array(yearMemberResponseSchema),
})

export const yearMembershipsResponseSchema = v.object({
  memberships: v.array(yearMembershipResponseSchema),
})

export const yearMembershipEnvelopeSchema = v.object({
  membership: v.object({
    ...yearMembershipResponseSchema.entries,
    status: v.picklist(["active", "inactive"]),
    updatedAt: instantSchema,
  }),
})

export const activitiesResponseSchema = v.object({
  activities: v.array(
    v.object({
      ...activityResponseSchema.entries,
      assignmentCount: v.pipe(
        v.unknown(),
        v.toNumber(),
        v.integer(),
        v.minValue(0)
      ),
    })
  ),
})

export const operatingYearEnvelopeSchema = v.object({
  year: operatingYearResponseSchema,
})

export const yearRoleEnvelopeSchema = v.object({
  role: v.omit(yearRoleResponseSchema, ["memberCount"]),
})

export const activityEnvelopeSchema = v.object({
  activity: v.object({
    ...activityResponseSchema.entries,
    assignmentCount: v.optional(
      v.pipe(v.unknown(), v.toNumber(), v.integer(), v.minValue(0))
    ),
  }),
})

export const roleMembershipResponseSchema = v.object({
  membership: v.object({
    roleId: v.pipe(v.string(), v.uuid()),
    memberId: v.pipe(v.string(), v.uuid()),
  }),
})

export const attendanceEnvelopeSchema = v.object({
  attendance: v.nullable(attendanceSchema),
})

export const availabilityEnvelopeSchema = v.object({
  availability: availabilityResponseSchema,
})

export const availabilitySubmissionsResponseSchema = v.object({
  progress: v.array(
    v.object({
      memberId: v.string(),
      displayName: v.string(),
      studentId: v.string(),
      complete: v.boolean(),
    })
  ),
  submissions: v.array(availabilitySubmissionResponseSchema),
})

export const createAvailabilityDateInputSchema = v.object({
  date: dateOnlySchema,
})

export const availabilityDatesResponseSchema = v.object({
  dates: v.array(dateOnlySchema),
})

export const availabilityDateEnvelopeSchema = v.object({
  date: dateOnlySchema,
})

export const assignmentMutationResponseSchema = v.object({
  assignment: assignmentResponseSchema,
  warnings: v.array(v.picklist(["OUTSIDE_SUBMITTED_AVAILABILITY"])),
})

export const myAssignmentsResponseSchema = v.object({
  assignments: v.array(myAssignmentResponseSchema),
})

export const apiErrorSchema = v.object({
  error: v.object({
    code: v.string(),
    message: v.string(),
  }),
})

export type ShiftPermission = v.InferOutput<typeof shiftPermissionSchema>

export const displayYearInputSchema = v.strictObject({
  year: operatingYearSchema,
})
export const displayYearResponseSchema = v.object({
  year: v.nullable(operatingYearSchema),
  defaultYear: v.nullable(operatingYearSchema),
  unavailableSelection: v.boolean(),
  years: v.array(operatingYearSchema),
})

export const updateRoleInputSchema = v.strictObject({
  name: v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(80)),
  color: v.pipe(v.string(), v.regex(/^#[0-9a-fA-F]{6}$/)),
  permissions: v.array(shiftPermissionSchema),
})
export const reorderRoleInputSchema = v.strictObject({
  roleIds: v.pipe(
    v.array(v.pipe(v.string(), v.uuid())),
    v.minLength(1),
    v.maxLength(200)
  ),
})
export const memberRoleChangesSchema = v.strictObject({
  memberIds: v.pipe(
    v.array(v.pipe(v.string(), v.uuid())),
    v.minLength(1),
    v.maxLength(200)
  ),
  addRoleIds: v.pipe(v.array(v.pipe(v.string(), v.uuid())), v.maxLength(50)),
  removeRoleIds: v.pipe(v.array(v.pipe(v.string(), v.uuid())), v.maxLength(50)),
})

const slotSchema = v.object({
  id: v.pipe(v.string(), v.uuid()),
  startsAt: instantSchema,
  endsAt: instantSchema,
  capacity: v.nullable(v.pipe(v.number(), v.integer(), v.minValue(1))),
  memberIds: v.pipe(v.array(v.pipe(v.string(), v.uuid())), v.maxLength(500)),
})
export const activityEditorInputSchema = v.object({
  ...activityFields,
  version: v.pipe(v.number(), v.integer(), v.minValue(1)),
  active: v.boolean(),
  candidateRoleIds: v.optional(
    v.pipe(v.array(v.pipe(v.string(), v.uuid())), v.maxLength(100)),
    []
  ),
  responsibles: v.pipe(v.array(responsibleSchema), v.maxLength(100)),
  slots: v.pipe(v.array(slotSchema), v.maxLength(200)),
})
export const activityEditorResponseSchema = v.object({
  activity: v.object({
    ...activityResponseSchema.entries,
    active: v.boolean(),
    version: v.number(),
  }),
  candidateRoleIds: v.array(v.string()),
  responsibles: v.array(responsibleSchema),
  slots: v.array(slotSchema),
  members: v.array(yearMemberResponseSchema),
  roles: v.array(
    v.object({ id: v.string(), name: v.string(), color: v.string() })
  ),
  availability: v.array(
    v.object({
      memberId: v.string(),
      startsAt: instantSchema,
      endsAt: instantSchema,
    })
  ),
  submittedMemberIds: v.array(v.string()),
  otherAssignments: v.array(
    v.object({
      memberId: v.string(),
      startsAt: instantSchema,
      endsAt: instantSchema,
      name: v.string(),
    })
  ),
})
export type ActivityEditorInput = v.InferOutput<
  typeof activityEditorInputSchema
>

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

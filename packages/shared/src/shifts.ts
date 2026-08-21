import * as v from "valibot"

export const operatingYearSchema = v.pipe(
  v.unknown(),
  v.toNumber(),
  v.integer(),
  v.minValue(2000),
  v.maxValue(2100)
)
export const yearStatusSchema = v.picklist(["draft", "active", "archived"])
export const shiftPermissionSchema = v.picklist(["shift.manage"])

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

export const createOperatingYearInputSchema = v.object({
  year: operatingYearSchema,
  status: v.optional(yearStatusSchema, "draft"),
})

export const updateOperatingYearInputSchema = v.object({
  status: yearStatusSchema,
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

export const createActivityInputSchema = v.pipe(
  v.object(activityFields),
  v.forward(
    v.check(
      (value) => isOrdered(value.startsAt, value.endsAt),
      "終了日時は開始日時より後にしてください"
    ),
    ["endsAt"]
  )
)

export const updateActivityInputSchema = v.pipe(
  v.object({
    name: v.optional(activityFields.name),
    place: v.optional(activityFields.place),
    activityType: v.optional(activityFields.activityType),
    startsAt: v.optional(activityFields.startsAt),
    endsAt: v.optional(activityFields.endsAt),
    color: v.optional(activityFields.color),
    notes: v.optional(activityFields.notes),
  }),
  v.check(
    (value) => Object.keys(value).length > 0,
    "更新項目を1つ以上指定してください"
  )
)

export const replaceAvailabilityInputSchema = v.pipe(
  v.object({
    status: v.picklist(["draft", "submitted"]),
    windows: v.pipe(v.array(timeWindowSchema), v.maxLength(64)),
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

export const createAssignmentInputSchema = v.pipe(
  v.object({
    memberId: v.pipe(v.string(), v.uuid()),
    startsAt: v.optional(instantSchema),
    endsAt: v.optional(instantSchema),
    notes: v.optional(
      v.nullable(v.pipe(v.string(), v.trim(), v.maxLength(1000))),
      null
    ),
  }),
  v.forward(
    v.check(
      (value) =>
        (value.startsAt === undefined) === (value.endsAt === undefined),
      "開始日時と終了日時は両方指定してください"
    ),
    ["endsAt"]
  ),
  v.forward(
    v.check(
      (value) =>
        value.startsAt === undefined ||
        value.endsAt === undefined ||
        isOrdered(value.startsAt, value.endsAt),
      "終了日時は開始日時より後にしてください"
    ),
    ["endsAt"]
  )
)

export const createAssignmentReportInputSchema = v.object({
  kind: v.picklist(["late", "absence"]),
  message: v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(1000)),
})

export const operatingYearResponseSchema = v.object({
  year: operatingYearSchema,
  status: yearStatusSchema,
})

export const activityResponseSchema = v.object({
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
  activityId: v.pipe(v.string(), v.uuid()),
  memberId: v.pipe(v.string(), v.uuid()),
  memberDisplayName: v.string(),
  startsAt: instantSchema,
  endsAt: instantSchema,
  notes: v.nullable(v.string()),
  checkedInAt: v.optional(v.nullable(instantSchema)),
})

export const attendanceResponseSchema = v.object({
  id: v.pipe(v.string(), v.uuid()),
  assignmentId: v.pipe(v.string(), v.uuid()),
  checkedInAt: instantSchema,
})

export const assignmentReportResponseSchema = v.object({
  id: v.pipe(v.string(), v.uuid()),
  assignmentId: v.pipe(v.string(), v.uuid()),
  memberId: v.pipe(v.string(), v.uuid()),
  memberDisplayName: v.string(),
  kind: v.picklist(["late", "absence"]),
  message: v.string(),
  status: v.picklist(["open", "resolved"]),
  activityId: v.pipe(v.string(), v.uuid()),
  activityName: v.string(),
  startsAt: instantSchema,
  endsAt: instantSchema,
  createdAt: instantSchema,
  resolvedAt: v.nullable(instantSchema),
})

export const yearRoleResponseSchema = v.object({
  id: v.pipe(v.string(), v.uuid()),
  year: operatingYearSchema,
  name: v.string(),
  color: v.string(),
  permissions: v.array(shiftPermissionSchema),
  memberCount: v.pipe(v.unknown(), v.toNumber(), v.integer(), v.minValue(0)),
})

export const yearMemberResponseSchema = v.object({
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
  windows: v.array(
    v.pipe(
      v.object({
        ...timeWindowEntries,
        id: v.optional(v.pipe(v.string(), v.uuid())),
      }),
      orderedWindowCheck
    )
  ),
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
  windows: v.array(
    v.pipe(
      v.object({
        ...timeWindowEntries,
        id: v.pipe(v.string(), v.uuid()),
      }),
      v.forward(
        v.check(
          (value) => isOrdered(value.startsAt, value.endsAt),
          "終了日時は開始日時より後にしてください"
        ),
        ["endsAt"]
      )
    )
  ),
})

export const timelineItemResponseSchema = v.object({
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

export const activityDetailResponseSchema = v.object({
  activity: activityResponseSchema,
  assignments: v.array(assignmentResponseSchema),
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
  attendance: attendanceResponseSchema,
})

export const assignmentReportEnvelopeSchema = v.object({
  report: assignmentReportResponseSchema,
})

export const assignmentReportsResponseSchema = v.object({
  reports: v.array(assignmentReportResponseSchema),
})

export const availabilityEnvelopeSchema = v.object({
  availability: availabilityResponseSchema,
})

export const availabilitySubmissionsResponseSchema = v.object({
  submissions: v.array(availabilitySubmissionResponseSchema),
})

export const assignmentMutationResponseSchema = v.object({
  assignment: assignmentResponseSchema,
  warnings: v.array(v.picklist(["OUTSIDE_SUBMITTED_AVAILABILITY"])),
})

export const timelineResponseSchema = v.object({
  assignments: v.array(timelineItemResponseSchema),
})

export const apiErrorSchema = v.object({
  error: v.object({
    code: v.string(),
    message: v.string(),
  }),
})

export type ShiftPermission = v.InferOutput<typeof shiftPermissionSchema>

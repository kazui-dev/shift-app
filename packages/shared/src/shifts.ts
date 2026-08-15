import { z } from "zod"

export const operatingYearSchema = z.coerce.number().int().min(2000).max(2100)
export const yearStatusSchema = z.enum(["draft", "active", "archived"])
export const shiftPermissionSchema = z.enum(["shift.manage"])

const dateOnlyPattern = /^\d{4}-\d{2}-\d{2}$/

export const dateOnlySchema = z.string().refine((value) => {
  if (!dateOnlyPattern.test(value)) {
    return false
  }
  const date = new Date(`${value}T00:00:00.000Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value)
}, "日付をYYYY-MM-DD形式で入力してください")

export const instantSchema = z.string().datetime({ offset: true })

function isOrdered(start: string, end: string): boolean {
  return Date.parse(start) < Date.parse(end)
}

export const timeWindowSchema = z
  .object({
    startsAt: instantSchema,
    endsAt: instantSchema,
  })
  .refine((value) => isOrdered(value.startsAt, value.endsAt), {
    message: "終了日時は開始日時より後にしてください",
    path: ["endsAt"],
  })

export const createOperatingYearInputSchema = z.object({
  year: operatingYearSchema,
  status: yearStatusSchema.default("draft"),
})

export const updateOperatingYearInputSchema = z.object({
  status: yearStatusSchema,
})

export const createYearRoleInputSchema = z.object({
  name: z.string().trim().min(1).max(80),
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/)
    .transform((value) => value.toUpperCase()),
  permissions: z.array(shiftPermissionSchema).max(16).default([]),
})

const activityFields = {
  name: z.string().trim().min(1).max(120),
  place: z.string().trim().min(1).max(120),
  activityType: z.string().trim().min(1).max(80),
  startsAt: instantSchema,
  endsAt: instantSchema,
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/)
    .transform((value) => value.toUpperCase()),
  notes: z.string().trim().max(2000).nullable().default(null),
}

export const createActivityInputSchema = z
  .object(activityFields)
  .refine((value) => isOrdered(value.startsAt, value.endsAt), {
    message: "終了日時は開始日時より後にしてください",
    path: ["endsAt"],
  })

export const updateActivityInputSchema = z
  .object({
    name: activityFields.name.optional(),
    place: activityFields.place.optional(),
    activityType: activityFields.activityType.optional(),
    startsAt: activityFields.startsAt.optional(),
    endsAt: activityFields.endsAt.optional(),
    color: activityFields.color.optional(),
    notes: activityFields.notes.optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "更新項目を1つ以上指定してください",
  })

export const replaceAvailabilityInputSchema = z
  .object({
    status: z.enum(["draft", "submitted"]),
    windows: z.array(timeWindowSchema).max(64),
  })
  .superRefine((value, context) => {
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
        context.addIssue({
          code: "custom",
          message: "希望時間帯を重複させることはできません",
          path: ["windows"],
        })
        return
      }
    }
  })

export const createAssignmentInputSchema = z
  .object({
    memberId: z.string().uuid(),
    startsAt: instantSchema.optional(),
    endsAt: instantSchema.optional(),
    notes: z.string().trim().max(1000).nullable().default(null),
  })
  .superRefine((value, context) => {
    if ((value.startsAt === undefined) !== (value.endsAt === undefined)) {
      context.addIssue({
        code: "custom",
        message: "開始日時と終了日時は両方指定してください",
        path: ["endsAt"],
      })
      return
    }
    if (
      value.startsAt !== undefined &&
      value.endsAt !== undefined &&
      !isOrdered(value.startsAt, value.endsAt)
    ) {
      context.addIssue({
        code: "custom",
        message: "終了日時は開始日時より後にしてください",
        path: ["endsAt"],
      })
    }
  })

export const createAssignmentReportInputSchema = z.object({
  kind: z.enum(["late", "absence"]),
  message: z.string().trim().min(1).max(1000),
})

export const operatingYearResponseSchema = z.object({
  year: operatingYearSchema,
  status: yearStatusSchema,
})

export const activityResponseSchema = z.object({
  id: z.string().uuid(),
  year: operatingYearSchema,
  name: z.string(),
  place: z.string(),
  activityType: z.string(),
  startsAt: instantSchema,
  endsAt: instantSchema,
  color: z.string(),
  notes: z.string().nullable(),
})

export const assignmentResponseSchema = z.object({
  id: z.string().uuid(),
  activityId: z.string().uuid(),
  memberId: z.string().uuid(),
  memberDisplayName: z.string(),
  startsAt: instantSchema,
  endsAt: instantSchema,
  notes: z.string().nullable(),
  checkedInAt: instantSchema.nullable().optional(),
})

export const attendanceResponseSchema = z.object({
  id: z.string().uuid(),
  assignmentId: z.string().uuid(),
  checkedInAt: instantSchema,
})

export const assignmentReportResponseSchema = z.object({
  id: z.string().uuid(),
  assignmentId: z.string().uuid(),
  memberId: z.string().uuid(),
  memberDisplayName: z.string(),
  kind: z.enum(["late", "absence"]),
  message: z.string(),
  status: z.enum(["open", "resolved"]),
  activityId: z.string().uuid(),
  activityName: z.string(),
  startsAt: instantSchema,
  endsAt: instantSchema,
  createdAt: instantSchema,
  resolvedAt: instantSchema.nullable(),
})

export const yearRoleResponseSchema = z.object({
  id: z.string().uuid(),
  year: operatingYearSchema,
  name: z.string(),
  color: z.string(),
  permissions: z.array(shiftPermissionSchema),
  memberCount: z.coerce.number().int().nonnegative(),
})

export const yearMemberResponseSchema = z.object({
  id: z.string().uuid(),
  displayName: z.string(),
  studentId: z.string(),
  roles: z.array(
    z.object({
      id: z.string().uuid(),
      name: z.string(),
      color: z.string(),
    })
  ),
})

export const availabilityResponseSchema = z.object({
  year: operatingYearSchema,
  status: z.enum(["draft", "submitted"]),
  submittedAt: instantSchema.nullable(),
  updatedAt: instantSchema.optional(),
  windows: z.array(
    timeWindowSchema.extend({
      id: z.string().uuid().optional(),
    })
  ),
})

export const availabilitySubmissionResponseSchema = z.object({
  id: z.string().uuid(),
  member: z.object({
    id: z.string().uuid(),
    displayName: z.string(),
    studentId: z.string(),
  }),
  status: z.enum(["draft", "submitted"]),
  submittedAt: instantSchema.nullable(),
  windows: z.array(
    timeWindowSchema.extend({
      id: z.string().uuid(),
    })
  ),
})

export const timelineItemResponseSchema = assignmentResponseSchema.extend({
  activityName: z.string(),
  place: z.string(),
  activityType: z.string(),
  color: z.string(),
})

export const yearsResponseSchema = z.object({
  years: z.array(
    operatingYearResponseSchema.extend({
      canManage: z.boolean(),
    })
  ),
})

export const yearRolesResponseSchema = z.object({
  roles: z.array(yearRoleResponseSchema),
})

export const yearMembersResponseSchema = z.object({
  members: z.array(yearMemberResponseSchema),
})

export const activitiesResponseSchema = z.object({
  activities: z.array(
    activityResponseSchema.extend({
      assignmentCount: z.coerce.number().int().nonnegative(),
    })
  ),
})

export const activityDetailResponseSchema = z.object({
  activity: activityResponseSchema,
  assignments: z.array(assignmentResponseSchema),
})

export const operatingYearEnvelopeSchema = z.object({
  year: operatingYearResponseSchema,
})

export const yearRoleEnvelopeSchema = z.object({
  role: yearRoleResponseSchema.omit({ memberCount: true }),
})

export const activityEnvelopeSchema = z.object({
  activity: activityResponseSchema.extend({
    assignmentCount: z.coerce.number().int().nonnegative().optional(),
  }),
})

export const roleMembershipResponseSchema = z.object({
  membership: z.object({
    roleId: z.string().uuid(),
    memberId: z.string().uuid(),
  }),
})

export const attendanceEnvelopeSchema = z.object({
  attendance: attendanceResponseSchema,
})

export const assignmentReportEnvelopeSchema = z.object({
  report: assignmentReportResponseSchema,
})

export const assignmentReportsResponseSchema = z.object({
  reports: z.array(assignmentReportResponseSchema),
})

export const availabilityEnvelopeSchema = z.object({
  availability: availabilityResponseSchema,
})

export const availabilitySubmissionsResponseSchema = z.object({
  submissions: z.array(availabilitySubmissionResponseSchema),
})

export const assignmentMutationResponseSchema = z.object({
  assignment: assignmentResponseSchema,
  warnings: z.array(z.enum(["OUTSIDE_SUBMITTED_AVAILABILITY"])),
})

export const timelineResponseSchema = z.object({
  assignments: z.array(timelineItemResponseSchema),
})

export const apiErrorSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
  }),
})

export type ShiftPermission = z.infer<typeof shiftPermissionSchema>

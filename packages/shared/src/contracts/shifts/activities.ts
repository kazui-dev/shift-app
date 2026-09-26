import * as v from "valibot"
import { instantSchema, isOrdered, operatingYearSchema } from "./common"
import { yearMemberResponseSchema } from "./members"

const activityFields = {
  name: v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(120)),
  place: v.pipe(v.string(), v.trim(), v.maxLength(120)),
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

export const activityEnvelopeSchema = v.object({
  activity: v.object({
    ...activityResponseSchema.entries,
    assignmentCount: v.optional(
      v.pipe(v.unknown(), v.toNumber(), v.integer(), v.minValue(0))
    ),
  }),
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

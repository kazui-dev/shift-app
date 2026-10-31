import * as v from "valibot"
import { instantSchema, operatingYearSchema } from "./common"

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

export const rosterResponseSchema = v.object({
  members: v.array(yearMemberResponseSchema),
})

export const yearMembershipEnvelopeSchema = v.object({
  membership: v.object({
    year: operatingYearSchema,
    member: v.object({
      image: v.nullable(v.pipe(v.string(), v.url())),
      id: v.pipe(v.string(), v.uuid()),
      displayName: v.string(),
      studentId: v.string(),
    }),
    status: v.picklist(["active", "inactive"]),
    updatedAt: instantSchema,
  }),
})

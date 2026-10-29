import * as v from "valibot"
import { activityEditorInputSchema } from "./activities"
import { instantSchema } from "./common"
export const assignmentOverwriteReviewSchema = v.object({
  token: v.pipe(v.string(), v.regex(/^[a-f0-9]{64}$/)),
  changes: v.array(
    v.object({
      assignmentId: v.string(),
      activityId: v.string(),
      activityName: v.string(),
      memberId: v.string(),
      memberName: v.string(),
      startsAt: instantSchema,
      endsAt: instantSchema,
      remaining: v.array(
        v.object({ startsAt: instantSchema, endsAt: instantSchema })
      ),
      blockedReason: v.nullable(v.string()),
    })
  ),
})
export type AssignmentOverwriteReview = v.InferOutput<
  typeof assignmentOverwriteReviewSchema
>
export const assignmentOverwriteInputSchema = v.object({
  plan: activityEditorInputSchema,
  token: v.pipe(v.string(), v.regex(/^[a-f0-9]{64}$/)),
})

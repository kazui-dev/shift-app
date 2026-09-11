import * as v from "valibot"
import { dateOnlySchema } from "./shifts"
const minute = v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(1440))
export const formDateInputSchema = v.pipe(
  v.object({
    date: dateOnlySchema,
    startsMinute: minute,
    endsMinute: minute,
    accepting: v.boolean(),
  }),
  v.check(
    (date) => date.startsMinute < date.endsMinute,
    "終了時刻は開始時刻より後にしてください"
  )
)
export const formDateSchema = v.object({
  ...formDateInputSchema.pipe[0].entries,
  version: v.number(),
})
export const dayAnswerSchema = v.object({
  date: dateOnlySchema,
  version: v.number(),
  choice: v.picklist(["all", "times", "no"]),
  times: v.array(v.object({ id: v.string(), from: minute, to: minute })),
})
export const formAnswersInputSchema = v.strictObject({
  answers: v.pipe(v.array(dayAnswerSchema), v.maxLength(200)),
  submit: v.boolean(),
})
export const formResponseSchema = v.object({
  dates: v.array(formDateSchema),
  answers: v.array(dayAnswerSchema),
  submitted: v.array(dayAnswerSchema),
  submittedAt: v.nullable(v.string()),
})
export const formDatesResponseSchema = v.object({
  dates: v.array(formDateSchema),
})
export type FormDate = v.InferOutput<typeof formDateSchema>
export type DayAnswer = v.InferOutput<typeof dayAnswerSchema>

import * as v from "valibot"
import { instantSchema, isOrdered } from "./common"

const shiftNoticeSchema = v.pipe(
  v.object({
    id: v.pipe(v.string(), v.uuid()),
    startsAt: instantSchema,
    endsAt: instantSchema,
    content: v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(2000)),
  }),
  v.forward(
    v.check(
      (value) => isOrdered(value.startsAt, value.endsAt),
      "表示期間の終了は開始より後にしてください。"
    ),
    ["endsAt"]
  )
)
export const shiftNoticesSchema = v.pipe(
  v.array(shiftNoticeSchema),
  v.maxLength(100),
  v.check(
    (items) => new Set(items.map((item) => item.id)).size === items.length,
    "連絡事項が重複しています。"
  )
)
export type ShiftNotice = v.InferOutput<typeof shiftNoticeSchema>

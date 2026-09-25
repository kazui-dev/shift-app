import * as v from "valibot"
import { japanDateStart } from "../../lib/japan-time"
import {
  dateInJapan,
  dateOnlySchema,
  instantSchema,
  isOrdered,
  operatingYearSchema,
  timeWindowEntries,
} from "./common"

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

export const availabilityEnvelopeSchema = v.object({
  availability: availabilityResponseSchema,
})

export const availabilitySubmissionsResponseSchema = v.object({
  progress: v.array(
    v.object({
      memberId: v.string(),
      displayName: v.string(),
      studentId: v.string(),
      image: v.nullable(v.string()),
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

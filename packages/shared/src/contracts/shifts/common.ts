import * as v from "valibot"
import { japanDateTime } from "../../lib/japan-time"

export const operatingYearSchema = v.pipe(
  v.unknown(),
  v.toNumber(),
  v.integer(),
  v.minValue(2000),
  v.maxValue(2100)
)

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

export function isOrdered(start: string, end: string): boolean {
  return Date.parse(start) < Date.parse(end)
}

export function dateInJapan(value: string): string {
  return japanDateTime(value).date
}

export const timeWindowEntries = {
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

export const apiErrorSchema = v.object({
  error: v.object({
    code: v.string(),
    message: v.string(),
  }),
})

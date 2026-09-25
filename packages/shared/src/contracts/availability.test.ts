import * as v from "valibot"
import { expect, it } from "vite-plus/test"
import { dayAnswerSchema, formDateInputSchema } from "./availability"

const date = {
  date: "2026-09-13",
  startsMinute: 540,
  endsMinute: 1080,
  accepting: true,
}

it("accepts a form date only when it ends after it starts and stays within a day", () => {
  expect(v.safeParse(formDateInputSchema, date).success).toBe(true)
  expect(
    v.safeParse(formDateInputSchema, { ...date, endsMinute: 540 }).success
  ).toBe(false)
  expect(
    v.safeParse(formDateInputSchema, { ...date, endsMinute: 1441 }).success
  ).toBe(false)
  expect(
    v.safeParse(formDateInputSchema, { ...date, date: "2026-9-13" }).success
  ).toBe(false)
})

it("keeps an answer's choice within the offered options", () => {
  const answer = { date: "2026-09-13", version: 1, choice: "times", times: [] }
  expect(v.safeParse(dayAnswerSchema, answer).success).toBe(true)
  expect(
    v.safeParse(dayAnswerSchema, { ...answer, choice: "maybe" }).success
  ).toBe(false)
})

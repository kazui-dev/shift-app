import { describe, it, expect } from "vite-plus/test"
import type { DayAnswer, FormDate } from "@workspace/shared/availability"
import { validateFormAnswers } from "../../src/domain/availability-form"
const date: FormDate = {
  date: "2026-11-01",
  startsMinute: 540,
  endsMinute: 1080,
  version: 2,
  accepting: true,
}
const answer: DayAnswer = {
  date: date.date,
  version: 2,
  choice: "all",
  times: [],
}
describe("availability form rounds", () => {
  it("keeps incomplete drafts separate from submission requirements", () => {
    expect(validateFormAnswers([date], [], false)).toBeNull()
    expect(validateFormAnswers([date], [], true)).not.toBeNull()
  })
  it("does not require answers for closed days", () => {
    expect(
      validateFormAnswers([{ ...date, accepting: false }], [], true)
    ).toBeNull()
  })
  it("requires reconfirmation after day bounds change", () => {
    expect(
      validateFormAnswers([date], [{ ...answer, version: 1 }], true)
    ).not.toBeNull()
  })
  it("allows all-day and unavailable answers", () => {
    expect(validateFormAnswers([date], [answer], true)).toBeNull()
    expect(
      validateFormAnswers([date], [{ ...answer, choice: "no" }], true)
    ).toBeNull()
  })
  it("rejects duplicate days", () => {
    expect(validateFormAnswers([date], [answer, answer], false)).not.toBeNull()
  })
  it.each(
    [
      [],
      [{ id: "a", from: 600, to: 600 }],
      [{ id: "a", from: 500, to: 600 }],
      [{ id: "a", from: 600, to: 1100 }],
      [
        { id: "a", from: 600, to: 800 },
        { id: "b", from: 700, to: 900 },
      ],
    ].map((times) => ({ times }))
  )("rejects incomplete or overlapping times %j", ({ times }) => {
    expect(
      validateFormAnswers([date], [{ ...answer, choice: "times", times }], true)
    ).not.toBeNull()
  })
  it("sorts ranges and accepts adjacent minute precision times", () => {
    expect(
      validateFormAnswers(
        [date],
        [
          {
            ...answer,
            choice: "times",
            times: [
              { id: "a", from: 701, to: 800 },
              { id: "b", from: 600, to: 701 },
            ],
          },
        ],
        true
      )
    ).toBeNull()
  })
})

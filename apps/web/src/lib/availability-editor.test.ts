import { expect, it } from "vite-plus/test"
import { answerError, answerStatus } from "./availability-editor"
import type { DayAnswer, FormDate } from "@workspace/shared/availability"
const date: FormDate = {
  date: "2026-11-01",
  version: 2,
  accepting: true,
  startsMinute: 540,
  endsMinute: 1020,
}
const answer: DayAnswer = {
  date: date.date,
  version: 2,
  choice: "all",
  times: [],
}
it("distinguishes unsubmitted edits, closed dates and changed form versions", () => {
  expect(answerStatus(date, undefined, undefined)).toBe("未回答")
  expect(answerStatus(date, answer, answer)).toBe("提出済み")
  expect(answerStatus(date, { ...answer, choice: "no" }, answer)).toBe("未提出")
  expect(answerStatus(date, { ...answer, version: 1 }, answer)).toBe(
    "再回答が必要"
  )
  expect(
    answerStatus({ ...date, accepting: false }, undefined, undefined)
  ).toBe("受付終了")
})
it("requires current answers and validates times within each date before submission", () => {
  expect(answerError([date], [])).not.toBeNull()
  expect(answerError([date], [answer])).toBeNull()
  expect(
    answerError([date], [{ ...answer, choice: "times", times: [] }])
  ).not.toBeNull()
  const times = (ranges: number[][]): DayAnswer => ({
    ...answer,
    choice: "times",
    times: ranges.map(([from = 0, to = 0], index) => ({
      id: String(index),
      from,
      to,
    })),
  })
  expect(
    answerError(
      [date],
      [
        times([
          [600, 660],
          [660, 720],
        ]),
      ]
    )
  ).toBeNull()
  expect(
    answerError(
      [date],
      [
        times([
          [600, 700],
          [660, 720],
        ]),
      ]
    )
  ).toBe("参加時間が重複しています。")
  expect(answerError([date], [times([[500, 600]])])).not.toBeNull()
  expect(answerError([date], [times([[600, 600]])])).not.toBeNull()
})

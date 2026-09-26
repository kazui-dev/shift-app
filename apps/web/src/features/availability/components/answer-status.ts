import type { DayAnswer, FormDate } from "@workspace/shared/availability"

function sameAnswer(
  answer: DayAnswer | undefined,
  submitted: DayAnswer | undefined
) {
  return (
    !!answer &&
    !!submitted &&
    answer.version === submitted.version &&
    answer.choice === submitted.choice &&
    (answer.choice !== "times" ||
      JSON.stringify(answer.times.map(({ from, to }) => [from, to])) ===
        JSON.stringify(submitted.times.map(({ from, to }) => [from, to])))
  )
}
export function answerStatus(
  date: FormDate,
  answer: DayAnswer | undefined,
  submitted: DayAnswer | undefined
) {
  if (!date.accepting) return "受付終了"
  if (!answer) return "未回答"
  if (answer.version !== date.version) return "再回答が必要"
  return sameAnswer(answer, submitted) ? "提出済み" : "未提出"
}
export function answerError(dates: FormDate[], answers: DayAnswer[]) {
  for (const date of dates.filter((item) => item.accepting)) {
    const answer = answers.find((item) => item.date === date.date)
    if (!answer || answer.version !== date.version)
      return "すべての日程に回答してください。"
    if (answer.choice !== "times") continue
    const times = [...answer.times].sort((a, b) => a.from - b.from)
    if (!times.length) return "参加できる時間を指定してください。"
    if (
      times.some(
        (time) =>
          time.from < date.startsMinute ||
          time.to > date.endsMinute ||
          time.from >= time.to
      )
    )
      return "受付時間内で、開始より後の終了時刻を指定してください。"
    if (
      times.some(
        (time, index) => index > 0 && time.from < (times[index - 1]?.to ?? 0)
      )
    )
      return "参加時間が重複しています。"
  }
  return null
}

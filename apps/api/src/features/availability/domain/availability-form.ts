import type { DayAnswer, FormDate } from "@workspace/shared/availability"
export function validateFormAnswers(
  dates: FormDate[],
  answers: DayAnswer[],
  submit: boolean
) {
  if (new Set(answers.map((answer) => answer.date)).size !== answers.length)
    return "同じ日への回答が重複しています。"
  if (!submit) return null
  for (const date of dates.filter((item) => item.accepting)) {
    const answer = answers.find((item) => item.date === date.date)
    if (!answer) return "受付中のすべての日に回答してください。"
    if (answer.version !== date.version)
      return "日程が変更されています。回答を確認してください。"
    if (answer.choice !== "times") continue
    if (answer.times.length === 0) return "参加可能な時間を指定してください。"
    const sorted = [...answer.times].sort((a, b) => a.from - b.from)
    for (const [index, time] of sorted.entries()) {
      if (
        time.from >= time.to ||
        time.from < date.startsMinute ||
        time.to > date.endsMinute
      )
        return "受付時間内の参加可能時間を指定してください。"
      const previous = sorted[index - 1]
      if (previous && previous.to > time.from)
        return "参加可能時間が重なっています。"
    }
  }
  return null
}

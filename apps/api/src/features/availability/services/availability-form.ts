import * as v from "valibot"
import { japanDateStart } from "@workspace/shared/japan-time"
import { dayAnswerSchema, type DayAnswer } from "@workspace/shared/availability"
import { toIso } from "../../../lib/http"
export async function readAvailabilityForm(
  db: D1Database,
  year: number,
  memberId: string,
  directory = false
) {
  const [dates, submission, draft] = await Promise.all([
    db
      .prepare(
        "SELECT id,date,starts_minute AS startsMinute,ends_minute AS endsMinute,accepting,version FROM availability_dates WHERE year=? AND deleted=0 ORDER BY date"
      )
      .bind(year)
      .all<{
        id: string
        date: string
        startsMinute: number
        endsMinute: number
        accepting: number
        version: number
      }>(),
    db
      .prepare(
        directory
          ? "SELECT id,submitted_at AS submittedAt,revision FROM directory_availability_submissions WHERE id=? AND EXISTS(SELECT 1 FROM student_directory d WHERE d.id=entry_id AND d.year=?)"
          : "SELECT id,submitted_at AS submittedAt,revision FROM availability_submissions WHERE member_id=? AND year=?"
      )
      .bind(memberId, year)
      .first<{ id: string; submittedAt: number | null; revision: number }>(),
    directory
      ? Promise.resolve(null)
      : db
          .prepare(
            "SELECT answers,revision FROM availability_drafts WHERE year=? AND member_id=?"
          )
          .bind(year, memberId)
          .first<{ answers: string; revision: number | null }>(),
  ])
  const submitted: DayAnswer[] = []
  if (submission) {
    const [answers, windows] = await Promise.all([
      db
        .prepare(
          `SELECT date_id AS dateId,date_version AS version,choice FROM ${directory ? "directory_availability_day_answers" : "availability_day_answers"} WHERE submission_id=?`
        )
        .bind(submission.id)
        .all<{
          dateId: string
          version: number
          choice: "all" | "times" | "no"
        }>(),
      db
        .prepare(
          `SELECT id,availability_date_id AS dateId,starts_at AS startsAt,ends_at AS endsAt FROM ${directory ? "directory_availability_windows" : "availability_windows"} WHERE submission_id=? ORDER BY starts_at`
        )
        .bind(submission.id)
        .all<{
          id: string
          dateId: string
          startsAt: number
          endsAt: number
        }>(),
    ])
    for (const answer of answers.results) {
      const date = dates.results.find((item) => item.id === answer.dateId)
      if (!date) continue
      const base = japanDateStart(date.date)
      submitted.push({
        date: date.date,
        version: answer.version,
        choice: answer.choice,
        times: windows.results
          .filter((window) => window.dateId === date.id)
          .map((window) => ({
            id: window.id,
            from: (window.startsAt - base) / 60000,
            to: (window.endsAt - base) / 60000,
          })),
      })
    }
  }
  const parsed = draft
    ? v.safeParse(v.array(dayAnswerSchema), JSON.parse(draft.answers))
    : null
  return {
    dates: dates.results.map((date) => ({
      ...date,
      accepting: date.accepting === 1,
    })),
    answers: dates.results.flatMap((date) => {
      const answer =
        (date.accepting && parsed?.success ? parsed.output : submitted).find(
          (item) => item.date === date.date
        ) ?? submitted.find((item) => item.date === date.date)
      return answer ? [answer] : []
    }),
    submitted,
    submittedAt: submission?.submittedAt ? toIso(submission.submittedAt) : null,
    revision: submission?.revision ?? 0,
    draftRevision: draft?.revision ?? null,
  }
}

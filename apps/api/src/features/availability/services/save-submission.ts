import { japanDateStart } from "@workspace/shared/japan-time"
import type { DayAnswer } from "@workspace/shared/availability"
import { changedAnswers } from "../domain/availability-form"
import type { readAvailabilityForm } from "./availability-form"
import type { MemberContext } from "../../../lib/http"

export async function submissionStatements(
  db: D1Database,
  year: number,
  memberId: string,
  form: Awaited<ReturnType<typeof readAvailabilityForm>>,
  answers: DayAnswer[],
  actor: MemberContext,
  now: number,
  managed = false,
  directory = false
) {
  const old = directory
    ? { id: memberId }
    : await db
        .prepare(
          "SELECT id FROM availability_submissions WHERE year=? AND member_id=?"
        )
        .bind(year, memberId)
        .first<{ id: string }>()
  const id = old?.id ?? crypto.randomUUID()
  const statements: D1PreparedStatement[] = [
    directory
      ? db
          .prepare(
            "UPDATE directory_availability_submissions SET submitted_at=?,revision=?,updated_at=? WHERE id=?"
          )
          .bind(now, form.revision + 1, now, id)
      : db
          .prepare(
            "INSERT INTO availability_submissions (id,year,member_id,status,submitted_at,revision,created_at,updated_at) VALUES (?,?,?,'submitted',?,?,?,?) ON CONFLICT(year,member_id) DO UPDATE SET status='submitted',submitted_at=excluded.submitted_at,revision=excluded.revision,updated_at=excluded.updated_at"
          )
          .bind(id, year, memberId, now, form.revision + 1, now, now),
  ]
  const dates = form.dates.filter((date) => managed || date.accepting)
  const saved = answers.filter((answer) =>
    dates.some((date) => date.date === answer.date)
  )
  if (managed || form.submittedAt) {
    for (const change of changedAnswers(form.submitted, saved)) {
      statements.push(
        db
          .prepare(`INSERT INTO ${directory ? "directory_availability_submission_changes" : "availability_submission_changes"}
        (id,submission_id,date,before_choice,before_times,after_choice,after_times,changed_at,changed_by,changed_by_name) VALUES (?,?,?,?,?,?,?,?,?,?)`)
          .bind(
            crypto.randomUUID(),
            id,
            change.date,
            change.before.choice,
            JSON.stringify(change.before.times),
            change.after.choice,
            JSON.stringify(change.after.times),
            now,
            actor.id,
            actor.displayName
          )
      )
    }
  }
  for (const date of dates) {
    const answer = saved.find((item) => item.date === date.date)
    if (!answer) continue
    statements.push(
      db
        .prepare(
          `DELETE FROM ${directory ? "directory_availability_windows" : "availability_windows"} WHERE submission_id=? AND availability_date_id=?`
        )
        .bind(id, date.id),
      db
        .prepare(`INSERT INTO ${directory ? "directory_availability_day_answers" : "availability_day_answers"}
        (submission_id,date_id,date_version,choice) VALUES (?,?,
        (SELECT version FROM availability_dates WHERE id=? AND version=? AND deleted=0 AND (accepting=1 OR ?=1)),?)
        ON CONFLICT(submission_id,date_id) DO UPDATE SET date_version=excluded.date_version,choice=excluded.choice`)
        .bind(
          id,
          date.id,
          date.id,
          date.version,
          managed ? 1 : 0,
          answer.choice
        )
    )
    const times =
      answer.choice === "all"
        ? [{ from: date.startsMinute, to: date.endsMinute }]
        : answer.choice === "times"
          ? answer.times
          : []
    const base = japanDateStart(date.date)
    for (const time of times) {
      statements.push(
        db
          .prepare(`INSERT INTO ${directory ? "directory_availability_windows" : "availability_windows"}
        (id,submission_id,availability_date_id,starts_at,ends_at,created_at) VALUES (?,?,?,?,?,?)`)
          .bind(
            crypto.randomUUID(),
            id,
            date.id,
            base + time.from * 60000,
            base + time.to * 60000,
            now
          )
      )
    }
  }
  return statements
}

import { useEffect, useLayoutEffect, useRef, useState } from "react"
import * as v from "valibot"
import {
  dayAnswerSchema,
  type DayAnswer,
  type FormDate,
} from "@workspace/shared/availability"
import { useQueryClient } from "@tanstack/react-query"
import {
  getAvailability,
  replaceAvailability,
} from "@/features/availability/api/availability"
import { ApiError, errorMessage } from "@/lib/http/client"
import { answerError } from "@/features/availability/components/answer-status"

export function useAvailabilityEditor(
  user: string,
  year: number,
  dates: FormDate[],
  initial: DayAnswer[],
  submitted: DayAnswer[],
  initialRevision: number
) {
  const [conflicted, setConflicted] = useState(false)
  const client = useQueryClient()
  const key = `availability-recovery:${user}:${year}`
  const [recovery] = useState(() => {
    try {
      const raw = localStorage.getItem(key)
      const saved = raw
        ? v.parse(
            v.union([
              v.array(dayAnswerSchema),
              v.object({
                answers: v.array(dayAnswerSchema),
                revision: v.pipe(v.number(), v.integer(), v.minValue(0)),
              }),
            ]),
            JSON.parse(raw)
          )
        : null
      const recovered = Array.isArray(saved)
        ? saved
        : (saved?.answers ?? initial)
      // Legacy recovery has no base version; use zero so it cannot overwrite a later submission.
      const baseRevision = Array.isArray(saved)
        ? 0
        : (saved?.revision ?? initialRevision)
      const recoveredAnswers = dates.flatMap((date) => {
        const answer =
          (date.accepting ? recovered : initial).find(
            (item) => item.date === date.date
          ) ?? initial.find((item) => item.date === date.date)
        return answer ? [answer] : []
      })
      return { answers: recoveredAnswers, revision: baseRevision }
    } catch {
      return { answers: initial, revision: initialRevision }
    }
  })
  const revision = useRef(recovery.revision)
  const [answers, setAnswers] = useState(recovery.answers)
  const [sent, setSent] = useState(submitted)
  const [status, setStatus] = useState("保存済み")
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const latest = useRef(answers)
  const confirmed = useRef(JSON.stringify(initial))
  const writes = useRef(Promise.resolve())
  const pending = useRef(0)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const active = useRef(true)
  function save(publish: boolean) {
    clearTimeout(timer.current)
    const current = latest.current
    const json = JSON.stringify(current)
    if (!publish && !pending.current && json === confirmed.current)
      return writes.current
    pending.current++
    if (active.current) {
      setStatus("保存中")
      setError(null)
    }
    const task = writes.current
      .catch(() => {})
      .then(async () => {
        if (!publish && json === confirmed.current) {
          if (active.current && JSON.stringify(latest.current) === json)
            setStatus("保存済み")
          return
        }
        const recoveryJson = JSON.stringify({
          answers: current,
          revision: revision.current,
        })
        const result = await replaceAvailability(year, {
          answers: current,
          submit: publish,
          revision: revision.current,
        })
        if (publish) {
          revision.current = result.revision
        }
        confirmed.current = json
        client.setQueryData(["availability", year], result)
        try {
          const stored = localStorage.getItem(key)
          if (stored === recoveryJson || stored === json)
            localStorage.removeItem(key)
        } catch {
          /* Server copy is saved. */
        }
        if (active.current) {
          if (publish) setSent(result.submitted)
          setStatus(
            JSON.stringify(latest.current) === json ? "保存済み" : "保存待ち"
          )
        }
      })
      .catch((failure: unknown) => {
        if (active.current) {
          if (failure instanceof ApiError && failure.status === 409)
            setConflicted(true)
          setStatus("保存できませんでした")
          setError(errorMessage(failure))
        }
        throw failure
      })
      .finally(() => {
        pending.current--
      })
    writes.current = task
    return task
  }
  const saveRef = useRef(save)
  useLayoutEffect(() => {
    latest.current = answers
    saveRef.current = save
  })
  useEffect(() => {
    const json = JSON.stringify(answers)
    if (!pending.current && json === confirmed.current) return undefined
    try {
      localStorage.setItem(
        key,
        JSON.stringify({ answers, revision: revision.current })
      )
    } catch {
      /* Server autosave remains available. */
    }
    setStatus("保存待ち")
    timer.current = setTimeout(() => {
      void saveRef.current(false).catch(() => {})
    }, 500)
    return () => clearTimeout(timer.current)
  }, [answers, key])
  useEffect(() => {
    active.current = true
    return () => {
      active.current = false
      clearTimeout(timer.current)
      void saveRef.current(false).catch(() => {})
    }
  }, [])
  function update(
    date: FormDate,
    choice: DayAnswer["choice"],
    times?: DayAnswer["times"]
  ) {
    setError(null)
    setAnswers((values) => {
      const old = values.find((answer) => answer.date === date.date)
      return [
        ...values.filter((answer) => answer.date !== date.date),
        {
          date: date.date,
          version: date.version,
          choice,
          times: times ??
            old?.times ?? [
              {
                id: crypto.randomUUID(),
                from: date.startsMinute,
                to: date.endsMinute,
              },
            ],
        },
      ]
    })
  }
  async function submit() {
    const invalid = answerError(dates, latest.current)
    if (invalid) {
      setError(invalid)
      return
    }
    setSubmitting(true)
    try {
      await save(true)
    } catch {
      /* Inline error remains visible. */
    } finally {
      if (active.current) setSubmitting(false)
    }
  }
  async function reload() {
    clearTimeout(timer.current)
    setSubmitting(true)
    try {
      await writes.current.catch(() => {})
      const current = await getAvailability(year)
      await replaceAvailability(year, {
        answers: current.submitted,
        submit: false,
        revision: current.revision,
      })
      confirmed.current = JSON.stringify(latest.current)
      localStorage.removeItem(key)
      window.location.reload()
    } catch (failure) {
      setError(errorMessage(failure))
      setSubmitting(false)
    }
  }
  return {
    conflicted,
    reload,
    answers,
    sent,
    status,
    error,
    submitting,
    update,
    submit,
    save: () => save(false),
  }
}

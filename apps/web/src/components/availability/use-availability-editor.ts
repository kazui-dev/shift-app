import { useEffect, useRef, useState } from "react"
import * as v from "valibot"
import {
  dayAnswerSchema,
  type DayAnswer,
  type FormDate,
} from "@workspace/shared/availability"
import { useQueryClient } from "@tanstack/react-query"
import { replaceAvailability } from "@/api/availability"
import { errorMessage } from "@/api/client"
import { answerError } from "@/components/availability/answer-status"

export function useAvailabilityEditor(
  user: string,
  year: number,
  dates: FormDate[],
  initial: DayAnswer[],
  submitted: DayAnswer[]
) {
  const client = useQueryClient()
  const key = `availability-recovery:${user}:${year}`
  const [answers, setAnswers] = useState(() => {
    try {
      const raw = localStorage.getItem(key)
      const saved = raw
        ? v.parse(v.array(dayAnswerSchema), JSON.parse(raw))
        : initial
      return dates.flatMap((date) => {
        const answer =
          (date.accepting ? saved : initial).find(
            (item) => item.date === date.date
          ) ?? initial.find((item) => item.date === date.date)
        return answer ? [answer] : []
      })
    } catch {
      return initial
    }
  })
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
  latest.current = answers
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
        const result = await replaceAvailability(year, {
          answers: current,
          submit: publish,
        })
        confirmed.current = json
        client.setQueryData(["availability", year], result)
        try {
          if (localStorage.getItem(key) === json) localStorage.removeItem(key)
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
  saveRef.current = save
  useEffect(() => {
    const json = JSON.stringify(answers)
    if (!pending.current && json === confirmed.current) return undefined
    try {
      localStorage.setItem(key, json)
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
  return {
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

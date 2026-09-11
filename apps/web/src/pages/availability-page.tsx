import { getRouteApi } from "@tanstack/react-router"
import * as v from "valibot"
import { dayAnswerSchema } from "@workspace/shared/availability"
import { useEffect, useRef, useState } from "react"
import { skipToken, useQuery, useQueryClient } from "@tanstack/react-query"
import type { DayAnswer, FormDate } from "@workspace/shared/availability"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { toast } from "@workspace/ui/lib/toast"
import { getAvailability, replaceAvailability } from "@/api/availability"
import { errorMessage } from "@/api/client"
import { useDisplayYear } from "@/components/use-display-year"
import { MinuteInput } from "@/components/minute-input"
import { PageHeader } from "@/components/page-layout"
export function AvailabilityPage() {
  const display = useDisplayYear(),
    year = display.year
  const query = useQuery({
    queryKey: ["availability", year],
    queryFn: year === null ? skipToken : () => getAvailability(year),
  })
  return (
    <section className="w-full min-w-0 space-y-6">
      <PageHeader title="シフト希望">
        {year !== null && year !== display.data?.defaultYear && (
          <span className="text-sm text-muted-foreground">{year}</span>
        )}
      </PageHeader>
      {display.isPending ? null : year === null ? (
        <p className="text-sm text-muted-foreground">参加年度がありません。</p>
      ) : query.data ? (
        <AvailabilityForm
          key={year}
          year={year}
          dates={query.data.dates}
          initialAnswers={query.data.answers}
          submittedAnswers={query.data.submitted}
        />
      ) : null}
    </section>
  )
}
function minutes(value: string) {
  const [hour = "0", minute = "0"] = value.split(":")
  return Number(hour) * 60 + Number(minute)
}
function time(value: number) {
  return `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`
}
function AvailabilityForm({
  year,
  dates,
  initialAnswers,
  submittedAnswers,
}: {
  year: number
  dates: FormDate[]
  submittedAnswers: DayAnswer[]
  initialAnswers: DayAnswer[]
}) {
  const client = useQueryClient()
  const { state } = getRouteApi("/_app").useRouteContext()
  const recoveryKey = `availability-recovery:${state.member.studentId}:${year}`
  const [answers, setAnswers] = useState(() => {
    try {
      const raw = localStorage.getItem(recoveryKey)
      const parsed = raw
        ? v.safeParse(v.array(dayAnswerSchema), JSON.parse(raw))
        : null
      if (parsed?.success)
        return dates.flatMap((date) => {
          const answer =
            (date.accepting ? parsed.output : initialAnswers).find(
              (item) => item.date === date.date
            ) ?? initialAnswers.find((item) => item.date === date.date)
          return answer ? [answer] : []
        })
    } catch {
      /* The server draft remains available if browser storage is unavailable. */
    }
    return initialAnswers
  })
  const [pending, setPending] = useState(false),
    [submitted, setSubmitted] = useState(() =>
      dates
        .filter((d) => d.accepting)
        .every((d) => {
          const answer = initialAnswers.find((a) => a.date === d.date),
            sent = submittedAnswers.find((a) => a.date === d.date)
          return (
            answer &&
            sent &&
            answer.version === d.version &&
            answer.choice === sent.choice &&
            (answer.choice !== "times" ||
              JSON.stringify(
                answer.times.map(({ from, to }) => ({ from, to }))
              ) ===
                JSON.stringify(
                  sent.times.map(({ from, to }) => ({ from, to }))
                ))
          )
        })
    )
  const lastSaved = useRef(JSON.stringify(initialAnswers)),
    queue = useRef(Promise.resolve()),
    latest = useRef(answers)
  latest.current = answers
  useEffect(() => {
    const json = JSON.stringify(answers)
    if (json === lastSaved.current) return undefined
    try {
      localStorage.setItem(recoveryKey, json)
    } catch {
      /* Server save failures are reported by toast. */
    }
    const timer = window.setTimeout(() => {
      queue.current = queue.current.then(async () => {
        try {
          await replaceAvailability(year, { answers, submit: false })
          toast.dismiss("availability-save")
          lastSaved.current = json
          try {
            if (localStorage.getItem(recoveryKey) === json)
              localStorage.removeItem(recoveryKey)
          } catch {
            /* No persistent browser storage. */
          }
        } catch (error) {
          toast.error(errorMessage(error), { id: "availability-save" })
        }
      })
    }, 500)
    return () => window.clearTimeout(timer)
  }, [answers, year, recoveryKey])
  useEffect(
    () => () => {
      const current = latest.current
      if (JSON.stringify(current) !== lastSaved.current)
        queue.current = queue.current.then(async () => {
          try {
            await replaceAvailability(year, { answers: current, submit: false })
          } catch {
            /* The recovery copy is restored when this page is reopened. */
          }
        })
    },
    [year]
  )
  function update(
    date: FormDate,
    choice: DayAnswer["choice"],
    times?: DayAnswer["times"]
  ) {
    const old = answers.find((answer) => answer.date === date.date)
    setAnswers([
      ...answers.filter((answer) => answer.date !== date.date),
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
    ])
    setSubmitted(false)
  }
  async function submit() {
    setPending(true)
    await queue.current
    try {
      await replaceAvailability(year, { answers, submit: true })
      toast.dismiss("availability-save")
      lastSaved.current = JSON.stringify(answers)
      try {
        localStorage.removeItem(recoveryKey)
      } catch {
        /* No persistent browser storage. */
      }
      setSubmitted(true)
      await client.invalidateQueries({ queryKey: ["availability", year] })
      toast.success("希望を提出しました。")
    } catch (error) {
      toast.error(errorMessage(error), { id: "availability-save" })
    } finally {
      setPending(false)
    }
  }
  if (!dates.length)
    return (
      <p className="text-sm text-muted-foreground">
        日程はまだ設定されていません。
      </p>
    )
  return (
    <div className="space-y-5">
      {dates.map((date) => {
        const answer = answers.find((item) => item.date === date.date),
          stale = answer && answer.version !== date.version
        return (
          <section
            key={date.date}
            className="rounded-lg border border-border/70 p-4"
          >
            <header className="mb-4 flex items-center justify-between gap-2">
              <h2 className="text-sm font-medium">
                {new Intl.DateTimeFormat("ja-JP", {
                  month: "long",
                  day: "numeric",
                  weekday: "short",
                }).format(new Date(`${date.date}T12:00:00+09:00`))}
              </h2>
              <span className="text-xs text-muted-foreground">
                {date.accepting
                  ? `${time(date.startsMinute)}–${time(date.endsMinute)}`
                  : "受付終了"}
              </span>
            </header>
            <fieldset
              disabled={!date.accepting || pending}
              className="space-y-3"
            >
              <div className="flex gap-1 rounded-md bg-muted p-1">
                {(
                  [
                    { value: "all", label: "終日参加" },
                    { value: "times", label: "時間を指定" },
                    { value: "no", label: "不参加" },
                  ] as const
                ).map(({ value, label }) => (
                  <button
                    key={value}
                    type="button"
                    className={`min-h-10 flex-1 rounded-sm px-2 text-sm ${answer?.choice === value ? "bg-background font-medium shadow-xs" : "text-muted-foreground"}`}
                    aria-pressed={answer?.choice === value}
                    onClick={() => update(date, value)}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {answer?.choice === "times" && (
                <div className="space-y-2">
                  {answer.times.map((window, index) => (
                    <div key={window.id} className="flex items-center gap-2">
                      <Input
                        type="time"
                        aria-label="参加可能な開始時刻"
                        value={time(window.from)}
                        onChange={(event) =>
                          update(
                            date,
                            "times",
                            answer.times.map((item, position) =>
                              position === index
                                ? { ...item, from: minutes(event.target.value) }
                                : item
                            )
                          )
                        }
                      />
                      <span>–</span>
                      <MinuteInput
                        label="参加可能な終了時刻"
                        value={window.to}
                        onChange={(value) =>
                          update(
                            date,
                            "times",
                            answer.times.map((item, position) =>
                              position === index ? { ...item, to: value } : item
                            )
                          )
                        }
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          update(
                            date,
                            "times",
                            answer.times.filter(
                              (_, position) => position !== index
                            )
                          )
                        }
                      >
                        削除
                      </Button>
                    </div>
                  ))}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      update(date, "times", [
                        ...answer.times,
                        {
                          id: crypto.randomUUID(),
                          from: date.startsMinute,
                          to: date.endsMinute,
                        },
                      ])
                    }
                  >
                    時間を追加
                  </Button>
                </div>
              )}
              {stale && date.accepting && (
                <p className="text-sm text-amber-700">
                  日程が変更されています。回答を選び直してください。
                </p>
              )}
            </fieldset>
          </section>
        )
      })}
      <div className="flex justify-end">
        <Button
          disabled={
            pending || submitted || !dates.some((date) => date.accepting)
          }
          onClick={() => void submit()}
        >
          {submitted ? "提出済み" : "提出する"}
        </Button>
      </div>
    </div>
  )
}

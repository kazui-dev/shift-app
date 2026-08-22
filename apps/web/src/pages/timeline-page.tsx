import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import {
  CalendarRange,
  ChevronLeft,
  ChevronRight,
  LoaderCircle,
} from "lucide-react"

import { Button } from "@workspace/ui/components/button"

import { FeedbackNotice } from "@/components/feedback-notice"
import { fieldClassName, textareaClassName } from "@/components/form-styles"
import { errorMessage } from "@/api/client"
import { checkIn, submitAssignmentReport } from "@/api/assignments"
import { getTimeline } from "@/api/timeline"

function today(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`
}

function dayRange(date: string): { from: string; to: string } {
  const from = new Date(`${date}T00:00:00`)
  const to = new Date(from)
  to.setDate(to.getDate() + 1)
  return { from: from.toISOString(), to: to.toISOString() }
}

function time(value: string): string {
  return new Intl.DateTimeFormat("ja-JP", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value))
}

const hourHeight = 64
const timelineInset = 12
const hours = Array.from({ length: 25 }, (_, hour) => hour)
const weekdays = ["日", "月", "火", "水", "木", "金", "土"]
type TimelineAssignment = Awaited<
  ReturnType<typeof getTimeline>
>["assignments"][number]
const noAssignments: TimelineAssignment[] = []
type MonthTransition = { id: number; direction: -1 | 1 }

function localDate(value: string): Date {
  return new Date(`${value}T12:00:00`)
}

function dateValue(value: Date): string {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`
}

function moveDate(value: string, days: number): string {
  const next = localDate(value)
  next.setDate(next.getDate() + days)
  return dateValue(next)
}

function moveMonth(value: string, months: number): string {
  const current = localDate(value)
  const day = current.getDate()
  current.setDate(1)
  current.setMonth(current.getMonth() + months)
  const lastDay = new Date(
    current.getFullYear(),
    current.getMonth() + 1,
    0
  ).getDate()
  current.setDate(Math.min(day, lastDay))
  return dateValue(current)
}

function week(value: string): Date[] {
  const selected = localDate(value)
  selected.setDate(selected.getDate() - selected.getDay())
  return Array.from({ length: 7 }, (_, index) => {
    const day = new Date(selected)
    day.setDate(day.getDate() + index)
    return day
  })
}

function minuteFromDay(value: string, date: string): number {
  const start = new Date(`${date}T00:00:00`).getTime()
  return (new Date(value).getTime() - start) / 60_000
}

function longDate(value: string): string {
  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long",
  }).format(localDate(value))
}

function timelineQuery(date: string) {
  const range = dayRange(date)
  return {
    queryKey: ["timeline", date] as const,
    queryFn: () => getTimeline(range.from, range.to),
  }
}

function initialTimelineScrollTop(now: Date): number {
  const minute = now.getHours() * 60 + now.getMinutes()
  return Math.max(0, (minute / 60 - 2.5) * hourHeight + timelineInset)
}

function useCurrentTime(): Date {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    let timer = 0
    const update = () => {
      setNow(new Date())
      const millisecondsUntilNextMinute = 60_000 - (Date.now() % 60_000) + 20
      timer = window.setTimeout(update, millisecondsUntilNextMinute)
    }
    timer = window.setTimeout(update, 60_000 - (Date.now() % 60_000) + 20)
    return () => window.clearTimeout(timer)
  }, [])

  return now
}

function WeekRail({
  date,
  onDateChange,
  timelineSwipeProgress,
  monthTransition,
}: {
  date: string
  onDateChange: (date: string) => void
  timelineSwipeProgress: number
  monthTransition: MonthTransition | null
}) {
  const railRef = useRef<HTMLDivElement>(null)
  const indicatorRef = useRef<HTMLSpanElement>(null)
  const scrollTimerRef = useRef<number | null>(null)
  const pageDates = [moveDate(date, -7), date, moveDate(date, 7)]
  const selectedWeekday = localDate(date).getDay()
  const crossesWeekStart = selectedWeekday === 0 && timelineSwipeProgress < 0
  const crossesWeekEnd = selectedWeekday === 6 && timelineSwipeProgress > 0
  const crossesWeek = crossesWeekStart || crossesWeekEnd
  const indicatorProgress = crossesWeek ? 0 : timelineSwipeProgress
  const timelineIsSwiping = Math.abs(timelineSwipeProgress) > 0.01

  useLayoutEffect(() => {
    const rail = railRef.current
    if (!rail) return
    rail.scrollLeft =
      rail.clientWidth * (crossesWeek ? 1 + timelineSwipeProgress : 1)
  }, [crossesWeek, date, timelineSwipeProgress])

  useLayoutEffect(() => {
    if (!monthTransition) return
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return
    const direction = monthTransition.direction
    const options = {
      duration: 160,
      easing: "cubic-bezier(0.2, 0.8, 0.2, 1)",
    }
    railRef.current?.animate(
      [
        { opacity: 0.35, transform: `translateX(${direction * 16}px)` },
        { opacity: 1, transform: "translateX(0)" },
      ],
      options
    )
    indicatorRef.current?.animate(
      [
        { opacity: 0, transform: "scale(0.9)" },
        { opacity: 1, transform: "scale(1)" },
      ],
      { ...options, duration: 120 }
    )
  }, [monthTransition])

  useEffect(
    () => () => {
      if (scrollTimerRef.current !== null) {
        window.clearTimeout(scrollTimerRef.current)
      }
    },
    []
  )

  function handleScroll() {
    if (scrollTimerRef.current !== null) {
      window.clearTimeout(scrollTimerRef.current)
    }
    scrollTimerRef.current = window.setTimeout(() => {
      if (timelineIsSwiping) return
      const rail = railRef.current
      if (!rail || rail.clientWidth === 0) return
      const page = Math.round(rail.scrollLeft / rail.clientWidth)
      if (page === 0) onDateChange(moveDate(date, -7))
      if (page === 2) onDateChange(moveDate(date, 7))
    }, 100)
  }

  return (
    <div
      ref={railRef}
      aria-label="週を切り替え"
      className="flex snap-x snap-mandatory overflow-x-auto border-b pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      onScroll={handleScroll}
    >
      {pageDates.map((pageDate) => {
        const pageDays = week(pageDate)
        const firstDay = pageDays[0] ?? localDate(pageDate)
        return (
          <div
            key={dateValue(firstDay)}
            className="relative grid w-full shrink-0 snap-center grid-cols-7"
          >
            {pageDate === date && (
              <span
                aria-hidden
                className="pointer-events-none absolute top-5 left-0 grid h-8 w-[calc(100%/7)] place-items-center transition-transform [transition-duration:140ms] [transition-timing-function:cubic-bezier(0.2,0.8,0.2,1)] motion-reduce:transition-none"
                style={{
                  transform: `translateX(${(selectedWeekday + indicatorProgress) * 100}%)`,
                  ...(timelineIsSwiping ? { transition: "none" } : {}),
                }}
              >
                <span
                  ref={indicatorRef}
                  className="size-8 rounded-full bg-foreground"
                />
              </span>
            )}
            {pageDays.map((day) => {
              const value = dateValue(day)
              const selected = value === date
              return (
                <button
                  key={value}
                  type="button"
                  className="flex min-h-14 flex-col items-center justify-center gap-1 text-xs text-muted-foreground"
                  aria-current={selected ? "date" : undefined}
                  onClick={() => onDateChange(value)}
                >
                  <span>{weekdays[day.getDay()]}</span>
                  <span
                    className={`relative z-[1] grid size-8 place-items-center text-sm tabular-nums transition-colors duration-100 ${selected ? "font-semibold text-background" : "text-foreground"}`}
                  >
                    {day.getDate()}
                  </span>
                </button>
              )
            })}
          </div>
        )
      })}
    </div>
  )
}

function TimelineDay({
  date,
  assignments,
  now,
  onSelectAssignment,
}: {
  date: string
  assignments: TimelineAssignment[]
  now: Date
  onSelectAssignment: (assignmentId: string) => void
}) {
  const nowMinute = now.getHours() * 60 + now.getMinutes()
  const showNow = date === dateValue(now)

  return (
    <div
      className="relative w-full shrink-0 snap-center"
      aria-label={longDate(date)}
      style={{ height: 24 * hourHeight + timelineInset * 2 }}
    >
      {hours.map((hour, index) => (
        <div
          key={hour}
          className="absolute inset-x-0 border-t border-border/70"
          style={{ top: timelineInset + index * hourHeight }}
        >
          <span className="absolute -top-2.5 left-0 w-12 bg-background pr-2 text-right text-[0.6875rem] text-muted-foreground tabular-nums">
            {hour}:00
          </span>
        </div>
      ))}

      {assignments.map((assignment) => {
        const startMinute = Math.max(
          0,
          minuteFromDay(assignment.startsAt, date)
        )
        const endMinute = Math.min(
          24 * 60,
          minuteFromDay(assignment.endsAt, date)
        )
        const top = timelineInset + (startMinute / 60) * hourHeight
        const height = Math.max(
          30,
          ((endMinute - startMinute) / 60) * hourHeight
        )
        return (
          <button
            key={assignment.id}
            type="button"
            className="absolute right-0 left-14 animate-in overflow-hidden rounded-sm border-l-4 px-2 py-1 text-left duration-300 fade-in hover:opacity-90"
            style={{
              top,
              height,
              borderLeftColor: assignment.color,
              backgroundColor: `color-mix(in oklab, ${assignment.color} 22%, var(--background))`,
            }}
            onClick={() => onSelectAssignment(assignment.id)}
          >
            <span className="block truncate text-sm font-semibold">
              {assignment.activityName}
            </span>
            {height >= 44 && (
              <span className="block text-xs tabular-nums opacity-75">
                {time(assignment.startsAt)}–{time(assignment.endsAt)}
              </span>
            )}
          </button>
        )
      })}

      {showNow && (
        <div
          className="pointer-events-none absolute right-0 left-11 z-10 border-t border-blue-500"
          style={{ top: timelineInset + (nowMinute / 60) * hourHeight }}
        >
          <span className="absolute top-0 left-0 -translate-x-full -translate-y-1/2 rounded-full bg-blue-500 px-1.5 py-0.5 text-[0.625rem] font-semibold text-white tabular-nums">
            {now.getHours()}:{String(now.getMinutes()).padStart(2, "0")}
          </span>
        </div>
      )}
    </div>
  )
}

export function TimelinePage() {
  const queryClient = useQueryClient()
  const [date, setDate] = useState(today)
  const [checkInPending, setCheckInPending] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [reportTarget, setReportTarget] = useState<string | null>(null)
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<
    string | null
  >(null)
  const [reportKind, setReportKind] = useState<"late" | "absence">("late")
  const [reportMessage, setReportMessage] = useState("")
  const [timelineSwipeProgress, setTimelineSwipeProgress] = useState(0)
  const [monthTransition, setMonthTransition] =
    useState<MonthTransition | null>(null)
  const timelineRef = useRef<HTMLDivElement>(null)
  const timelinePagerRef = useRef<HTMLDivElement>(null)
  const timelineScrollTimerRef = useRef<number | null>(null)
  const timelineAnimationFrameRef = useRef<number | null>(null)
  const monthTransitionIdRef = useRef(0)
  const initializedTimelineRef = useRef(false)
  const now = useCurrentTime()
  const previousDate = moveDate(date, -1)
  const nextDate = moveDate(date, 1)
  const previousTimeline = useQuery(timelineQuery(previousDate))
  const timeline = useQuery(timelineQuery(date))
  const nextTimeline = useQuery(timelineQuery(nextDate))
  const assignments = timeline.data?.assignments ?? noAssignments
  const selectedAssignment = assignments.find(
    (assignment) => assignment.id === selectedAssignmentId
  )

  const changeDate = useCallback((nextDateValue: string) => {
    setSelectedAssignmentId(null)
    setReportTarget(null)
    setReportMessage("")
    setDate(nextDateValue)
  }, [])

  useLayoutEffect(() => {
    const timelineElement = timelineRef.current
    const pager = timelinePagerRef.current
    if (pager) pager.scrollLeft = pager.clientWidth
    if (timelineElement && !initializedTimelineRef.current) {
      timelineElement.scrollTop = initialTimelineScrollTop(new Date())
      initializedTimelineRef.current = true
    }
  }, [date])

  useEffect(
    () => () => {
      if (timelineScrollTimerRef.current !== null) {
        window.clearTimeout(timelineScrollTimerRef.current)
      }
      if (timelineAnimationFrameRef.current !== null) {
        window.cancelAnimationFrame(timelineAnimationFrameRef.current)
      }
    },
    []
  )

  function handleTimelineScroll() {
    const pager = timelinePagerRef.current
    if (pager && pager.clientWidth > 0) {
      const progress = Math.max(
        -1,
        Math.min(1, pager.scrollLeft / pager.clientWidth - 1)
      )
      if (timelineAnimationFrameRef.current !== null) {
        window.cancelAnimationFrame(timelineAnimationFrameRef.current)
      }
      timelineAnimationFrameRef.current = window.requestAnimationFrame(() => {
        setTimelineSwipeProgress(progress)
        timelineAnimationFrameRef.current = null
      })
    }
    if (timelineScrollTimerRef.current !== null) {
      window.clearTimeout(timelineScrollTimerRef.current)
    }
    timelineScrollTimerRef.current = window.setTimeout(() => {
      const currentPager = timelinePagerRef.current
      if (!currentPager || currentPager.clientWidth === 0) return
      const page = Math.round(
        currentPager.scrollLeft / currentPager.clientWidth
      )
      if (timelineAnimationFrameRef.current !== null) {
        window.cancelAnimationFrame(timelineAnimationFrameRef.current)
        timelineAnimationFrameRef.current = null
      }
      setTimelineSwipeProgress(0)
      if (page === 0) changeDate(previousDate)
      if (page === 2) changeDate(nextDate)
    }, 100)
  }

  function changeMonth(direction: -1 | 1) {
    monthTransitionIdRef.current += 1
    setMonthTransition({ id: monthTransitionIdRef.current, direction })
    changeDate(moveMonth(date, direction))
  }

  async function recordCheckIn(assignmentId: string) {
    setCheckInPending(assignmentId)
    setMessage(null)
    try {
      await checkIn(assignmentId)
      await queryClient.invalidateQueries({ queryKey: ["timeline", date] })
      setMessage("出勤を記録しました。")
    } catch (error) {
      setMessage(errorMessage(error))
    } finally {
      setCheckInPending(null)
    }
  }

  async function submitReport(assignmentId: string) {
    setCheckInPending(assignmentId)
    setMessage(null)
    try {
      await submitAssignmentReport(assignmentId, {
        kind: reportKind,
        message: reportMessage,
      })
      setReportTarget(null)
      setReportMessage("")
      setMessage("連絡を送信しました。")
    } catch (error) {
      setMessage(errorMessage(error))
    } finally {
      setCheckInPending(null)
    }
  }

  return (
    <section className="space-y-4">
      <header className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-1">
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label="前の月"
            onClick={() => changeMonth(-1)}
          >
            <ChevronLeft />
          </Button>
          <span className="min-w-16 text-center font-semibold">
            {localDate(date).getMonth() + 1}月
          </span>
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label="次の月"
            onClick={() => changeMonth(1)}
          >
            <ChevronRight />
          </Button>
        </div>
        <div className="flex items-center gap-1">
          <Button
            render={<Link to="/availability" />}
            size="icon-sm"
            variant="ghost"
          >
            <CalendarRange />
            <span className="sr-only">シフト希望</span>
          </Button>
        </div>
      </header>

      <WeekRail
        date={date}
        onDateChange={changeDate}
        timelineSwipeProgress={timelineSwipeProgress}
        monthTransition={monthTransition}
      />

      <p className="py-1 text-center text-sm font-semibold">{longDate(date)}</p>

      <div className="relative h-[calc(100svh-17rem)] min-h-[28rem]">
        <div
          ref={timelineRef}
          className="size-full overflow-x-hidden overflow-y-auto overscroll-y-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          <div
            ref={timelinePagerRef}
            aria-label="日付を切り替え"
            className="flex w-full snap-x snap-mandatory overflow-x-auto overflow-y-hidden overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            style={{ height: 24 * hourHeight + timelineInset * 2 }}
            onScroll={handleTimelineScroll}
          >
            {[
              { date: previousDate, query: previousTimeline },
              { date, query: timeline },
              { date: nextDate, query: nextTimeline },
            ].map((page) => (
              <TimelineDay
                key={page.date}
                date={page.date}
                assignments={page.query.data?.assignments ?? noAssignments}
                now={now}
                onSelectAssignment={(assignmentId) => {
                  if (page.date !== date) changeDate(page.date)
                  setSelectedAssignmentId(assignmentId)
                }}
              />
            ))}
          </div>
        </div>
        {timeline.isError && (
          <Button
            className="absolute top-2 right-2"
            size="sm"
            variant="outline"
            title={errorMessage(timeline.error)}
            onClick={() => timeline.refetch()}
          >
            予定を再読み込み
          </Button>
        )}
      </div>

      {selectedAssignment && (
        <section className="space-y-3 border-t pt-4">
          <div>
            <p className="font-semibold">{selectedAssignment.activityName}</p>
            <p className="text-sm text-muted-foreground">
              {time(selectedAssignment.startsAt)}–
              {time(selectedAssignment.endsAt)} · {selectedAssignment.place}
            </p>
            {selectedAssignment.notes && (
              <p className="mt-2 text-sm">{selectedAssignment.notes}</p>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {selectedAssignment.checkedInAt ? (
              <p className="self-center text-xs text-muted-foreground">
                {time(selectedAssignment.checkedInAt)}に出勤記録済み
              </p>
            ) : (
              <Button
                size="sm"
                disabled={
                  checkInPending !== null ||
                  timeline.dataUpdatedAt <
                    new Date(selectedAssignment.startsAt).getTime() ||
                  timeline.dataUpdatedAt >
                    new Date(selectedAssignment.endsAt).getTime()
                }
                onClick={() => void recordCheckIn(selectedAssignment.id)}
              >
                {checkInPending === selectedAssignment.id && (
                  <LoaderCircle className="animate-spin" />
                )}
                出勤
              </Button>
            )}
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                setReportTarget((current) =>
                  current === selectedAssignment.id
                    ? null
                    : selectedAssignment.id
                )
              }
            >
              遅刻・欠勤連絡
            </Button>
          </div>
          {reportTarget === selectedAssignment.id && (
            <div className="space-y-3 border-t pt-4">
              <select
                aria-label="連絡種別"
                className={fieldClassName}
                value={reportKind}
                onChange={(event) => {
                  const kind = event.target.value
                  if (kind === "late" || kind === "absence") {
                    setReportKind(kind)
                  }
                }}
              >
                <option value="late">遅刻</option>
                <option value="absence">欠勤</option>
              </select>
              <textarea
                className={textareaClassName}
                maxLength={1000}
                placeholder="到着見込み、理由など"
                required
                value={reportMessage}
                onChange={(event) => setReportMessage(event.target.value)}
              />
              <Button
                size="sm"
                disabled={!reportMessage.trim() || checkInPending !== null}
                onClick={() => void submitReport(selectedAssignment.id)}
              >
                送信
              </Button>
            </div>
          )}
        </section>
      )}
      {message && (
        <FeedbackNotice message={message} onDismiss={() => setMessage(null)} />
      )}
    </section>
  )
}

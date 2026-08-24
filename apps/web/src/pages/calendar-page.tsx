import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import { LoaderCircle, SquarePen } from "lucide-react"

import { Button } from "@workspace/ui/components/button"
import { Textarea } from "@workspace/ui/components/textarea"
import { toast } from "@workspace/ui/lib/toast"

import { useCalendarViewState } from "@/components/calendar-view-context"
import { MonthSwitcher } from "@/components/calendar/month-switcher"
import { useSwipePager } from "@/components/calendar/use-swipe-pager"
import { nativeSelectClassName } from "@/components/form-styles"
import { useOfflineMode } from "@/components/offline-mode-context"
import { ResponsiveDialog } from "@/components/responsive-overlay"
import { errorMessage } from "@/api/client"
import { checkIn, submitAssignmentReport } from "@/api/assignments"
import { getMyAssignments } from "@/api/assignments"

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
const calendarInset = 12
const hours = Array.from({ length: 25 }, (_, hour) => hour)
const weekdays = ["日", "月", "火", "水", "木", "金", "土"]
type CalendarAssignment = Awaited<
  ReturnType<typeof getMyAssignments>
>["assignments"][number]
const noAssignments: CalendarAssignment[] = []
type RailTransition = {
  id: number
  fromDate: string
}
type DateChangeOptions = {
  preservePreferredDay?: boolean
  railTransition?: Omit<RailTransition, "id">
}
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

function moveMonth(
  value: string,
  months: number,
  preferredDay: number
): string {
  const current = localDate(value)
  current.setDate(1)
  current.setMonth(current.getMonth() + months)
  const lastDay = new Date(
    current.getFullYear(),
    current.getMonth() + 1,
    0
  ).getDate()
  current.setDate(Math.min(preferredDay, lastDay))
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

function weekStart(value: string): string {
  return dateValue(week(value)[0] ?? localDate(value))
}

function weekdayTextColor(weekday: number): string {
  if (weekday === 0) return "text-red-600 dark:text-red-400"
  if (weekday === 6) return "text-blue-600 dark:text-blue-400"
  return "text-foreground"
}

function minuteFromDay(value: string, date: string): number {
  const start = new Date(`${date}T00:00:00`).getTime()
  return (new Date(value).getTime() - start) / 60_000
}

function longDate(value: string): string {
  const date = localDate(value)
  const formattedDate = new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(date)
  return `${formattedDate}（${weekdays[date.getDay()]}）`
}

function calendarQuery(date: string) {
  const range = dayRange(date)
  return {
    queryKey: ["assignments", date] as const,
    queryFn: () => getMyAssignments(range.from, range.to),
  }
}

function initialCalendarScrollTop(now: Date): number {
  const minute = now.getHours() * 60 + now.getMinutes()
  return Math.max(0, (minute / 60 - 2.5) * hourHeight + calendarInset)
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
  onRailTransitionEnd,
  calendarSwipeProgress,
  railTransition,
}: {
  date: string
  onDateChange: (date: string) => void
  onRailTransitionEnd: (id: number) => void
  calendarSwipeProgress: number
  railTransition: RailTransition | null
}) {
  const previousRailRef = useRef<HTMLDivElement>(null)
  const [railSwipeProgress, setRailSwipeProgress] = useState(0)
  const pageDates = [moveDate(date, -7), date, moveDate(date, 7)]
  const selectedWeekday = localDate(date).getDay()
  const crossesWeek =
    (selectedWeekday === 0 && calendarSwipeProgress < 0) ||
    (selectedWeekday === 6 && calendarSwipeProgress > 0)
  const boundaryDirection: -1 | 1 = calendarSwipeProgress < 0 ? -1 : 1
  const boundaryProgress = crossesWeek ? Math.abs(calendarSwipeProgress) : 0
  const boundaryDate = crossesWeek ? moveDate(date, boundaryDirection) : null
  const calendarIsSwiping = Math.abs(calendarSwipeProgress) > 0.01
  const railIsSwiping = Math.abs(railSwipeProgress) > 0.01
  const railPagePosition = 1 + railSwipeProgress
  const railPager = useSwipePager({
    pageKey: date,
    onNavigate: (direction) => onDateChange(moveDate(date, direction * 7)),
    onProgress: setRailSwipeProgress,
  })

  useLayoutEffect(() => {
    if (!railTransition) return undefined
    const rail = railPager.viewportRef.current
    const previousRail = previousRailRef.current
    if (!rail || !previousRail) return undefined
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      previousRail.style.visibility = "hidden"
      const finishTimer = window.setTimeout(
        () => onRailTransitionEnd(railTransition.id),
        0
      )
      return () => window.clearTimeout(finishTimer)
    }
    previousRail.style.visibility = "visible"
    const options = {
      duration: 300,
      easing: "cubic-bezier(0.4, 0, 0.2, 1)",
    }
    const incomingAnimation = rail.animate(
      [{ opacity: 0 }, { opacity: 1 }],
      options
    )
    const previousRailAnimation = previousRail.animate(
      [{ opacity: 1 }, { opacity: 0 }],
      { ...options, fill: "forwards" }
    )
    void previousRailAnimation.finished
      .then(() => {
        previousRail.style.visibility = "hidden"
        onRailTransitionEnd(railTransition.id)
      })
      .catch(() => undefined)
    return () => {
      incomingAnimation.cancel()
      previousRailAnimation.cancel()
    }
  }, [railTransition, onRailTransitionEnd, railPager.viewportRef])

  return (
    <div className="relative overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-1 z-20 grid grid-cols-7 text-xs"
      >
        {weekdays.map((weekday, index) => (
          <span
            key={weekday}
            className={`text-center leading-4 ${weekdayTextColor(index)}`}
          >
            {weekday}
          </span>
        ))}
      </div>
      <div
        ref={railPager.viewportRef}
        aria-label="週を切り替え"
        className="touch-pan-y overflow-hidden border-b select-none"
        onClickCapture={railPager.handleClickCapture}
        onLostPointerCapture={railPager.handleLostPointerCapture}
        onPointerCancel={railPager.handlePointerCancel}
        onPointerDown={railPager.handlePointerDown}
        onPointerMove={railPager.handlePointerMove}
        onPointerUp={railPager.handlePointerUp}
      >
        <div
          ref={railPager.trackRef}
          className="flex w-full"
          style={railPager.trackStyle}
        >
          {pageDates.map((pageDate, pageIndex) => {
            const pageDays = week(pageDate)
            const firstDay = pageDays[0] ?? localDate(pageDate)
            const indicatorOpacity = Math.max(
              0,
              1 - Math.abs(railPagePosition - pageIndex)
            )
            return (
              <div
                key={dateValue(firstDay)}
                className="relative grid w-full shrink-0 grid-cols-7 pb-3"
                style={
                  crossesWeek && pageIndex === 1
                    ? { opacity: 1 - boundaryProgress }
                    : undefined
                }
              >
                <span
                  aria-hidden
                  className="pointer-events-none absolute bottom-4 left-0 grid h-8 w-[calc(100%/7)] place-items-center transition-[transform,opacity] [transition-duration:160ms] [transition-timing-function:cubic-bezier(0.2,0.8,0.2,1)] motion-reduce:transition-none"
                  style={{
                    opacity: indicatorOpacity,
                    transform: `translateX(${(selectedWeekday + (pageIndex === 1 ? calendarSwipeProgress : 0)) * 100}%)`,
                    ...(calendarIsSwiping || railIsSwiping || railTransition
                      ? { transition: "none" }
                      : {}),
                  }}
                >
                  <span className="size-8 rounded-full bg-blue-500/15 dark:bg-blue-400/20" />
                </span>
                {pageDays.map((day) => {
                  const value = dateValue(day)
                  const selected = value === date
                  return (
                    <button
                      key={value}
                      type="button"
                      className="grid min-h-16 grid-rows-[1rem_2rem] content-center justify-items-center gap-2 text-xs"
                      aria-label={longDate(value)}
                      aria-current={selected ? "date" : undefined}
                      onClick={() => onDateChange(value)}
                    >
                      <span aria-hidden className="h-4" />
                      <span
                        className={`relative z-[1] grid size-8 place-items-center text-sm text-foreground tabular-nums ${selected ? "font-semibold" : ""}`}
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
      </div>

      {boundaryDate && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 z-[5] grid grid-cols-7 border-b pb-3"
          style={{ opacity: boundaryProgress }}
        >
          <span
            className="pointer-events-none absolute bottom-4 left-0 grid h-8 w-[calc(100%/7)] place-items-center"
            style={{
              transform: `translateX(${(localDate(boundaryDate).getDay() - boundaryDirection * (1 - boundaryProgress)) * 100}%)`,
            }}
          >
            <span className="size-8 rounded-full bg-blue-500/15 dark:bg-blue-400/20" />
          </span>
          {week(boundaryDate).map((day) => {
            const selected = dateValue(day) === boundaryDate
            return (
              <div
                key={dateValue(day)}
                className="grid min-h-16 grid-rows-[1rem_2rem] content-center justify-items-center gap-2 text-xs"
              >
                <span className="h-4" />
                <span
                  className={`relative z-[1] grid size-8 place-items-center text-sm text-foreground tabular-nums ${selected ? "font-semibold" : ""}`}
                >
                  {day.getDate()}
                </span>
              </div>
            )
          })}
        </div>
      )}

      {railTransition && (
        <div
          ref={previousRailRef}
          aria-hidden
          className="pointer-events-none absolute inset-0 z-10 grid grid-cols-7 border-b pb-3"
        >
          <span
            className="pointer-events-none absolute bottom-4 left-0 grid h-8 w-[calc(100%/7)] place-items-center"
            style={{
              transform: `translateX(${localDate(railTransition.fromDate).getDay() * 100}%)`,
            }}
          >
            <span className="size-8 rounded-full bg-blue-500/15 dark:bg-blue-400/20" />
          </span>
          {week(railTransition.fromDate).map((day) => {
            const selected = dateValue(day) === railTransition.fromDate
            return (
              <div
                key={dateValue(day)}
                className="grid min-h-16 grid-rows-[1rem_2rem] content-center justify-items-center gap-2 text-xs"
              >
                <span className="h-4" />
                <span
                  className={`relative z-[1] grid size-8 place-items-center text-sm text-foreground tabular-nums ${selected ? "font-semibold" : ""}`}
                >
                  {day.getDate()}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function CalendarDay({
  date,
  assignments,
  now,
  onSelectAssignment,
}: {
  date: string
  assignments: CalendarAssignment[]
  now: Date
  onSelectAssignment: (assignmentId: string) => void
}) {
  const nowMinute = now.getHours() * 60 + now.getMinutes()
  const showNow = date === dateValue(now)

  return (
    <div
      className="relative w-full shrink-0"
      aria-label={longDate(date)}
      style={{ height: 24 * hourHeight + calendarInset * 2 }}
    >
      {hours.map((hour, index) => (
        <div
          key={hour}
          className="absolute inset-x-0 border-t border-border/70"
          style={{ top: calendarInset + index * hourHeight }}
        >
          <span className="absolute -top-2.5 left-0 w-12 bg-background pr-2 text-right text-[0.6875rem] text-muted-foreground tabular-nums">
            {hour % 24}:00
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
        const top = calendarInset + (startMinute / 60) * hourHeight
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
          style={{ top: calendarInset + (nowMinute / 60) * hourHeight }}
        >
          <span className="absolute top-0 left-0 -translate-x-full -translate-y-1/2 rounded-full bg-blue-500 px-1.5 py-0.5 text-[0.625rem] font-semibold text-white tabular-nums">
            {now.getHours()}:{String(now.getMinutes()).padStart(2, "0")}
          </span>
        </div>
      )}
    </div>
  )
}

export function CalendarPage() {
  const queryClient = useQueryClient()
  const offline = useOfflineMode()
  const { date, setDate, preferredDayRef, scrollTopRef } =
    useCalendarViewState()
  const [checkInPending, setCheckInPending] = useState<string | null>(null)
  const [reportTarget, setReportTarget] = useState<string | null>(null)
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<
    string | null
  >(null)
  const [reportKind, setReportKind] = useState<"late" | "absence">("late")
  const [reportMessage, setReportMessage] = useState("")
  const [calendarSwipeProgress, setCalendarSwipeProgress] = useState(0)
  const [railTransition, setRailTransition] = useState<RailTransition | null>(
    null
  )
  const calendarRef = useRef<HTMLDivElement>(null)
  const railTransitionIdRef = useRef(0)
  const initializedCalendarRef = useRef(false)
  const now = useCurrentTime()
  const previousDate = moveDate(date, -1)
  const nextDate = moveDate(date, 1)
  const previousCalendar = useQuery(calendarQuery(previousDate))
  const calendar = useQuery(calendarQuery(date))
  const nextCalendar = useQuery(calendarQuery(nextDate))
  const assignments = calendar.data?.assignments ?? noAssignments
  const selectedAssignment = assignments.find(
    (assignment) => assignment.id === selectedAssignmentId
  )

  const changeDate = useCallback(
    (nextDateValue: string, options: DateChangeOptions = {}) => {
      if (!options.preservePreferredDay) {
        preferredDayRef.current = localDate(nextDateValue).getDate()
      }
      if (options.railTransition) {
        railTransitionIdRef.current += 1
        setRailTransition({
          ...options.railTransition,
          id: railTransitionIdRef.current,
        })
      } else {
        setRailTransition(null)
      }
      setSelectedAssignmentId(null)
      setReportTarget(null)
      setReportMessage("")
      setDate(nextDateValue)
    },
    [preferredDayRef, setDate]
  )

  const finishRailTransition = useCallback((id: number) => {
    setRailTransition((current) => (current?.id === id ? null : current))
  }, [])

  const calendarPager = useSwipePager({
    pageKey: date,
    onNavigate: (direction) => changeDate(moveDate(date, direction)),
    onProgress: setCalendarSwipeProgress,
  })

  useLayoutEffect(() => {
    const calendarElement = calendarRef.current
    if (calendarElement && !initializedCalendarRef.current) {
      const scrollTop =
        scrollTopRef.current ?? initialCalendarScrollTop(new Date())
      calendarElement.scrollTop = scrollTop
      scrollTopRef.current = scrollTop
      initializedCalendarRef.current = true
    }
  }, [date, scrollTopRef])

  function changeMonth(months: number) {
    changeDate(moveMonth(date, months, preferredDayRef.current), {
      preservePreferredDay: true,
      railTransition: { fromDate: date },
    })
  }

  function chooseDate(nextDateValue: string) {
    if (!nextDateValue || nextDateValue === date) return
    changeDate(nextDateValue, {
      ...(weekStart(nextDateValue) === weekStart(date)
        ? {}
        : { railTransition: { fromDate: date } }),
    })
  }

  async function recordCheckIn(assignmentId: string) {
    setCheckInPending(assignmentId)
    try {
      await checkIn(assignmentId)
      await queryClient.invalidateQueries({ queryKey: ["assignments", date] })
      toast.success("出勤を記録しました。")
    } catch (error) {
      toast.error(errorMessage(error))
    } finally {
      setCheckInPending(null)
    }
  }

  async function submitReport(assignmentId: string) {
    setCheckInPending(assignmentId)
    try {
      await submitAssignmentReport(assignmentId, {
        kind: reportKind,
        message: reportMessage,
      })
      setReportTarget(null)
      setReportMessage("")
      toast.success("連絡を送信しました。")
    } catch (error) {
      toast.error(errorMessage(error))
    } finally {
      setCheckInPending(null)
    }
  }

  return (
    <section className="flex min-h-0 flex-1 flex-col gap-3">
      <header className="flex shrink-0 items-center justify-between gap-3">
        <MonthSwitcher
          date={date}
          onDateChange={chooseDate}
          onMonthChange={changeMonth}
        />
        {!offline && (
          <div className="flex items-center gap-1">
            <Button
              render={<Link to="/availability" />}
              nativeButton={false}
              variant="ghost"
            >
              <SquarePen />
              シフト希望
            </Button>
          </div>
        )}
      </header>

      <WeekRail
        date={date}
        onDateChange={changeDate}
        onRailTransitionEnd={finishRailTransition}
        calendarSwipeProgress={calendarSwipeProgress}
        railTransition={railTransition}
      />

      <p className="shrink-0 py-0.5 text-center text-sm font-semibold">
        {longDate(date)}
      </p>

      <div className="relative min-h-0 flex-1">
        <div
          ref={calendarRef}
          className="size-full overflow-x-hidden overflow-y-auto overscroll-y-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          onScroll={(event) => {
            scrollTopRef.current = event.currentTarget.scrollTop
          }}
        >
          <div
            ref={calendarPager.viewportRef}
            aria-label="日付を切り替え"
            className="w-full touch-pan-y overflow-hidden select-none"
            style={{ height: 24 * hourHeight + calendarInset * 2 }}
            onClickCapture={calendarPager.handleClickCapture}
            onLostPointerCapture={calendarPager.handleLostPointerCapture}
            onPointerCancel={calendarPager.handlePointerCancel}
            onPointerDown={calendarPager.handlePointerDown}
            onPointerMove={calendarPager.handlePointerMove}
            onPointerUp={calendarPager.handlePointerUp}
          >
            <div
              ref={calendarPager.trackRef}
              className="flex w-full"
              style={{
                ...calendarPager.trackStyle,
                height: 24 * hourHeight + calendarInset * 2,
              }}
            >
              {[
                { date: previousDate, query: previousCalendar },
                { date, query: calendar },
                { date: nextDate, query: nextCalendar },
              ].map((page) => (
                <CalendarDay
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
        </div>
        {calendar.isError && !offline && (
          <Button
            className="absolute top-2 right-2"
            size="sm"
            variant="outline"
            title={errorMessage(calendar.error)}
            onClick={() => calendar.refetch()}
          >
            予定を再読み込み
          </Button>
        )}
        {selectedAssignment && (
          <ResponsiveDialog
            open
            title={selectedAssignment.activityName}
            description={`${time(selectedAssignment.startsAt)}–${time(selectedAssignment.endsAt)} · ${selectedAssignment.place}`}
            onOpenChange={(open) => {
              if (open) return
              setSelectedAssignmentId(null)
              setReportTarget(null)
              setReportMessage("")
            }}
          >
            <div className="space-y-3">
              {selectedAssignment.notes && (
                <p className="text-sm">{selectedAssignment.notes}</p>
              )}
              <div className="flex flex-wrap gap-2">
                {selectedAssignment.checkedInAt ? (
                  <p className="self-center text-xs text-muted-foreground">
                    {time(selectedAssignment.checkedInAt)}に出勤記録済み
                  </p>
                ) : !offline ? (
                  <Button
                    size="sm"
                    disabled={
                      checkInPending !== null ||
                      calendar.dataUpdatedAt <
                        new Date(selectedAssignment.startsAt).getTime() ||
                      calendar.dataUpdatedAt >
                        new Date(selectedAssignment.endsAt).getTime()
                    }
                    onClick={() => void recordCheckIn(selectedAssignment.id)}
                  >
                    {checkInPending === selectedAssignment.id && (
                      <LoaderCircle className="animate-spin" />
                    )}
                    出勤
                  </Button>
                ) : null}
                {!offline && (
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
                )}
              </div>
              {!offline && reportTarget === selectedAssignment.id && (
                <div className="space-y-3 border-t pt-4">
                  <select
                    aria-label="連絡種別"
                    className={nativeSelectClassName}
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
                  <Textarea
                    className="min-h-24"
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
            </div>
          </ResponsiveDialog>
        )}
      </div>
    </section>
  )
}

import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import { flushSync } from "react-dom"
import { useQueries, useQuery, useQueryClient } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import { LoaderCircle, SquarePen } from "lucide-react"

import { Button } from "@workspace/ui/components/button"
import { Textarea } from "@workspace/ui/components/textarea"
import { toast } from "@workspace/ui/lib/toast"

import { useCalendarViewState } from "@/components/calendar-view-context"
import { MonthSwitcher } from "@/components/calendar/month-switcher"
import {
  type WeekRailPreviewController,
  WeekRail,
} from "@/components/calendar/week-rail"
import { nativeSelectClassName } from "@/components/form-styles"
import { useOfflineMode } from "@/components/offline-mode-context"
import { ResponsiveDialog } from "@/components/responsive-overlay"
import { errorMessage } from "@/api/client"
import {
  assignmentMonthQuery,
  assignmentsByDate,
  checkIn,
  submitAssignmentReport,
  type CalendarAssignment,
} from "@/api/assignments"
import {
  dayPagerBoundaryOffset,
  dayPagerCenterPage,
  dayPagerDates,
  dayPagerPosition,
  dayPagerPreview,
  dayPagerSettleOffset,
  localDate,
  monthDistance,
  monthValue,
  moveDate,
  monthValuesForDates,
  moveMonth,
  moveMonthValue,
} from "@/lib/calendar-dates"
import {
  japanDateTime,
  japanTimeZone,
  minutesFromJapanDateStart,
  type JapanDateTime,
} from "@/lib/japan-time"

function time(value: string): string {
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: japanTimeZone,
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value))
}

const hourHeight = 64
const calendarInset = 12
const fallbackScrollEndDelay = 160
const assignmentPrefetchRadius = 6
const hours = Array.from({ length: 25 }, (_, hour) => hour)
const weekdays = ["日", "月", "火", "水", "木", "金", "土"]
const noAssignments: CalendarAssignment[] = []
type DateChangeOptions = {
  preservePreferredDay?: boolean
  preserveWeekRailPreview?: boolean
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

function initialCalendarScrollTop(now: Date): number {
  const japanNow = japanDateTime(now)
  const minute = japanNow.hour * 60 + japanNow.minute
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

const CalendarDay = memo(function CalendarDay({
  date,
  assignments,
  now,
  onSelectAssignment,
}: {
  date: string
  assignments: CalendarAssignment[]
  now: JapanDateTime
  onSelectAssignment: (date: string, assignmentId: string) => void
}) {
  const nowMinute = now.hour * 60 + now.minute
  const showNow = date === now.date

  return (
    <div
      className="relative w-full shrink-0 snap-center [scroll-snap-stop:always]"
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
          minutesFromJapanDateStart(assignment.startsAt, date)
        )
        const endMinute = Math.min(
          24 * 60,
          minutesFromJapanDateStart(assignment.endsAt, date)
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
            className="absolute right-0 left-14 overflow-hidden rounded-sm border-l-4 px-2 py-1 text-left hover:opacity-90"
            style={{
              top,
              height,
              borderLeftColor: assignment.color,
              backgroundColor: `color-mix(in oklab, ${assignment.color} 22%, var(--background))`,
            }}
            onClick={() => onSelectAssignment(date, assignment.id)}
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
            {now.hour}:{String(now.minute).padStart(2, "0")}
          </span>
        </div>
      )}
    </div>
  )
})

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
  const calendarRef = useRef<HTMLDivElement>(null)
  const calendarPagerRef = useRef<HTMLDivElement>(null)
  const calendarScrollTimerRef = useRef<number | null>(null)
  const calendarAnimationFrameRef = useRef<number | null>(null)
  const calendarGestureActiveRef = useRef(false)
  const dayPagerPreviewActiveRef = useRef(false)
  const currentDateRef = useRef(date)
  const weekRailPreviewRef = useRef<WeekRailPreviewController>(null)
  const previousPrefetchMonthRef = useRef(monthValue(date))
  const initializedCalendarRef = useRef(false)
  const currentTime = useCurrentTime()
  const now = japanDateTime(currentTime)
  currentDateRef.current = date
  const calendarDates = useMemo(() => dayPagerDates(date), [date])
  const selectedMonth = monthValue(date)
  const selectedMonthQuery = useQuery(assignmentMonthQuery(selectedMonth))
  const windowMonths = useMemo(
    () => monthValuesForDates(calendarDates),
    [calendarDates]
  )
  const otherWindowMonths = useMemo(
    () => windowMonths.filter((month) => month !== selectedMonth),
    [selectedMonth, windowMonths]
  )
  const windowMonthQueries = useQueries({
    queries: otherWindowMonths.map(assignmentMonthQuery),
  })
  const assignmentDataByDate = useMemo(
    () =>
      assignmentsByDate(calendarDates, [
        selectedMonthQuery.data,
        ...windowMonthQueries.map((query) => query.data),
      ]),
    [calendarDates, selectedMonthQuery.data, windowMonthQueries]
  )
  const assignments = assignmentDataByDate.get(date) ?? noAssignments
  const selectedAssignment = assignments.find(
    (assignment) => assignment.id === selectedAssignmentId
  )

  const dismissDayPagerPreview = useCallback(() => {
    if (calendarScrollTimerRef.current !== null) {
      window.clearTimeout(calendarScrollTimerRef.current)
      calendarScrollTimerRef.current = null
    }
    if (calendarAnimationFrameRef.current !== null) {
      window.cancelAnimationFrame(calendarAnimationFrameRef.current)
      calendarAnimationFrameRef.current = null
    }
    calendarGestureActiveRef.current = false
    dayPagerPreviewActiveRef.current = false
    weekRailPreviewRef.current?.dismiss()
  }, [])

  const changeDate = useCallback(
    (nextDateValue: string, options: DateChangeOptions = {}) => {
      if (!options.preservePreferredDay) {
        preferredDayRef.current = localDate(nextDateValue).getDate()
      }
      setSelectedAssignmentId(null)
      setReportTarget(null)
      setReportMessage("")
      if (!options.preserveWeekRailPreview) dismissDayPagerPreview()
      currentDateRef.current = nextDateValue
      setDate(nextDateValue)
    },
    [dismissDayPagerPreview, preferredDayRef, setDate]
  )

  useLayoutEffect(() => {
    const calendarElement = calendarRef.current
    const pager = calendarPagerRef.current
    if (pager && pager.clientWidth > 0) {
      if (calendarAnimationFrameRef.current !== null) {
        window.cancelAnimationFrame(calendarAnimationFrameRef.current)
        calendarAnimationFrameRef.current = null
      }
      const center = dayPagerCenterPage * pager.clientWidth
      if (Math.abs(pager.scrollLeft - center) > 1) {
        pager.scrollLeft = center
      }
    }
    if (calendarElement && !initializedCalendarRef.current) {
      const scrollTop =
        scrollTopRef.current ?? initialCalendarScrollTop(new Date())
      calendarElement.scrollTop = scrollTop
      scrollTopRef.current = scrollTop
      initializedCalendarRef.current = true
    }
  }, [date, scrollTopRef])

  useEffect(() => {
    const pager = calendarPagerRef.current
    if (!pager) return undefined
    const handleResize = () => {
      if (pager.clientWidth > 0) {
        pager.scrollLeft = dayPagerCenterPage * pager.clientWidth
      }
    }
    window.addEventListener("resize", handleResize)
    return () => window.removeEventListener("resize", handleResize)
  }, [])

  useEffect(() => {
    if (!selectedMonthQuery.isSuccess) return undefined
    const previousMonth = previousPrefetchMonthRef.current
    previousPrefetchMonthRef.current = selectedMonth
    const direction = Math.sign(monthDistance(previousMonth, selectedMonth))
    const directionOrder = direction < 0 ? [-1, 1] : [1, -1]
    let cancelled = false
    const prefetchNearbyMonths = async (distance: number): Promise<void> => {
      if (cancelled || distance > assignmentPrefetchRadius) return
      await Promise.all(
        directionOrder.map((offset) =>
          queryClient.prefetchQuery(
            assignmentMonthQuery(
              moveMonthValue(selectedMonth, offset * distance)
            )
          )
        )
      )
      await prefetchNearbyMonths(distance + 1)
    }
    void prefetchNearbyMonths(1)
    return () => {
      cancelled = true
    }
  }, [queryClient, selectedMonth, selectedMonthQuery.isSuccess])

  useEffect(
    () => () => {
      if (calendarScrollTimerRef.current !== null) {
        window.clearTimeout(calendarScrollTimerRef.current)
      }
      if (calendarAnimationFrameRef.current !== null) {
        window.cancelAnimationFrame(calendarAnimationFrameRef.current)
      }
    },
    []
  )

  const settleCalendarScroll = useCallback(
    (atPageBoundary = false) => {
      const pager = calendarPagerRef.current
      if (!pager || pager.clientWidth === 0) return false
      const offset = atPageBoundary
        ? dayPagerBoundaryOffset(pager.scrollLeft, pager.clientWidth)
        : dayPagerSettleOffset(pager.scrollLeft, pager.clientWidth)
      if (offset === null) return false
      const pageBoundary = (offset + dayPagerCenterPage) * pager.clientWidth
      if (calendarScrollTimerRef.current !== null) {
        window.clearTimeout(calendarScrollTimerRef.current)
        calendarScrollTimerRef.current = null
      }
      if (Math.abs(pager.scrollLeft - pageBoundary) > 1) {
        pager.scrollLeft = pageBoundary
      }
      if (calendarAnimationFrameRef.current !== null) {
        window.cancelAnimationFrame(calendarAnimationFrameRef.current)
        calendarAnimationFrameRef.current = null
      }
      const previewWasActive = dayPagerPreviewActiveRef.current
      dayPagerPreviewActiveRef.current = false
      const nextDate = moveDate(currentDateRef.current, offset)
      if (previewWasActive || offset !== 0) {
        weekRailPreviewRef.current?.commit(nextDate)
      }
      if (offset === 0) return true

      // The outer pages absorb a gesture that starts before the preceding snap
      // is committed. Once the physical offset settles, replace the five dates
      // and synchronously rebase the native scroller to its center page.
      flushSync(() => {
        changeDate(nextDate, { preserveWeekRailPreview: true })
      })
      pager.scrollLeft = dayPagerCenterPage * pager.clientWidth
      return true
    },
    [changeDate]
  )

  useEffect(() => {
    const pager = calendarPagerRef.current
    if (!pager || !("onscrollend" in pager)) return undefined
    const handleScrollEnd = () => {
      if (!calendarGestureActiveRef.current) settleCalendarScroll()
    }
    pager.addEventListener("scrollend", handleScrollEnd)
    return () => pager.removeEventListener("scrollend", handleScrollEnd)
  }, [settleCalendarScroll])

  function settleCalendarScrollFallback() {
    if (calendarGestureActiveRef.current) {
      calendarScrollTimerRef.current = window.setTimeout(
        settleCalendarScrollFallback,
        fallbackScrollEndDelay
      )
      return
    }
    settleCalendarScroll()
  }

  function handleCalendarScroll() {
    if (!calendarGestureActiveRef.current && settleCalendarScroll(true)) {
      return
    }
    if (calendarAnimationFrameRef.current !== null) {
      window.cancelAnimationFrame(calendarAnimationFrameRef.current)
    }
    calendarAnimationFrameRef.current = window.requestAnimationFrame(() => {
      const pager = calendarPagerRef.current
      if (pager && pager.clientWidth > 0) {
        const position = dayPagerPosition(pager.scrollLeft, pager.clientWidth)
        const preview =
          position === null ? null : dayPagerPreview(calendarDates, position)
        const betweenPages =
          preview && preview.progress > 0 && preview.progress < 1
        if (preview && (dayPagerPreviewActiveRef.current || betweenPages)) {
          dayPagerPreviewActiveRef.current = true
          weekRailPreviewRef.current?.update(preview)
        }
      }
      calendarAnimationFrameRef.current = null
    })
    const pager = calendarPagerRef.current
    if (pager && !("onscrollend" in pager)) {
      if (calendarScrollTimerRef.current !== null) {
        window.clearTimeout(calendarScrollTimerRef.current)
      }
      calendarScrollTimerRef.current = window.setTimeout(
        settleCalendarScrollFallback,
        fallbackScrollEndDelay
      )
    }
  }

  function startCalendarGesture() {
    const pager = calendarPagerRef.current
    if (pager && pager.clientWidth > 0) {
      const offset = dayPagerBoundaryOffset(pager.scrollLeft, pager.clientWidth)
      if (offset === -dayPagerCenterPage || offset === dayPagerCenterPage) {
        settleCalendarScroll(true)
      }
    }
    calendarGestureActiveRef.current = true
  }

  function changeMonth(months: number) {
    changeDate(moveMonth(date, months, preferredDayRef.current), {
      preservePreferredDay: true,
    })
  }

  function chooseDate(nextDateValue: string) {
    if (!nextDateValue || nextDateValue === date) return
    changeDate(nextDateValue)
  }

  const selectAssignment = useCallback(
    (pageDate: string, assignmentId: string) => {
      if (pageDate !== date) changeDate(pageDate)
      setSelectedAssignmentId(assignmentId)
    },
    [changeDate, date]
  )

  async function recordCheckIn(assignmentId: string) {
    setCheckInPending(assignmentId)
    try {
      await checkIn(assignmentId)
      await queryClient.invalidateQueries({
        queryKey: ["assignments", "month"],
      })
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
        previewControllerRef={weekRailPreviewRef}
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
            ref={calendarPagerRef}
            aria-label="日付を切り替え"
            className="flex w-full snap-x snap-mandatory overflow-x-auto overflow-y-hidden overscroll-x-contain [overflow-anchor:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            style={{ height: 24 * hourHeight + calendarInset * 2 }}
            onScroll={handleCalendarScroll}
            onTouchCancel={() => {
              calendarGestureActiveRef.current = false
              settleCalendarScroll(true)
            }}
            onTouchEnd={() => {
              calendarGestureActiveRef.current = false
              settleCalendarScroll(true)
            }}
            onTouchStart={() => {
              startCalendarGesture()
            }}
          >
            {calendarDates.map((pageDate) => (
              <CalendarDay
                key={pageDate}
                date={pageDate}
                assignments={
                  assignmentDataByDate.get(pageDate) ?? noAssignments
                }
                now={now}
                onSelectAssignment={selectAssignment}
              />
            ))}
          </div>
        </div>
        {selectedMonthQuery.isError && !offline && (
          <Button
            className="absolute top-2 right-2"
            size="sm"
            variant="outline"
            title={errorMessage(selectedMonthQuery.error)}
            onClick={() => selectedMonthQuery.refetch()}
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
                      selectedMonthQuery.dataUpdatedAt <
                        new Date(selectedAssignment.startsAt).getTime() ||
                      selectedMonthQuery.dataUpdatedAt >
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

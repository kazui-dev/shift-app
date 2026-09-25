import { PageHeader } from "@workspace/ui/components/page-header"
import { DisplayYearNotice } from "@/app/display-year-notice"
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import { useQuery } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import { SquarePen } from "lucide-react"

import { Button } from "@workspace/ui/components/button"

import type { CampusLocation } from "@/features/calendar/components/campus-location"
import { AttendanceSheet } from "@/features/calendar/components/attendance-sheet"
import { ConfirmDialog } from "@/components/confirm-dialog"
import { useCalendarViewState } from "@/features/calendar/components/calendar-view-context"
import { useOfflineMode } from "@/app/offline-mode-context"
import { useDisplayYear } from "@/app/use-display-year"
import { availabilityQuery } from "@/features/availability/data/availability"
import { CalendarCarousel } from "@/features/calendar/components/calendar-carousel"
import {
  calendarHourHeight,
  calendarInset,
} from "@/features/calendar/components/calendar-layout"
import { CalendarWeekHeader } from "@/features/calendar/components/calendar-week-header"
import { paintCalendarWeekHeader } from "@/features/calendar/components/calendar-week-presentation"
import { MonthSwitcher } from "@/features/calendar/components/month-switcher"
import { useCalendarAssignments } from "@/features/calendar/components/use-calendar-assignments"
import { useCalendarAttendance } from "@/features/calendar/use-calendar-attendance"
import { calendarSlideDates } from "@/features/calendar/lib/carousel"
import { japanDateTime, japanFullDate } from "@workspace/shared/japan-time"
import { loopCarouselInitialSlide } from "@/features/calendar/lib/loop-carousel"

/** Why a check-in could not confirm the campus, as the confirmation's first sentence. */
const locationIssues: Record<Exclude<CampusLocation, "confirmed">, string> = {
  denied: "位置情報の利用が許可されていません。",
  far: "現在地が大学の近くではありません。",
  unavailable: "現在地を正確に取得できませんでした。",
}

function initialCalendarScrollTop(now: Date): number {
  const japanNow = japanDateTime(now)
  const minute = japanNow.hour * 60 + japanNow.minute
  return Math.max(0, (minute / 60 - 2.5) * calendarHourHeight + calendarInset)
}

function useCurrentTime(): Date {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    let timer = 0
    const update = () => {
      setNow(new Date())
      timer = window.setTimeout(update, 60_000 - (Date.now() % 60_000) + 20)
    }
    timer = window.setTimeout(update, 60_000 - (Date.now() % 60_000) + 20)
    return () => window.clearTimeout(timer)
  }, [])

  return now
}

export function CalendarPage() {
  const offline = useOfflineMode()
  // The form is worth opening only once a year has dates to answer; submitted
  // answers stay readable after the dates stop accepting.
  const year = useDisplayYear().year
  const availability = useQuery(availabilityQuery(year))
  const hasAvailability = (availability.data?.dates.length ?? 0) > 0
  const { date, selectDate, selectMonth, readScrollTop, saveScrollTop } =
    useCalendarViewState()
  const {
    attendance,
    checkingInId,
    locationIssue,
    openAttendance,
    closeAttendance,
    clearAttendance,
    clearLocationIssue,
    checkIn,
    saveCheckIn,
  } = useCalendarAttendance()
  const calendarRef = useRef<HTMLDivElement>(null)
  const weekHeaderRef = useRef<HTMLDivElement>(null)
  const dateRef = useRef(date)
  const initializedCalendarRef = useRef(false)
  dateRef.current = date
  const currentTime = useCurrentTime()
  const now = japanDateTime(currentTime)
  const nowMs = currentTime.getTime()
  const carouselDates = useMemo(
    () => calendarSlideDates(date, loopCarouselInitialSlide),
    [date]
  )
  const calendarAssignments = useCalendarAssignments(date, carouselDates)
  const attendanceAssignment = [...calendarAssignments.byDate.values()]
    .flat()
    .find((assignment) => assignment.id === attendance?.id)

  useLayoutEffect(() => {
    const calendar = calendarRef.current
    if (!calendar || initializedCalendarRef.current) return
    const scrollTop = readScrollTop() ?? initialCalendarScrollTop(new Date())
    calendar.scrollTop = scrollTop
    saveScrollTop(scrollTop)
    initializedCalendarRef.current = true
  }, [readScrollTop, saveScrollTop])

  const changeDate = useCallback(
    (nextDate: string) => {
      if (!nextDate || nextDate === dateRef.current) return
      dateRef.current = nextDate
      selectDate(nextDate)
    },
    [selectDate]
  )

  const updateWeekHeader = useCallback(
    (presentationDate: string, offset: number) => {
      const header = weekHeaderRef.current
      if (header) paintCalendarWeekHeader(header, presentationDate, offset)
    },
    []
  )

  const changeMonth = useCallback(
    (months: number) => {
      selectMonth(months)
    },
    [selectMonth]
  )

  return (
    <section className="flex min-h-0 min-w-0 flex-1 flex-col gap-3">
      <PageHeader className="h-auto justify-between border-0 pt-3 sm:px-6 md:pt-6">
        <MonthSwitcher
          date={date}
          onDateChange={changeDate}
          onMonthChange={changeMonth}
        />
        <DisplayYearNotice />
        {!offline && hasAvailability && (
          <div className="flex items-center gap-1">
            <Button
              render={<Link to="/calendar/availability" />}
              nativeButton={false}
              variant="ghost"
            >
              <SquarePen />
              シフト希望
            </Button>
          </div>
        )}
      </PageHeader>

      <CalendarWeekHeader
        date={date}
        onDateChange={changeDate}
        rootRef={weekHeaderRef}
      />

      <p className="shrink-0 py-0.5 text-center text-sm font-semibold">
        {japanFullDate(date)}
      </p>

      <div className="relative min-h-0 flex-1">
        <div
          ref={calendarRef}
          className="size-full overflow-x-hidden overflow-y-auto overscroll-y-auto [scrollbar-width:none]"
          onScroll={(event) => saveScrollTop(event.currentTarget.scrollTop)}
        >
          <CalendarCarousel
            date={date}
            assignmentsByDate={calendarAssignments.byDate}
            now={now}
            onDateChange={changeDate}
            onProgress={updateWeekHeader}
            onAttendance={openAttendance}
          />
        </div>

        {/* Always mounted, like the chat drawer, so it slides in. */}
        <AttendanceSheet
          open={attendance?.open === true && !!attendanceAssignment}
          assignment={attendanceAssignment ?? null}
          now={nowMs}
          offline={offline}
          checkingIn={
            !!attendanceAssignment && checkingInId === attendanceAssignment.id
          }
          onCheckIn={(assignmentId) => void checkIn(assignmentId)}
          onClose={closeAttendance}
          onClosed={clearAttendance}
        />
        {locationIssue && (
          <ConfirmDialog
            title="このまま出勤しますか"
            description={`${locationIssues[locationIssue.reason]}出勤確認の依頼が責任者に送信されます。`}
            confirmLabel="このまま出勤する"
            tone="default"
            onCancel={clearLocationIssue}
            onConfirm={() => {
              void saveCheckIn(locationIssue.assignmentId, false)
            }}
            onClosed={clearLocationIssue}
          />
        )}
      </div>
    </section>
  )
}

import { DisplayYearNotice } from "@/components/display-year-notice"
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import { useQueryClient } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import { SquarePen } from "lucide-react"

import { Button } from "@workspace/ui/components/button"
import { toast } from "@workspace/ui/lib/toast"

import { confirmCampusLocation } from "@/lib/campus-location"
import { checkIn } from "@/api/assignments"
import { errorMessage } from "@/api/client"
import { useCalendarViewState } from "@/components/calendar-view-context"
import { useOfflineMode } from "@/components/offline-mode-context"
import { AssignmentDetailsDialog } from "@/components/calendar/assignment-details-dialog"
import { CalendarCarousel } from "@/components/calendar/calendar-carousel"
import { formatLongDate } from "@/components/calendar/calendar-format"
import {
  calendarHourHeight,
  calendarInset,
} from "@/components/calendar/calendar-layout"
import { CalendarWeekHeader } from "@/components/calendar/calendar-week-header"
import { paintCalendarWeekHeader } from "@/components/calendar/calendar-week-presentation"
import { MonthSwitcher } from "@/components/calendar/month-switcher"
import { useCalendarAssignments } from "@/components/calendar/use-calendar-assignments"
import { calendarSlideDates } from "@/lib/calendar-carousel"
import { japanDateTime } from "@/lib/japan-time"
import { loopCarouselInitialSlide } from "@/lib/loop-carousel"

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
  const queryClient = useQueryClient()
  const offline = useOfflineMode()
  const { date, selectDate, selectMonth, readScrollTop, saveScrollTop } =
    useCalendarViewState()
  const [pendingAssignmentId, setPendingAssignmentId] = useState<string | null>(
    null
  )
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<
    string | null
  >(null)
  const calendarRef = useRef<HTMLDivElement>(null)
  const weekHeaderRef = useRef<HTMLDivElement>(null)
  const dateRef = useRef(date)
  const initializedCalendarRef = useRef(false)
  dateRef.current = date
  const now = japanDateTime(useCurrentTime())
  const carouselDates = useMemo(
    () => calendarSlideDates(date, loopCarouselInitialSlide),
    [date]
  )
  const calendarAssignments = useCalendarAssignments(date, carouselDates)
  const selectedAssignment = (calendarAssignments.byDate.get(date) ?? []).find(
    (assignment) => assignment.id === selectedAssignmentId
  )

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
      setSelectedAssignmentId(null)
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
      setSelectedAssignmentId(null)
      selectMonth(months)
    },
    [selectMonth]
  )

  const selectAssignment = useCallback(
    (pageDate: string, assignmentId: string) => {
      if (pageDate !== date) selectDate(pageDate)
      setSelectedAssignmentId(assignmentId)
    },
    [date, selectDate]
  )

  async function recordCheckIn(assignmentId: string): Promise<void> {
    setPendingAssignmentId(assignmentId)
    try {
      const locationConfirmed = await confirmCampusLocation()
      const result = await checkIn(assignmentId, locationConfirmed)
      await queryClient.invalidateQueries({
        queryKey: ["assignments", "month"],
      })
      toast.success(
        result.attendance.status === "confirmed"
          ? "出勤を記録しました。"
          : "出勤を記録しました。責任者の確認をお待ちください。"
      )
    } catch (error) {
      toast.error(errorMessage(error))
    } finally {
      setPendingAssignmentId(null)
    }
  }

  return (
    <section className="flex min-h-0 min-w-0 flex-1 flex-col gap-3">
      <header className="flex shrink-0 items-center justify-between gap-3">
        <MonthSwitcher
          date={date}
          onDateChange={changeDate}
          onMonthChange={changeMonth}
        />
        <DisplayYearNotice />
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

      <CalendarWeekHeader
        date={date}
        onDateChange={changeDate}
        rootRef={weekHeaderRef}
      />

      <p className="shrink-0 py-0.5 text-center text-sm font-semibold">
        {formatLongDate(date)}
      </p>

      <div className="relative min-h-0 flex-1">
        <div
          ref={calendarRef}
          className="size-full overflow-x-hidden overflow-y-auto overscroll-y-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          onScroll={(event) => saveScrollTop(event.currentTarget.scrollTop)}
        >
          <CalendarCarousel
            date={date}
            assignmentsByDate={calendarAssignments.byDate}
            now={now}
            onDateChange={changeDate}
            onProgress={updateWeekHeader}
            onSelectAssignment={selectAssignment}
          />
        </div>

        {calendarAssignments.selectedMonthIsError && !offline && (
          <Button
            className="absolute top-2 right-2"
            size="sm"
            variant="outline"
            title={errorMessage(calendarAssignments.selectedMonthError)}
            onClick={calendarAssignments.refetchSelectedMonth}
          >
            予定を再読み込み
          </Button>
        )}

        {selectedAssignment && (
          <AssignmentDetailsDialog
            key={selectedAssignment.id}
            assignment={selectedAssignment}
            offline={offline}
            pending={pendingAssignmentId === selectedAssignment.id}
            onCheckIn={recordCheckIn}
            onClose={() => setSelectedAssignmentId(null)}
          />
        )}
      </div>
    </section>
  )
}

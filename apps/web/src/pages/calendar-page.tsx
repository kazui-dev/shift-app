import { DisplayYearNotice } from "@/components/display-year-notice"
import { keys } from "@/data/keys"
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

import {
  checkCampusLocation,
  type CampusLocation,
} from "@/components/calendar/campus-location"
import { AssignmentReportSheet } from "@/components/calendar/assignment-report-sheet"
import { ConfirmDialog } from "@/components/confirm-dialog"
import { checkIn } from "@/api/assignments"
import { errorMessage } from "@/api/client"
import { useCalendarViewState } from "@/components/calendar-view-context"
import { useOfflineMode } from "@/components/offline-mode-context"
import { AssignmentDetailsDialog } from "@/components/calendar/assignment-details-dialog"
import { CalendarCarousel } from "@/components/calendar/calendar-carousel"
import {
  calendarHourHeight,
  calendarInset,
} from "@/components/calendar/calendar-layout"
import { CalendarWeekHeader } from "@/components/calendar/calendar-week-header"
import { paintCalendarWeekHeader } from "@/components/calendar/calendar-week-presentation"
import { MonthSwitcher } from "@/components/calendar/month-switcher"
import { useCalendarAssignments } from "@/components/calendar/use-calendar-assignments"
import { calendarSlideDates } from "@/lib/calendar/carousel"
import { japanDateTime, japanFullDate } from "@workspace/shared/japan-time"
import { loopCarouselInitialSlide } from "@/lib/calendar/loop-carousel"

/** Why a check-in could not confirm the campus, as the confirmation's first line. */
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
  const queryClient = useQueryClient()
  const offline = useOfflineMode()
  const { date, selectDate, selectMonth, readScrollTop, saveScrollTop } =
    useCalendarViewState()
  const [checkingInId, setCheckingInId] = useState<string | null>(null)
  const [locationIssue, setLocationIssue] = useState<{
    assignmentId: string
    reason: Exclude<CampusLocation, "confirmed">
  } | null>(null)
  const [reportingId, setReportingId] = useState<string | null>(null)
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<
    string | null
  >(null)
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
  const selectedAssignment = (calendarAssignments.byDate.get(date) ?? []).find(
    (assignment) => assignment.id === selectedAssignmentId
  )
  const reportingAssignment = [...calendarAssignments.byDate.values()]
    .flat()
    .find((assignment) => assignment.id === reportingId)

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

  const saveCheckIn = useCallback(
    async (assignmentId: string, locationConfirmed: boolean) => {
      setCheckingInId(assignmentId)
      try {
        await checkIn(assignmentId, locationConfirmed)
        await queryClient.invalidateQueries({
          queryKey: keys.assignmentMonth(),
        })
        toast.success("出勤を記録しました。")
      } catch (error) {
        toast.error(errorMessage(error))
      } finally {
        setCheckingInId(null)
      }
    },
    [queryClient]
  )

  // A check-in confirms the campus first; when it cannot, the member decides
  // whether to check in anyway, and cancelling leaves no trace.
  const startCheckIn = useCallback(
    async (assignmentId: string) => {
      setCheckingInId(assignmentId)
      const location = await checkCampusLocation()
      if (location === "confirmed") {
        await saveCheckIn(assignmentId, true)
        return
      }
      setCheckingInId(null)
      setLocationIssue({ assignmentId, reason: location })
    },
    [saveCheckIn]
  )
  const requestCheckIn = useCallback(
    (assignmentId: string) => void startCheckIn(assignmentId),
    [startCheckIn]
  )
  const requestReport = useCallback((assignmentId: string) => {
    setReportingId(assignmentId)
  }, [])

  return (
    <section className="flex min-h-0 min-w-0 flex-1 flex-col gap-3">
      <header className="flex shrink-0 items-center justify-between gap-3 px-4 pt-3 sm:px-6 md:pt-6">
        <MonthSwitcher
          date={date}
          onDateChange={changeDate}
          onMonthChange={changeMonth}
        />
        <DisplayYearNotice />
        {!offline && (
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
      </header>

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
            nowMs={nowMs}
            offline={offline}
            checkingInId={checkingInId}
            onDateChange={changeDate}
            onProgress={updateWeekHeader}
            onSelectAssignment={selectAssignment}
            onCheckIn={requestCheckIn}
            onReport={requestReport}
          />
        </div>

        {selectedAssignment && (
          <AssignmentDetailsDialog
            key={selectedAssignment.id}
            assignment={selectedAssignment}
            now={nowMs}
            offline={offline}
            checkingIn={checkingInId === selectedAssignment.id}
            onCheckIn={requestCheckIn}
            onReport={(assignmentId) => {
              setSelectedAssignmentId(null)
              setReportingId(assignmentId)
            }}
            onClose={() => setSelectedAssignmentId(null)}
          />
        )}
        {reportingAssignment && (
          <AssignmentReportSheet
            key={reportingAssignment.id}
            assignment={reportingAssignment}
            onClose={() => setReportingId(null)}
          />
        )}
        {locationIssue && (
          <ConfirmDialog
            title="このまま出勤しますか"
            description={
              <>
                {locationIssues[locationIssue.reason]}
                <br />
                出勤は記録され、あとで責任者が確認します。
              </>
            }
            confirmLabel="このまま出勤する"
            tone="default"
            onCancel={() => setLocationIssue(null)}
            onConfirm={() => {
              void saveCheckIn(locationIssue.assignmentId, false)
            }}
            onClosed={() => setLocationIssue(null)}
          />
        )}
      </div>
    </section>
  )
}

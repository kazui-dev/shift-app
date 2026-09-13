import { useEffect, useLayoutEffect, useState, type RefObject } from "react"
import { japanFullDate } from "@workspace/shared/japan-time"

import { calendarWeekSlideDates } from "@/lib/calendar-carousel"
import { localDate, moveDate, weekDates } from "@/lib/calendar-dates"
import { loopCarouselSlots } from "@/lib/loop-carousel"
import { resetCalendarWeekHeader } from "./calendar-week-presentation"
import { useLoopCarousel } from "./use-loop-carousel"

const weekdays = ["日", "月", "火", "水", "木", "金", "土"]
const weekCellClassName =
  "grid min-h-16 grid-rows-[1rem_2rem] content-center justify-items-center gap-2 text-xs"

function weekdayTextColor(weekday: number): string {
  if (weekday === 0) return "text-red-600 dark:text-red-400"
  if (weekday === 6) return "text-blue-600 dark:text-blue-400"
  return "text-foreground"
}

function WeekNumbers({ date }: { date: string }) {
  return (
    <div className="grid grid-cols-7">
      {weekDates(date).map((value, weekday) => (
        <span key={value} className={weekCellClassName}>
          <span className={weekdayTextColor(weekday)}>{weekdays[weekday]}</span>
          <span className="grid size-8 place-items-center text-sm text-foreground tabular-nums">
            {localDate(value).getDate()}
          </span>
        </span>
      ))}
    </div>
  )
}

function WeekPage({
  animateIndicator,
  date,
  selectedDate,
  onDateChange,
}: {
  animateIndicator: boolean
  date: string
  selectedDate: string
  onDateChange: (date: string) => void
}) {
  const selectedWeekday = localDate(date).getDay()

  return (
    <div
      className="relative min-w-0 flex-[0_0_100%]"
      inert={date !== selectedDate}
    >
      <div className="relative z-10 grid grid-cols-7">
        {weekDates(date).map((value, weekday) => (
          <button
            key={value}
            type="button"
            className={weekCellClassName}
            aria-label={japanFullDate(value)}
            aria-current={value === selectedDate ? "date" : undefined}
            onClick={() => onDateChange(value)}
          >
            <span className={weekdayTextColor(weekday)}>
              {weekdays[weekday]}
            </span>
            <span
              className={`grid size-8 place-items-center text-sm text-foreground tabular-nums ${value === selectedDate ? "font-semibold" : ""}`}
            >
              {localDate(value).getDate()}
            </span>
          </button>
        ))}
      </div>
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 grid grid-cols-7"
      >
        <span
          className={`${weekCellClassName} ${animateIndicator ? "transition-transform [transition-duration:160ms] ease-out motion-reduce:transition-none" : ""}`}
          style={{ transform: `translateX(${selectedWeekday * 100}%)` }}
        >
          <span aria-hidden className="h-4" />
          <span className="size-8 rounded-full bg-blue-500/15 dark:bg-blue-400/20" />
        </span>
      </span>
    </div>
  )
}

function DayProgressOverlay({ date }: { date: string }) {
  const selectedWeekday = localDate(date).getDay()

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 bg-background"
      style={{ opacity: "var(--calendar-day-progress-active, 0)" }}
    >
      <div
        className="absolute inset-0"
        style={{ opacity: "var(--calendar-previous-progress, 0)" }}
      >
        <WeekNumbers date={moveDate(date, -1)} />
      </div>
      <div
        className="absolute inset-0"
        style={{ opacity: "var(--calendar-next-progress, 0)" }}
      >
        <WeekNumbers date={moveDate(date, 1)} />
      </div>
      <div style={{ opacity: "calc(1 - var(--calendar-cross-progress, 0))" }}>
        <WeekNumbers date={date} />
      </div>
      <span
        className="absolute inset-0 grid grid-cols-7"
        style={{ opacity: "calc(1 - var(--calendar-cross-progress, 0))" }}
      >
        <span
          className={weekCellClassName}
          style={{
            transform: `translateX(calc(${selectedWeekday * 100}% + var(--calendar-swipe-offset, 0%)))`,
          }}
        >
          <span aria-hidden className="h-4" />
          <span className="size-8 rounded-full bg-blue-500/15 dark:bg-blue-400/20" />
        </span>
      </span>
      <span
        className="absolute inset-0 grid grid-cols-7"
        style={{ opacity: "var(--calendar-previous-progress, 0)" }}
      >
        <span
          className={weekCellClassName}
          style={{
            transform:
              "translateX(calc(700% + var(--calendar-swipe-offset, 0%)))",
          }}
        >
          <span aria-hidden className="h-4" />
          <span className="size-8 rounded-full bg-blue-500/15 dark:bg-blue-400/20" />
        </span>
      </span>
      <span
        className="absolute inset-0 grid grid-cols-7"
        style={{ opacity: "var(--calendar-next-progress, 0)" }}
      >
        <span
          className={weekCellClassName}
          style={{
            transform:
              "translateX(calc(-100% + var(--calendar-swipe-offset, 0%)))",
          }}
        >
          <span aria-hidden className="h-4" />
          <span className="size-8 rounded-full bg-blue-500/15 dark:bg-blue-400/20" />
        </span>
      </span>
    </div>
  )
}

export function CalendarWeekHeader({
  date,
  onDateChange,
  rootRef,
}: {
  date: string
  onDateChange: (date: string) => void
  rootRef: RefObject<HTMLDivElement | null>
}) {
  const [animatedDate, setAnimatedDate] = useState<string | null>(null)
  const { values, viewportRef } = useLoopCarousel({
    onSelect: onDateChange,
    value: date,
    valuesAround: calendarWeekSlideDates,
  })

  useLayoutEffect(() => {
    const root = rootRef.current
    if (root) resetCalendarWeekHeader(root)
  }, [date, rootRef])

  useEffect(() => {
    if (animatedDate === null) return undefined
    if (animatedDate !== date) {
      setAnimatedDate(null)
      return undefined
    }
    const timeout = window.setTimeout(() => setAnimatedDate(null), 160)
    return () => window.clearTimeout(timeout)
  }, [animatedDate, date])

  function selectWeekDate(nextDate: string) {
    if (nextDate === date) return
    setAnimatedDate(nextDate)
    onDateChange(nextDate)
  }

  return (
    <div
      ref={rootRef}
      className="relative overflow-hidden border-b bg-background"
    >
      <div className="relative mx-4 mb-3 overflow-hidden sm:mx-6">
        <div
          ref={viewportRef}
          className="touch-pan-y overflow-hidden"
          aria-label="週を切り替え"
          aria-roledescription="カルーセル"
          style={{
            opacity: "calc(1 - var(--calendar-day-progress-active, 0))",
          }}
        >
          <div className="flex">
            {loopCarouselSlots.map((slotId, slot) => {
              const weekDate = values[slot]
              if (!weekDate) return null
              return (
                <WeekPage
                  key={slotId}
                  animateIndicator={animatedDate === date}
                  date={weekDate}
                  selectedDate={date}
                  onDateChange={selectWeekDate}
                />
              )
            })}
          </div>
        </div>
        <DayProgressOverlay date={date} />
      </div>
    </div>
  )
}

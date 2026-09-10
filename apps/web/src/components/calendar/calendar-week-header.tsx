import { useLayoutEffect, type RefObject } from "react"

import { localDate, moveDate, weekDates } from "@/lib/calendar-dates"
import { formatLongDate } from "./calendar-format"
import { resetCalendarWeekHeader } from "./calendar-week-presentation"

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

function WeekButtons({
  date,
  onDateChange,
}: {
  date: string
  onDateChange: (date: string) => void
}) {
  return (
    <div className="relative z-10 grid grid-cols-7">
      {weekDates(date).map((value, weekday) => (
        <button
          key={value}
          type="button"
          className={weekCellClassName}
          aria-label={formatLongDate(value)}
          aria-current={value === date ? "date" : undefined}
          onClick={() => onDateChange(value)}
        >
          <span className={weekdayTextColor(weekday)}>{weekdays[weekday]}</span>
          <span
            className={`grid size-8 place-items-center text-sm text-foreground tabular-nums ${value === date ? "font-semibold" : ""}`}
          >
            {localDate(value).getDate()}
          </span>
        </button>
      ))}
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
  const selectedWeekday = localDate(date).getDay()

  useLayoutEffect(() => {
    const root = rootRef.current
    if (root) resetCalendarWeekHeader(root)
  }, [date, rootRef])

  return (
    <div
      ref={rootRef}
      className="relative overflow-hidden border-b bg-background"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{ opacity: "var(--calendar-previous-progress, 0)" }}
      >
        <WeekNumbers date={moveDate(date, -1)} />
      </div>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{ opacity: "var(--calendar-next-progress, 0)" }}
      >
        <WeekNumbers date={moveDate(date, 1)} />
      </div>
      <div style={{ opacity: "calc(1 - var(--calendar-cross-progress, 0))" }}>
        <WeekButtons date={date} onDateChange={onDateChange} />
      </div>
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 grid grid-cols-7"
        style={{ opacity: "calc(1 - var(--calendar-cross-progress, 0))" }}
      >
        <span
          className={`${weekCellClassName} transition-transform [transition-duration:var(--calendar-indicator-duration,160ms)] [transition-timing-function:cubic-bezier(0.2,0.8,0.2,1)] motion-reduce:transition-none`}
          style={{
            transform: `translateX(calc(${selectedWeekday * 100}% + var(--calendar-swipe-offset, 0%)))`,
          }}
        >
          <span aria-hidden className="h-4" />
          <span className="size-8 rounded-full bg-blue-500/15 dark:bg-blue-400/20" />
        </span>
      </span>
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 grid grid-cols-7"
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
        aria-hidden
        className="pointer-events-none absolute inset-0 grid grid-cols-7"
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

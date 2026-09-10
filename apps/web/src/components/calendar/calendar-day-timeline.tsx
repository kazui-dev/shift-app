import { memo } from "react"

import type { CalendarAssignment } from "@/api/assignments"
import { minutesFromJapanDateStart, type JapanDateTime } from "@/lib/japan-time"
import { formatCalendarTime, formatLongDate } from "./calendar-format"
import {
  calendarHourHeight,
  calendarInset,
  calendarTimelineHeight,
} from "./calendar-layout"

const hours = Array.from({ length: 25 }, (_, hour) => hour)

export const CalendarDayTimeline = memo(function CalendarDayTimeline({
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
      className="relative w-full"
      aria-label={formatLongDate(date)}
      style={{ height: calendarTimelineHeight }}
    >
      {hours.map((hour, index) => (
        <div
          key={hour}
          className="absolute inset-x-0 border-t border-border/70"
          style={{ top: calendarInset + index * calendarHourHeight }}
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
        const top = calendarInset + (startMinute / 60) * calendarHourHeight
        const height = Math.max(
          30,
          ((endMinute - startMinute) / 60) * calendarHourHeight
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
                {formatCalendarTime(assignment.startsAt)}–
                {formatCalendarTime(assignment.endsAt)}
              </span>
            )}
          </button>
        )
      })}

      {showNow && (
        <div
          className="pointer-events-none absolute right-0 left-11 z-10 border-t border-blue-500"
          style={{
            top: calendarInset + (nowMinute / 60) * calendarHourHeight,
          }}
        >
          <span className="absolute top-0 left-0 -translate-x-full -translate-y-1/2 rounded-full bg-blue-500 px-1.5 py-0.5 text-[0.625rem] font-semibold text-white tabular-nums">
            {now.hour}:{String(now.minute).padStart(2, "0")}
          </span>
        </div>
      )}
    </div>
  )
})

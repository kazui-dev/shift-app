import { memo } from "react"
import { Clock } from "lucide-react"

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
      className="grid w-full grid-cols-[max-content_minmax(0,1fr)] gap-x-2"
      aria-label={formatLongDate(date)}
      style={{ height: calendarTimelineHeight }}
    >
      <div className="relative text-[0.6875rem] whitespace-nowrap tabular-nums">
        <span aria-hidden className="invisible">
          00:00
        </span>
        {hours.map((hour, index) => (
          <span
            key={hour}
            className="absolute right-0 -translate-y-1/2 text-muted-foreground"
            style={{ top: calendarInset + index * calendarHourHeight }}
          >
            {hour % 24}:00
          </span>
        ))}
        {showNow && (
          <span
            className="pointer-events-none absolute inset-x-0 z-10 -translate-y-1/2 rounded-full bg-blue-500 py-0.5 text-center text-[0.625rem] font-semibold text-white"
            style={{
              top: calendarInset + (nowMinute / 60) * calendarHourHeight,
            }}
          >
            {now.hour}:{String(now.minute).padStart(2, "0")}
          </span>
        )}
      </div>
      <div className="relative min-w-0">
        {hours.map((hour, index) => (
          <div
            key={hour}
            className="absolute inset-x-0 border-t border-border/70"
            style={{ top: calendarInset + index * calendarHourHeight }}
          />
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
              className="absolute inset-x-0 flex flex-col items-start justify-start overflow-hidden rounded py-1.5 pr-3 pl-[22px] text-left hover:opacity-90"
              style={{
                top,
                height,
                backgroundColor: `color-mix(in oklab, ${assignment.color} 22%, var(--background))`,
              }}
              onClick={() => onSelectAssignment(date, assignment.id)}
            >
              <span
                aria-hidden="true"
                className="pointer-events-none absolute inset-y-1.5 left-1.5 w-1 rounded-full"
                style={{ backgroundColor: assignment.color }}
              />
              <span className="block w-full truncate text-sm font-semibold">
                {assignment.activityName}
              </span>
              {height >= 44 && (
                <span className="flex items-center gap-1 text-xs tabular-nums opacity-75">
                  <Clock aria-hidden="true" className="size-3 shrink-0" />
                  <span>
                    {formatCalendarTime(assignment.startsAt)}–
                    {formatCalendarTime(assignment.endsAt)}
                  </span>
                </span>
              )}
            </button>
          )
        })}

        {showNow && (
          <div
            className="pointer-events-none absolute inset-x-0 z-10 border-t border-blue-500"
            style={{
              top: calendarInset + (nowMinute / 60) * calendarHourHeight,
            }}
          />
        )}
      </div>
    </div>
  )
})

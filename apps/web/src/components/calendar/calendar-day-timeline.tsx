import { memo, useRef } from "react"
import { Clock } from "lucide-react"

import type { CalendarAssignment } from "@/api/assignments"
import { buttonVariants } from "@workspace/ui/components/button"
import { cn } from "@workspace/ui/lib/utils"
import {
  japanFullDate,
  japanTime,
  minutesFromJapanDateStart,
  type JapanDateTime,
} from "@workspace/shared/japan-time"
import {
  calendarHourHeight,
  calendarInset,
  calendarTimelineHeight,
} from "./calendar-layout"
import { attendanceLabel } from "./assignment-actions"

const hours = Array.from({ length: 25 }, (_, hour) => hour)
/** How long a card is held before it opens its attendance. */
const holdMs = 450

export const CalendarDayTimeline = memo(function CalendarDayTimeline({
  date,
  assignments,
  now,
  onAttendance,
}: {
  date: string
  assignments: CalendarAssignment[]
  now: JapanDateTime
  onAttendance: (assignmentId: string) => void
}) {
  const nowMinute = now.hour * 60 + now.minute
  const showNow = date === now.date
  const hold = useRef<{
    timer: ReturnType<typeof setTimeout>
    x: number
    y: number
  } | null>(null)
  const held = useRef(false)
  const release = () => {
    if (hold.current) clearTimeout(hold.current.timer)
    hold.current = null
  }

  return (
    <section
      className="grid w-full grid-cols-[max-content_minmax(0,1fr)] gap-x-2"
      aria-label={japanFullDate(date)}
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
            className="pointer-events-none absolute -right-1 z-10 -translate-y-1/2 rounded-full bg-blue-500 p-1 text-white [text-box:trim-both_cap_alphabetic]"
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

        {showNow && (
          <div
            className="pointer-events-none absolute right-0 -left-1 border-t border-blue-500"
            style={{
              top: calendarInset + (nowMinute / 60) * calendarHourHeight,
            }}
          />
        )}

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
            <div
              key={assignment.id}
              className="absolute inset-x-0 overflow-hidden rounded"
              style={{
                top,
                height,
                backgroundColor: `color-mix(in oklab, ${assignment.color} 22%, var(--background))`,
              }}
            >
              <button
                type="button"
                aria-label={`${assignment.activityName}の勤怠`}
                className="absolute inset-0 select-none [-webkit-touch-callout:none] hover:bg-foreground/5"
                onPointerDown={(event) => {
                  held.current = false
                  release()
                  if (!event.isPrimary || event.button !== 0) return
                  hold.current = {
                    x: event.clientX,
                    y: event.clientY,
                    timer: setTimeout(() => {
                      held.current = true
                      hold.current = null
                      onAttendance(assignment.id)
                    }, holdMs),
                  }
                }}
                onPointerMove={(event) => {
                  if (
                    hold.current &&
                    Math.hypot(
                      event.clientX - hold.current.x,
                      event.clientY - hold.current.y
                    ) > 10
                  )
                    release()
                }}
                onPointerUp={release}
                onPointerCancel={release}
                onContextMenu={(event) => {
                  event.preventDefault()
                  release()
                  onAttendance(assignment.id)
                }}
                onClick={() => {
                  // A hold has already opened it.
                  if (held.current) {
                    held.current = false
                    return
                  }
                  onAttendance(assignment.id)
                }}
              />
              <span
                aria-hidden="true"
                className="pointer-events-none absolute inset-y-1.5 left-1.5 w-1 rounded-full"
                style={{ backgroundColor: assignment.color }}
              />
              <div className="pointer-events-none relative flex h-full min-w-0 items-start gap-2 py-1 pr-1.5 pl-[22px]">
                <div className="min-w-0 flex-1 pt-0.5">
                  <span className="block truncate text-sm font-semibold">
                    {assignment.activityName}
                  </span>
                  {height >= 44 && (
                    <span className="flex items-center gap-1 text-xs tabular-nums opacity-75">
                      <Clock aria-hidden="true" className="size-3 shrink-0" />
                      <span>
                        {japanTime(assignment.startsAt)}–
                        {japanTime(assignment.endsAt)}
                      </span>
                    </span>
                  )}
                </div>
                <span
                  className={cn(
                    buttonVariants({
                      variant: "outline",
                      // Short cards only have room for the small size.
                      size: height >= 44 ? "sm" : "xs",
                    }),
                    "shrink-0 bg-clip-padding"
                  )}
                >
                  {attendanceLabel(assignment)}
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
})

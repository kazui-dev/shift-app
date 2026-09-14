import { memo } from "react"
import { Clock, LoaderCircle } from "lucide-react"

import type { CalendarAssignment } from "@/api/assignments"
import { Button } from "@workspace/ui/components/button"
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
import {
  cardActionsOpen,
  reportLabel,
  stackedCardHeight,
  standingReport,
} from "./assignment-actions"

const hours = Array.from({ length: 25 }, (_, hour) => hour)

export const CalendarDayTimeline = memo(function CalendarDayTimeline({
  date,
  assignments,
  now,
  nowMs,
  offline,
  checkingInId,
  onSelectAssignment,
  onCheckIn,
  onReport,
}: {
  date: string
  assignments: CalendarAssignment[]
  now: JapanDateTime
  nowMs: number
  offline: boolean
  checkingInId: string | null
  onSelectAssignment: (date: string, assignmentId: string) => void
  onCheckIn: (assignmentId: string) => void
  onReport: (assignmentId: string) => void
}) {
  const nowMinute = now.hour * 60 + now.minute
  const showNow = date === now.date

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
          const stacked = height >= stackedCardHeight
          const checkingIn = checkingInId === assignment.id
          const absent = standingReport(assignment)?.kind === "absence"
          const actions = cardActionsOpen(assignment, nowMs) && (
            <div className="flex shrink-0 items-center gap-1.5">
              {!absent && (
                <Button
                  type="button"
                  size="xs"
                  disabled={offline || checkingIn}
                  onClick={() => onCheckIn(assignment.id)}
                >
                  {checkingIn && <LoaderCircle className="animate-spin" />}
                  出勤
                </Button>
              )}
              <Button
                type="button"
                size="xs"
                variant="outline"
                className="bg-background/70"
                disabled={offline}
                onClick={() => onReport(assignment.id)}
              >
                {reportLabel(assignment)}
              </Button>
            </div>
          )
          const checkedIn = assignment.checkedInAt && (
            <span className="shrink-0 text-xs tabular-nums opacity-75">
              {japanTime(assignment.checkedInAt)} 出勤
              {assignment.attendanceStatus === "pending" && "（確認待ち）"}
            </span>
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
              {/* The whole card opens the shift; its own buttons sit above this. */}
              <button
                type="button"
                aria-label={`${assignment.activityName}の詳細`}
                className="absolute inset-0 hover:bg-foreground/5"
                onClick={() => onSelectAssignment(date, assignment.id)}
              />
              <span
                aria-hidden="true"
                className="pointer-events-none absolute inset-y-1.5 left-1.5 w-1 rounded-full"
                style={{ backgroundColor: assignment.color }}
              />
              <div
                className={`pointer-events-none relative flex h-full min-w-0 py-1.5 pr-2 pl-[22px] ${stacked ? "flex-col" : "items-start gap-2"}`}
              >
                <div className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">
                    {assignment.activityName}
                  </span>
                  {(stacked || (!actions && height >= 44)) && (
                    <span className="flex items-center gap-1 text-xs tabular-nums opacity-75">
                      <Clock aria-hidden="true" className="size-3 shrink-0" />
                      <span>
                        {japanTime(assignment.startsAt)}–
                        {japanTime(assignment.endsAt)}
                      </span>
                    </span>
                  )}
                </div>
                {(actions || checkedIn) && (
                  <div
                    className={`pointer-events-auto ${stacked ? "mt-auto" : ""}`}
                  >
                    {actions || checkedIn}
                  </div>
                )}
              </div>
            </div>
          )
        })}

        {showNow && (
          <div
            className="pointer-events-none absolute right-0 -left-1 z-10 border-t border-blue-500"
            style={{
              top: calendarInset + (nowMinute / 60) * calendarHourHeight,
            }}
          />
        )}
      </div>
    </section>
  )
})

import type { CalendarAssignment } from "@/api/assignments"
import { calendarSlideDates } from "@/lib/calendar-carousel"
import type { JapanDateTime } from "@workspace/shared/japan-time"
import { loopCarouselSlots } from "@/lib/loop-carousel"
import { CalendarDayTimeline } from "./calendar-day-timeline"
import { calendarTimelineHeight } from "./calendar-layout"
import { useLoopCarousel } from "./use-loop-carousel"

const noAssignments: CalendarAssignment[] = []

export function CalendarCarousel({
  date,
  assignmentsByDate,
  now,
  onDateChange,
  onProgress,
  onSelectAssignment,
}: {
  date: string
  assignmentsByDate: Map<string, CalendarAssignment[]>
  now: JapanDateTime
  onDateChange: (date: string) => void
  onProgress: (date: string, offset: number) => void
  onSelectAssignment: (date: string, assignmentId: string) => void
}) {
  const { values: dates, viewportRef } = useLoopCarousel({
    onProgress,
    onSelect: onDateChange,
    value: date,
    valuesAround: calendarSlideDates,
  })

  return (
    <section
      ref={viewportRef}
      className="touch-pan-y overflow-hidden"
      aria-label="日付を切り替え"
      aria-roledescription="カルーセル"
      style={{ height: calendarTimelineHeight }}
    >
      <div className="flex h-full">
        {loopCarouselSlots.map((slotId, slot) => {
          const slideDate = dates[slot]
          if (!slideDate) return null
          return (
            <section
              key={slotId}
              className="min-w-0 flex-[0_0_100%] px-4 sm:px-6"
              aria-label={slideDate}
              aria-roledescription="日"
              inert={slideDate !== date}
            >
              <CalendarDayTimeline
                date={slideDate}
                assignments={assignmentsByDate.get(slideDate) ?? noAssignments}
                now={now}
                onSelectAssignment={onSelectAssignment}
              />
            </section>
          )
        })}
      </div>
    </section>
  )
}

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react"
import useEmblaCarousel from "embla-carousel-react"

import type { CalendarAssignment } from "@/api/assignments"
import {
  calendarInitialSlide,
  calendarSwipeOffset,
  createCalendarCarouselState,
  reduceCalendarCarousel,
  type CalendarCarouselEvent,
} from "@/lib/calendar-carousel"
import type { JapanDateTime } from "@/lib/japan-time"
import { CalendarDayTimeline } from "./calendar-day-timeline"
import { calendarTimelineHeight } from "./calendar-layout"

const noAssignments: CalendarAssignment[] = []
const calendarSlots = [
  "calendar-slot-a",
  "calendar-slot-b",
  "calendar-slot-c",
  "calendar-slot-d",
  "calendar-slot-e",
  "calendar-slot-f",
  "calendar-slot-g",
] as const

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
  const [viewportRef, emblaApi] = useEmblaCarousel({
    align: "start",
    containScroll: false,
    dragFree: false,
    loop: true,
    skipSnaps: false,
    slidesToScroll: 1,
    startIndex: calendarInitialSlide,
  })
  const stateRef = useRef(createCalendarCarouselState(date))
  const [dates, setDates] = useState(stateRef.current.dates)

  const transition = useCallback((event: CalendarCarouselEvent) => {
    const previous = stateRef.current
    const current = reduceCalendarCarousel(previous, event)
    stateRef.current = current
    if (current.dates !== previous.dates) setDates(current.dates)
    return { current, previous }
  }, [])

  const paintProgress = useCallback(() => {
    if (!emblaApi) return
    const state = stateRef.current
    onProgress(
      state.date,
      calendarSwipeOffset(
        emblaApi.scrollProgress(),
        state.index,
        emblaApi.scrollSnapList()
      )
    )
  }, [emblaApi, onProgress])

  useEffect(() => {
    if (!emblaApi) return undefined

    const pointerDown = () => {
      transition({ type: "pointerDown" })
    }
    const pointerUp = () => {
      transition({ type: "pointerUp" })
    }
    const select = () => {
      const { current, previous } = transition({
        type: "select",
        index: emblaApi.selectedScrollSnap(),
      })
      if (current.date !== previous.date) onDateChange(current.date)
    }
    const settle = () => {
      const { current } = transition({ type: "settle" })
      onProgress(current.date, 0)
    }
    const reInit = () => {
      const { current } = transition({
        type: "reInit",
        index: emblaApi.selectedScrollSnap(),
      })
      onProgress(current.date, 0)
    }

    emblaApi.on("scroll", paintProgress)
    emblaApi.on("pointerDown", pointerDown)
    emblaApi.on("pointerUp", pointerUp)
    emblaApi.on("select", select)
    emblaApi.on("settle", settle)
    emblaApi.on("reInit", reInit)
    return () => {
      emblaApi.off("scroll", paintProgress)
      emblaApi.off("pointerDown", pointerDown)
      emblaApi.off("pointerUp", pointerUp)
      emblaApi.off("select", select)
      emblaApi.off("settle", settle)
      emblaApi.off("reInit", reInit)
    }
  }, [emblaApi, onDateChange, onProgress, paintProgress, transition])

  useLayoutEffect(() => {
    const state = stateRef.current
    if (date === state.date) {
      if (state.phase === "idle") onProgress(state.date, 0)
      else paintProgress()
      return
    }

    const index = emblaApi?.selectedScrollSnap() ?? state.index
    const { current } = transition({ type: "replace", date, index })
    onProgress(current.date, 0)
    emblaApi?.scrollTo(index, true)
  }, [date, emblaApi, onProgress, paintProgress, transition])

  return (
    <section
      ref={viewportRef}
      className="touch-pan-y overflow-hidden"
      aria-label="日付を切り替え"
      aria-roledescription="カルーセル"
      style={{ height: calendarTimelineHeight }}
    >
      <div className="flex h-full">
        {calendarSlots.map((slotId, slot) => {
          const slideDate = dates[slot]
          if (!slideDate) return null
          return (
            <section
              key={slotId}
              className="min-w-0 flex-[0_0_100%]"
              aria-label={slideDate}
              aria-roledescription="日"
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

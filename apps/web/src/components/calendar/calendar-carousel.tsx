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
  calendarSlideCount,
  calendarSlideDates,
  calendarSwipeOffset,
} from "@/lib/calendar-carousel"
import type { JapanDateTime } from "@/lib/japan-time"
import { CalendarDayTimeline } from "./calendar-day-timeline"
import { calendarTimelineHeight } from "./calendar-layout"

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
  onProgress: (offset: number) => void
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
  const selectedIndexRef = useRef(calendarInitialSlide)
  const selectedDateRef = useRef(date)
  const datesRef = useRef(
    calendarSlideDates(date, calendarInitialSlide, calendarSlideCount)
  )
  const [dates, setDates] = useState(datesRef.current)

  const rebaseDates = useCallback((nextDate: string, selectedIndex: number) => {
    const nextDates = calendarSlideDates(
      nextDate,
      selectedIndex,
      calendarSlideCount
    )
    selectedDateRef.current = nextDate
    selectedIndexRef.current = selectedIndex
    datesRef.current = nextDates
    setDates(nextDates)
  }, [])

  useEffect(() => {
    if (!emblaApi) return undefined

    const paintProgress = () => {
      onProgress(
        calendarSwipeOffset(
          emblaApi.scrollProgress(),
          selectedIndexRef.current,
          emblaApi.scrollSnapList()
        )
      )
    }
    const settle = () => {
      const selectedIndex = emblaApi.selectedScrollSnap()
      const nextDate = datesRef.current[selectedIndex]
      if (!nextDate) return
      const previousDate = selectedDateRef.current
      rebaseDates(nextDate, selectedIndex)
      if (nextDate === previousDate) {
        onProgress(0)
      } else {
        onDateChange(nextDate)
      }
    }
    const reset = () => {
      const selectedIndex = emblaApi.selectedScrollSnap()
      selectedIndexRef.current = selectedIndex
      onProgress(0)
    }

    emblaApi.on("scroll", paintProgress)
    emblaApi.on("settle", settle)
    emblaApi.on("reInit", reset)
    return () => {
      emblaApi.off("scroll", paintProgress)
      emblaApi.off("settle", settle)
      emblaApi.off("reInit", reset)
    }
  }, [emblaApi, onDateChange, onProgress, rebaseDates])

  useLayoutEffect(() => {
    if (date === selectedDateRef.current) return
    const selectedIndex =
      emblaApi?.selectedScrollSnap() ?? selectedIndexRef.current
    emblaApi?.scrollTo(selectedIndex, true)
    rebaseDates(date, selectedIndex)
  }, [date, emblaApi, rebaseDates])

  return (
    <section
      ref={viewportRef}
      className="touch-pan-y overflow-hidden"
      aria-label="日付を切り替え"
      aria-roledescription="カルーセル"
      style={{ height: calendarTimelineHeight }}
    >
      <div className="flex h-full">
        {Array.from({ length: calendarSlideCount }, (_, slot) => {
          const slideDate = dates[slot]
          if (!slideDate) return null
          return (
            <section
              key={slot}
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

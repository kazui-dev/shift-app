import { useCallback, useRef } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"

import { Button } from "@workspace/ui/components/button"

import { calendarMonthSlideValues } from "@/features/calendar/lib/carousel"
import { monthDistance, monthValue } from "@/features/calendar/lib/dates"
import { loopCarouselSlots } from "@/features/calendar/lib/loop-carousel"
import { useLoopCarousel } from "./use-loop-carousel"

function monthLabel(month: string): string {
  return `${Number(month.slice(5))}月`
}

export function MonthSwitcher({
  date,
  onDateChange,
  onMonthChange,
}: {
  date: string
  onDateChange: (date: string) => void
  onMonthChange: (months: number) => void
}) {
  const pickerRef = useRef<HTMLInputElement>(null)
  const currentMonth = monthValue(date)
  const selectMonth = useCallback(
    (nextMonth: string, previousMonth: string) => {
      const distance = monthDistance(previousMonth, nextMonth)
      if (distance) onMonthChange(distance)
    },
    [onMonthChange]
  )
  const { scrollNext, scrollPrevious, values, viewportRef } = useLoopCarousel({
    duration: 20,
    onSelect: selectMonth,
    value: currentMonth,
    valuesAround: calendarMonthSlideValues,
  })

  function openPicker() {
    const picker = pickerRef.current
    if (!picker) return
    if (typeof picker.showPicker === "function") picker.showPicker()
    else picker.click()
  }

  return (
    <div className="relative flex items-center gap-1">
      <Button
        size="icon-sm"
        variant="ghost"
        aria-label="前の月"
        onClick={scrollPrevious}
      >
        <ChevronLeft />
      </Button>
      <section
        ref={viewportRef}
        className="w-16 touch-pan-y overflow-hidden"
        aria-label="月を切り替え"
        aria-roledescription="カルーセル"
      >
        <div className="flex">
          {loopCarouselSlots.map((slotId, slot) => {
            const month = values[slot]
            if (!month) return null
            return (
              <div
                key={slotId}
                className="min-w-0 flex-[0_0_100%]"
                inert={month !== currentMonth}
              >
                <Button
                  className="h-10 w-full font-semibold"
                  variant="ghost"
                  aria-label={`${monthLabel(month)}、日付を選択`}
                  onClick={openPicker}
                >
                  {monthLabel(month)}
                </Button>
              </div>
            )
          })}
        </div>
      </section>
      <input
        ref={pickerRef}
        aria-label="日付を選択"
        className="pointer-events-none absolute size-px opacity-0"
        tabIndex={-1}
        type="date"
        value={date}
        onChange={(event) => onDateChange(event.target.value)}
      />
      <Button
        size="icon-sm"
        variant="ghost"
        aria-label="次の月"
        onClick={scrollNext}
      >
        <ChevronRight />
      </Button>
    </div>
  )
}

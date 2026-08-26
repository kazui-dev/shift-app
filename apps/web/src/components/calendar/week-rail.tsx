import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type RefObject,
} from "react"

import {
  createWeekWindow,
  extendWeekWindow,
  localDate,
  snappedWeekDate,
  weekDates,
  weekStart,
  weekWindowExtensionDirection,
  weekWindowForDate,
  type WeekRailPreviewPair,
} from "@/lib/calendar-dates"

const fallbackScrollEndDelay = 160
const weekWindowRadius = 6
const weekWindowExtension = 6
const weekWindowEdgeThreshold = 2
const weekdays = ["日", "月", "火", "水", "木", "金", "土"]
const weekCellClassName =
  "grid min-h-16 grid-rows-[1rem_2rem] content-center justify-items-center gap-2 text-xs"
type WeekContentPage = {
  weekStart: string
  selectedDate: string
  indicatorPosition: number | string
  opacity: CSSProperties["opacity"]
}

function weekdayTextColor(weekday: number): string {
  if (weekday === 0) return "text-red-600 dark:text-red-400"
  if (weekday === 6) return "text-blue-600 dark:text-blue-400"
  return "text-foreground"
}

function longDate(value: string): string {
  const date = localDate(value)
  const formattedDate = new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(date)
  return `${formattedDate}（${weekdays[date.getDay()]}）`
}

function WeekContent({
  page,
  interactive,
  animateIndicator,
  onDateChange,
}: {
  page: WeekContentPage
  interactive: boolean
  animateIndicator: boolean
  onDateChange?: (date: string) => void
}) {
  const dates = weekDates(page.weekStart)

  return (
    <div
      aria-hidden={interactive ? undefined : true}
      className="relative grid w-full shrink-0 grid-cols-7 bg-background pb-3"
      style={{ opacity: page.opacity }}
    >
      <div className="relative z-[1] col-span-7 col-start-1 row-start-1 grid grid-cols-7">
        {dates.map((value) => {
          const selected = value === page.selectedDate
          const number = (
            <>
              <span aria-hidden className="h-4" />
              <span
                className={`relative z-[1] grid size-8 place-items-center text-sm text-foreground tabular-nums ${selected ? "font-semibold" : ""}`}
              >
                {localDate(value).getDate()}
              </span>
            </>
          )

          return interactive ? (
            <button
              key={value}
              type="button"
              className={weekCellClassName}
              aria-label={longDate(value)}
              aria-current={selected ? "date" : undefined}
              onClick={() => onDateChange?.(value)}
            >
              {number}
            </button>
          ) : (
            <span key={value} className={weekCellClassName}>
              {number}
            </span>
          )
        })}
      </div>

      <span
        aria-hidden
        className="pointer-events-none col-span-7 col-start-1 row-start-1 grid grid-cols-7"
      >
        <span
          className={`${weekCellClassName} ${animateIndicator ? "transition-transform [transition-duration:160ms] [transition-timing-function:cubic-bezier(0.2,0.8,0.2,1)] motion-reduce:transition-none" : ""}`}
          style={{
            transform: `translateX(${
              typeof page.indicatorPosition === "number"
                ? `${page.indicatorPosition * 100}%`
                : page.indicatorPosition
            })`,
          }}
        >
          <span aria-hidden className="h-4" />
          <span className="size-8 rounded-full bg-blue-500/15 dark:bg-blue-400/20" />
        </span>
      </span>
    </div>
  )
}

function WeekPreview({
  date,
  pair,
}: {
  date: string
  pair: WeekRailPreviewPair
}) {
  const fromWeekday = localDate(pair.fromDate).getDay()
  const toWeekday = localDate(pair.toDate).getDay()
  const progress = "var(--preview-progress, 0)"

  if (pair.sameWeek) {
    return (
      <div className="pointer-events-none absolute inset-0 z-[5] overflow-hidden border-b bg-background">
        <WeekContent
          page={{
            weekStart: weekStart(pair.fromDate),
            selectedDate: date,
            indicatorPosition: `calc(${fromWeekday * 100}% + ${(toWeekday - fromWeekday) * 100}% * ${progress})`,
            opacity: 1,
          }}
          interactive={false}
          animateIndicator={false}
        />
      </div>
    )
  }

  return (
    <div className="pointer-events-none absolute inset-0 z-[5] overflow-hidden border-b bg-background">
      <div className="absolute inset-0">
        <WeekContent
          page={{
            weekStart: weekStart(pair.fromDate),
            selectedDate: date,
            indicatorPosition: `calc(${fromWeekday * 100}% + 200% * ${progress})`,
            opacity: `calc(1 - ${progress})`,
          }}
          interactive={false}
          animateIndicator={false}
        />
      </div>
      <div className="absolute inset-0">
        <WeekContent
          page={{
            weekStart: weekStart(pair.toDate),
            selectedDate: date,
            indicatorPosition: `calc(${(toWeekday - 2) * 100}% + 200% * ${progress})`,
            opacity: progress,
          }}
          interactive={false}
          animateIndicator={false}
        />
      </div>
    </div>
  )
}

function pageWidth(rail: HTMLDivElement, pageCount: number): number {
  return pageCount > 0 ? rail.scrollWidth / pageCount : rail.clientWidth
}

export function WeekRail({
  date,
  onDateChange,
  previewPair,
  previewRootRef,
}: {
  date: string
  onDateChange: (date: string) => void
  previewPair: WeekRailPreviewPair | null
  previewRootRef: RefObject<HTMLDivElement | null>
}) {
  const railRef = useRef<HTMLDivElement>(null)
  const scrollTimerRef = useRef<number | null>(null)
  const touchActiveRef = useRef(false)
  const pendingPrependRef = useRef(0)
  const animateIndicatorRef = useRef(false)
  const currentDateRef = useRef(date)
  const [weekStarts, setWeekStarts] = useState(() =>
    createWeekWindow(date, weekWindowRadius)
  )
  const weekStartsRef = useRef(weekStarts)
  weekStartsRef.current = weekStarts
  currentDateRef.current = date
  const selectedWeekday = localDate(date).getDay()
  const showPreview =
    previewPair !== null &&
    (previewPair.fromDate !== date || previewPair.toDate !== date)

  useLayoutEffect(() => {
    const rail = railRef.current
    if (!rail) return
    const currentWeeks = weekStartsRef.current
    const nextWeeks = weekWindowForDate(currentWeeks, date, weekWindowRadius)
    if (nextWeeks !== currentWeeks) {
      pendingPrependRef.current = 0
      weekStartsRef.current = nextWeeks
      setWeekStarts(nextWeeks)
      return
    }

    const width = pageWidth(rail, currentWeeks.length)
    if (width <= 0) return
    if (pendingPrependRef.current > 0) {
      rail.scrollLeft += pendingPrependRef.current * width
      pendingPrependRef.current = 0
    }

    const targetIndex = currentWeeks.indexOf(weekStart(date))
    if (targetIndex < 0) return
    const target = targetIndex * width
    if (Math.abs(rail.scrollLeft - target) > 1) {
      rail.scrollLeft = target
    }
  }, [date, weekStarts])

  useEffect(() => {
    const rail = railRef.current
    if (!rail) return undefined
    const handleResize = () => {
      const currentWeeks = weekStartsRef.current
      const targetIndex = currentWeeks.indexOf(weekStart(date))
      if (targetIndex < 0 || rail.clientWidth <= 0) return
      rail.scrollLeft = targetIndex * pageWidth(rail, currentWeeks.length)
    }
    window.addEventListener("resize", handleResize)
    return () => window.removeEventListener("resize", handleResize)
  }, [date])

  useEffect(() => {
    animateIndicatorRef.current = false
  }, [date])

  useEffect(
    () => () => {
      if (scrollTimerRef.current !== null) {
        window.clearTimeout(scrollTimerRef.current)
      }
    },
    []
  )

  const extendWindow = useCallback((index: number) => {
    const currentWeeks = weekStartsRef.current
    const direction = weekWindowExtensionDirection(
      index,
      currentWeeks.length,
      weekWindowEdgeThreshold
    )
    if (!direction) return
    const extension = extendWeekWindow(
      currentWeeks,
      direction,
      weekWindowExtension
    )
    pendingPrependRef.current += extension.prepended
    weekStartsRef.current = extension.weeks
    setWeekStarts(extension.weeks)
  }, [])

  const settleScroll = useCallback(() => {
    if (scrollTimerRef.current !== null) {
      window.clearTimeout(scrollTimerRef.current)
      scrollTimerRef.current = null
    }
    const rail = railRef.current
    if (!rail || rail.clientWidth === 0) return
    const currentWeeks = weekStartsRef.current
    const width = pageWidth(rail, currentWeeks.length)
    const selectedDate = currentDateRef.current
    const snapped = snappedWeekDate(
      currentWeeks,
      rail.scrollLeft,
      width,
      selectedDate
    )
    if (!snapped) return
    const page = currentWeeks.indexOf(weekStart(snapped))
    if (snapped !== currentDateRef.current) onDateChange(snapped)
    extendWindow(page)
  }, [extendWindow, onDateChange])

  useEffect(() => {
    const rail = railRef.current
    if (!rail || !("onscrollend" in rail)) return undefined
    rail.addEventListener("scrollend", settleScroll)
    return () => rail.removeEventListener("scrollend", settleScroll)
  }, [settleScroll])

  function settleScrollFallback() {
    if (touchActiveRef.current) {
      scrollTimerRef.current = window.setTimeout(
        settleScrollFallback,
        fallbackScrollEndDelay
      )
      return
    }
    settleScroll()
  }

  function handleScroll() {
    const rail = railRef.current
    if (!rail || "onscrollend" in rail) return
    if (scrollTimerRef.current !== null) {
      window.clearTimeout(scrollTimerRef.current)
    }
    scrollTimerRef.current = window.setTimeout(
      settleScrollFallback,
      fallbackScrollEndDelay
    )
  }

  function handleDateClick(value: string) {
    animateIndicatorRef.current = weekStart(value) === weekStart(date)
    onDateChange(value)
  }

  return (
    <div ref={previewRootRef} className="relative overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-1 z-20 grid grid-cols-7 text-xs"
      >
        {weekdays.map((weekday, index) => (
          <span
            key={weekday}
            className={`text-center leading-4 ${weekdayTextColor(index)}`}
          >
            {weekday}
          </span>
        ))}
      </div>

      <div
        ref={railRef}
        aria-label="週を切り替え"
        className="flex snap-x snap-mandatory overflow-x-auto border-b [overflow-anchor:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        onScroll={handleScroll}
        onTouchCancel={() => {
          touchActiveRef.current = false
        }}
        onTouchEnd={() => {
          touchActiveRef.current = false
        }}
        onTouchStart={() => {
          touchActiveRef.current = true
        }}
      >
        {weekStarts.map((pageDate) => (
          <div key={pageDate} className="w-full shrink-0 snap-center">
            <WeekContent
              page={{
                weekStart: pageDate,
                selectedDate: date,
                indicatorPosition: selectedWeekday,
                opacity: 1,
              }}
              interactive
              animateIndicator={animateIndicatorRef.current}
              onDateChange={handleDateClick}
            />
          </div>
        ))}
      </div>

      {showPreview && previewPair && (
        <WeekPreview date={date} pair={previewPair} />
      )}
    </div>
  )
}

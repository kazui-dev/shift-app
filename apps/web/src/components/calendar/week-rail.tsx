import {
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
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
  type DayPagerPreview,
} from "@/lib/calendar-dates"

const fallbackScrollEndDelay = 160
const weekWindowRadius = 6
const weekWindowExtension = 6
const weekWindowEdgeThreshold = 2
const weekdays = ["日", "月", "火", "水", "木", "金", "土"]
const weekCellClassName =
  "grid min-h-16 grid-rows-[1rem_2rem] content-center justify-items-center gap-2 text-xs"
const indicatorTransitionClasses = [
  "transition-transform",
  "[transition-duration:160ms]",
  "[transition-timing-function:cubic-bezier(0.2,0.8,0.2,1)]",
  "motion-reduce:transition-none",
]

export type WeekRailPreviewController = {
  update: (preview: DayPagerPreview) => void
  commit: (date: string) => void
  dismiss: () => void
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
  week,
  selectedDate,
  onDateChange,
  onIndicatorTransitionEnd,
}: {
  week: string
  selectedDate: string
  onDateChange: (date: string) => void
  onIndicatorTransitionEnd: () => void
}) {
  const dates = weekDates(week)
  const selectedWeekday = localDate(selectedDate).getDay()

  return (
    <div className="relative grid w-full shrink-0 grid-cols-7 bg-background pb-3">
      <div className="relative z-[1] col-span-7 col-start-1 row-start-1 grid grid-cols-7">
        {dates.map((value) => {
          const selected = value === selectedDate
          return (
            <button
              key={value}
              type="button"
              className={weekCellClassName}
              aria-label={longDate(value)}
              aria-current={selected ? "date" : undefined}
              onClick={() => onDateChange(value)}
            >
              <span aria-hidden className="h-4" />
              <span
                className={`relative z-[1] grid size-8 place-items-center text-sm text-foreground tabular-nums ${selected ? "font-semibold" : ""}`}
              >
                {localDate(value).getDate()}
              </span>
            </button>
          )
        })}
      </div>

      <span
        aria-hidden
        className="pointer-events-none col-span-7 col-start-1 row-start-1 grid grid-cols-7"
      >
        <span
          data-week-indicator
          className={weekCellClassName}
          style={{ transform: `translateX(${selectedWeekday * 100}%)` }}
          onTransitionEnd={(event) => {
            if (event.propertyName === "transform") {
              onIndicatorTransitionEnd()
            }
          }}
        >
          <span aria-hidden className="h-4" />
          <span className="size-8 rounded-full bg-blue-500/15 dark:bg-blue-400/20" />
        </span>
      </span>
    </div>
  )
}

function PreviewWeek({
  layerRef,
}: {
  layerRef: RefObject<HTMLDivElement | null>
}) {
  return (
    <div ref={layerRef} className="absolute inset-0 opacity-0">
      <div className="relative grid w-full shrink-0 grid-cols-7 bg-background pb-3">
        <div className="relative z-[1] col-span-7 col-start-1 row-start-1 grid grid-cols-7">
          {weekdays.map((weekday) => (
            <span key={weekday} className={weekCellClassName}>
              <span aria-hidden className="h-4" />
              <span
                data-preview-number
                className="relative z-[1] grid size-8 place-items-center text-sm text-foreground tabular-nums"
              />
            </span>
          ))}
        </div>

        <span
          aria-hidden
          className="pointer-events-none col-span-7 col-start-1 row-start-1 grid grid-cols-7"
        >
          <span data-preview-indicator className={weekCellClassName}>
            <span aria-hidden className="h-4" />
            <span className="size-8 rounded-full bg-blue-500/15 dark:bg-blue-400/20" />
          </span>
        </span>
      </div>
    </div>
  )
}

function setPreviewWeek(
  layer: HTMLDivElement,
  date: string,
  selectedDate: string
): void {
  const numbers = layer.querySelectorAll<HTMLElement>("[data-preview-number]")
  for (const [index, value] of weekDates(date).entries()) {
    const number = numbers.item(index)
    number.textContent = String(localDate(value).getDate())
    number.classList.toggle("font-semibold", value === selectedDate)
  }
}

function previewIndicator(layer: HTMLDivElement): HTMLElement | null {
  return layer.querySelector<HTMLElement>("[data-preview-indicator]")
}

function pageWidth(rail: HTMLDivElement, pageCount: number): number {
  return pageCount > 0 ? rail.scrollWidth / pageCount : rail.clientWidth
}

export function WeekRail({
  date,
  onDateChange,
  previewControllerRef,
}: {
  date: string
  onDateChange: (date: string) => void
  previewControllerRef: RefObject<WeekRailPreviewController | null>
}) {
  const railRef = useRef<HTMLDivElement>(null)
  const previewRootRef = useRef<HTMLDivElement>(null)
  const previewLayerARef = useRef<HTMLDivElement>(null)
  const previewLayerBRef = useRef<HTMLDivElement>(null)
  const scrollTimerRef = useRef<number | null>(null)
  const transitionTimerRef = useRef<number | null>(null)
  const touchActiveRef = useRef(false)
  const pendingPrependRef = useRef(0)
  const pendingHandoffRef = useRef<string | null>(null)
  const renderedPreviewRef = useRef<{
    fromDate: string
    toDate: string
    selectedDate: string
  } | null>(null)
  const tapTargetRef = useRef<string | null>(null)
  const currentDateRef = useRef(date)
  const [weekStarts, setWeekStarts] = useState(() =>
    createWeekWindow(date, weekWindowRadius)
  )
  const weekStartsRef = useRef(weekStarts)
  weekStartsRef.current = weekStarts
  currentDateRef.current = date

  const disableIndicatorTransition = useCallback(() => {
    if (transitionTimerRef.current !== null) {
      window.clearTimeout(transitionTimerRef.current)
      transitionTimerRef.current = null
    }
    tapTargetRef.current = null
    railRef.current
      ?.querySelectorAll<HTMLElement>("[data-week-indicator]")
      .forEach((indicator) => {
        indicator.classList.remove(...indicatorTransitionClasses)
      })
  }, [])

  const hidePreview = useCallback(() => {
    const root = previewRootRef.current
    if (!root) return
    // Reset only after the committed rail is visible; a visible reset exposes
    // the gesture's old position for one frame.
    root.style.visibility = "hidden"
    root.style.setProperty("--preview-progress", "0")
    pendingHandoffRef.current = null
    renderedPreviewRef.current = null
  }, [])

  useImperativeHandle(
    previewControllerRef,
    () => ({
      update(preview) {
        const root = previewRootRef.current
        const layerA = previewLayerARef.current
        const layerB = previewLayerBRef.current
        if (!root || !layerA || !layerB) return
        const startingPreview = !renderedPreviewRef.current
        if (startingPreview) disableIndicatorTransition()
        pendingHandoffRef.current = null

        const selectedDate = currentDateRef.current
        const rendered = renderedPreviewRef.current
        if (
          !rendered ||
          rendered.fromDate !== preview.fromDate ||
          rendered.toDate !== preview.toDate ||
          rendered.selectedDate !== selectedDate
        ) {
          const indicatorA = previewIndicator(layerA)
          const indicatorB = previewIndicator(layerB)
          if (!indicatorA || !indicatorB) return
          const fromWeekday = localDate(preview.fromDate).getDay()
          const toWeekday = localDate(preview.toDate).getDay()
          setPreviewWeek(layerA, preview.fromDate, selectedDate)

          if (preview.sameWeek) {
            layerA.style.opacity = "1"
            indicatorA.style.transform = `translateX(calc(${fromWeekday * 100}% + ${(toWeekday - fromWeekday) * 100}% * var(--preview-progress)))`
            layerB.style.opacity = "0"
          } else {
            setPreviewWeek(layerB, preview.toDate, selectedDate)
            layerA.style.opacity = "calc(1 - var(--preview-progress))"
            indicatorA.style.transform = `translateX(calc(${fromWeekday * 100}% + 200% * var(--preview-progress)))`
            layerB.style.opacity = "var(--preview-progress)"
            indicatorB.style.transform = `translateX(calc(${(toWeekday - 2) * 100}% + 200% * var(--preview-progress)))`
          }
          renderedPreviewRef.current = {
            fromDate: preview.fromDate,
            toDate: preview.toDate,
            selectedDate,
          }
        }

        // Between adjacent-date boundaries this is the only DOM write.
        root.style.setProperty("--preview-progress", String(preview.progress))
        if (startingPreview) {
          root.style.visibility = "visible"
        }
      },
      commit(nextDate) {
        const root = previewRootRef.current
        const layerA = previewLayerARef.current
        const layerB = previewLayerBRef.current
        const indicatorA = layerA && previewIndicator(layerA)
        if (!root || !layerA || !layerB || !indicatorA) return
        disableIndicatorTransition()

        setPreviewWeek(layerA, nextDate, nextDate)
        layerA.style.opacity = "1"
        indicatorA.style.transform = `translateX(${localDate(nextDate).getDay() * 100}%)`
        layerB.style.opacity = "0"
        root.style.visibility = "visible"
        pendingHandoffRef.current = nextDate

        if (nextDate === currentDateRef.current) hidePreview()
      },
      dismiss: hidePreview,
    }),
    [disableIndicatorTransition, hidePreview]
  )

  useLayoutEffect(() => {
    const rail = railRef.current
    if (!rail) return
    if (tapTargetRef.current !== date) disableIndicatorTransition()

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
    if (pendingHandoffRef.current === date) hidePreview()
  }, [date, disableIndicatorTransition, hidePreview, weekStarts])

  useEffect(() => {
    const rail = railRef.current
    if (!rail) return undefined
    const handleResize = () => {
      disableIndicatorTransition()
      const currentWeeks = weekStartsRef.current
      const targetIndex = currentWeeks.indexOf(
        weekStart(currentDateRef.current)
      )
      if (targetIndex < 0 || rail.clientWidth <= 0) return
      rail.scrollLeft = targetIndex * pageWidth(rail, currentWeeks.length)
    }
    window.addEventListener("resize", handleResize)
    return () => window.removeEventListener("resize", handleResize)
  }, [disableIndicatorTransition])

  useEffect(
    () => () => {
      if (scrollTimerRef.current !== null) {
        window.clearTimeout(scrollTimerRef.current)
      }
      disableIndicatorTransition()
    },
    [disableIndicatorTransition]
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
    disableIndicatorTransition()
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
  }, [disableIndicatorTransition, extendWindow, onDateChange])

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
    disableIndicatorTransition()
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
    if (value === currentDateRef.current) return
    disableIndicatorTransition()
    if (weekStart(value) === weekStart(currentDateRef.current)) {
      tapTargetRef.current = value
      railRef.current
        ?.querySelectorAll<HTMLElement>("[data-week-indicator]")
        .forEach((indicator) => {
          indicator.classList.add(...indicatorTransitionClasses)
        })
      transitionTimerRef.current = window.setTimeout(
        disableIndicatorTransition,
        200
      )
    }
    onDateChange(value)
  }

  return (
    <div className="relative overflow-hidden">
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
              week={pageDate}
              selectedDate={date}
              onDateChange={handleDateClick}
              onIndicatorTransitionEnd={disableIndicatorTransition}
            />
          </div>
        ))}
      </div>

      <div
        ref={previewRootRef}
        aria-hidden
        className="pointer-events-none absolute inset-0 z-[5] overflow-hidden border-b bg-background"
        style={{ visibility: "hidden" }}
      >
        <PreviewWeek layerRef={previewLayerARef} />
        <PreviewWeek layerRef={previewLayerBRef} />
      </div>
    </div>
  )
}

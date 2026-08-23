import { useEffect, useRef, useState, type PointerEvent } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"

import { Button } from "@workspace/ui/components/button"

type MonthGesture = {
  pointerId: number
  startX: number
  startY: number
  startedAt: number
  axis: "pending" | "horizontal" | "vertical"
}

const maxMonthSwipe = 6
const monthPages = Array.from(
  { length: maxMonthSwipe * 2 + 1 },
  (_, index) => index - maxMonthSwipe
)

function monthLabel(date: string, offset: number): string {
  const month = new Date(`${date}T12:00:00`).getMonth()
  return `${((month + offset + 12) % 12) + 1}月`
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
  const viewportRef = useRef<HTMLLabelElement>(null)
  const gestureRef = useRef<MonthGesture | null>(null)
  const offsetRef = useRef(0)
  const monthDeltaRef = useRef<number | null>(null)
  const settleTimerRef = useRef<number | null>(null)
  const suppressClickRef = useRef(false)
  const [offset, setOffset] = useState(0)
  const [isSettling, setIsSettling] = useState(false)

  useEffect(
    () => () => {
      if (settleTimerRef.current !== null) {
        window.clearTimeout(settleTimerRef.current)
      }
    },
    []
  )

  function updateOffset(nextOffset: number) {
    offsetRef.current = nextOffset
    setOffset(nextOffset)
  }

  function finishSwipe() {
    if (settleTimerRef.current !== null) {
      window.clearTimeout(settleTimerRef.current)
      settleTimerRef.current = null
    }
    const monthDelta = monthDeltaRef.current
    monthDeltaRef.current = null
    setIsSettling(false)
    updateOffset(0)
    if (monthDelta !== null) onMonthChange(monthDelta)
  }

  function settleSwipe(monthDelta: number | null) {
    const viewport = viewportRef.current
    if (!viewport) return
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      updateOffset(0)
      if (monthDelta !== null) onMonthChange(monthDelta)
      return
    }
    monthDeltaRef.current = monthDelta
    setIsSettling(true)
    updateOffset(monthDelta === null ? 0 : monthDelta * -viewport.clientWidth)
    settleTimerRef.current = window.setTimeout(finishSwipe, 240)
  }

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    if (!event.isPrimary || event.button !== 0) return
    if (isSettling) finishSwipe()
    suppressClickRef.current = false
    gestureRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startedAt: performance.now(),
      axis: "pending",
    }
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    const gesture = gestureRef.current
    if (!gesture || gesture.pointerId !== event.pointerId) return
    const deltaX = event.clientX - gesture.startX
    const deltaY = event.clientY - gesture.startY
    if (gesture.axis === "pending") {
      if (Math.max(Math.abs(deltaX), Math.abs(deltaY)) < 6) return
      gesture.axis =
        Math.abs(deltaX) > Math.abs(deltaY) ? "horizontal" : "vertical"
      if (gesture.axis === "horizontal") {
        event.currentTarget.setPointerCapture(event.pointerId)
      }
    }
    if (gesture.axis === "vertical") {
      gestureRef.current = null
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId)
      }
      return
    }
    event.preventDefault()
    suppressClickRef.current = true
    const width = viewportRef.current?.clientWidth ?? 0
    updateOffset(
      Math.max(-width * maxMonthSwipe, Math.min(width * maxMonthSwipe, deltaX))
    )
  }

  function handlePointerUp(event: PointerEvent<HTMLDivElement>) {
    const gesture = gestureRef.current
    if (!gesture || gesture.pointerId !== event.pointerId) return
    gestureRef.current = null
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    if (gesture.axis !== "horizontal") return
    const distance = offsetRef.current
    const width = viewportRef.current?.clientWidth ?? 0
    if (width <= 0) {
      settleSwipe(null)
      return
    }
    const elapsed = Math.max(1, performance.now() - gesture.startedAt)
    const velocityInPages = -distance / elapsed / width
    const distanceInPages = -distance / width
    const projectedPages =
      distanceInPages + Math.max(-0.75, Math.min(0.75, velocityInPages * 80))
    const crossesThreshold =
      Math.abs(distance) >= Math.min(36, width * 0.28) ||
      (Math.abs(distance) >= 12 && Math.abs(velocityInPages * width) >= 0.35)
    const monthDelta = Math.max(
      -maxMonthSwipe,
      Math.min(
        maxMonthSwipe,
        Math.round(projectedPages) || (distance < 0 ? 1 : -1)
      )
    )
    settleSwipe(crossesThreshold ? monthDelta : null)
  }

  function handlePointerCancel(event: PointerEvent<HTMLDivElement>) {
    const gesture = gestureRef.current
    if (!gesture || gesture.pointerId !== event.pointerId) return
    gestureRef.current = null
    if (gesture.axis === "horizontal") settleSwipe(null)
  }

  return (
    <div
      className="flex touch-pan-y items-center gap-1 select-none"
      onClickCapture={(event) => {
        if (!suppressClickRef.current && !isSettling) return
        event.preventDefault()
        event.stopPropagation()
        suppressClickRef.current = false
      }}
      onPointerCancel={handlePointerCancel}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      <Button
        size="icon-sm"
        variant="ghost"
        aria-label="前の月"
        onClick={() => onMonthChange(-1)}
      >
        <ChevronLeft />
      </Button>
      <label
        ref={viewportRef}
        className="relative grid min-h-10 w-16 place-items-center overflow-hidden px-2 text-center font-semibold"
      >
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            transform: `translateX(${offset}px)`,
            transition: isSettling
              ? "transform 180ms cubic-bezier(0.2, 0.8, 0.2, 1)"
              : "none",
          }}
          onTransitionEnd={finishSwipe}
        >
          {monthPages.map((monthOffset) => (
            <span
              key={monthOffset}
              className="absolute inset-0 grid place-items-center"
              style={{ transform: `translateX(${monthOffset * 100}%)` }}
            >
              {monthLabel(date, monthOffset)}
            </span>
          ))}
        </span>
        <input
          aria-label="日付を選択"
          className="absolute inset-0 size-full cursor-pointer opacity-0 outline-none"
          type="date"
          value={date}
          onChange={(event) => onDateChange(event.target.value)}
        />
      </label>
      <Button
        size="icon-sm"
        variant="ghost"
        aria-label="次の月"
        onClick={() => onMonthChange(1)}
      >
        <ChevronRight />
      </Button>
    </div>
  )
}

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
  onMonthChange: (direction: -1 | 1) => void
}) {
  const viewportRef = useRef<HTMLLabelElement>(null)
  const gestureRef = useRef<MonthGesture | null>(null)
  const offsetRef = useRef(0)
  const directionRef = useRef<-1 | 1 | null>(null)
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
    const direction = directionRef.current
    directionRef.current = null
    setIsSettling(false)
    updateOffset(0)
    if (direction !== null) onMonthChange(direction)
  }

  function settleSwipe(direction: -1 | 1 | null) {
    const viewport = viewportRef.current
    if (!viewport) return
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      updateOffset(0)
      if (direction !== null) onMonthChange(direction)
      return
    }
    directionRef.current = direction
    setIsSettling(true)
    updateOffset(direction === null ? 0 : direction * -viewport.clientWidth)
    settleTimerRef.current = window.setTimeout(finishSwipe, 240)
  }

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    if (!event.isPrimary || event.button !== 0 || isSettling) return
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
    updateOffset(Math.max(-width, Math.min(width, deltaX)))
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
    const elapsed = Math.max(1, performance.now() - gesture.startedAt)
    const velocity = Math.abs(distance) / elapsed
    const committed =
      Math.abs(distance) >= Math.min(36, width * 0.28) ||
      (Math.abs(distance) >= 12 && velocity >= 0.35)
    settleSwipe(committed ? (distance < 0 ? 1 : -1) : null)
    window.setTimeout(() => {
      suppressClickRef.current = false
    }, 0)
  }

  function handlePointerCancel(event: PointerEvent<HTMLDivElement>) {
    const gesture = gestureRef.current
    if (!gesture || gesture.pointerId !== event.pointerId) return
    gestureRef.current = null
    if (gesture.axis === "horizontal") settleSwipe(null)
    window.setTimeout(() => {
      suppressClickRef.current = false
    }, 0)
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
          {[-1, 0, 1].map((monthOffset) => (
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

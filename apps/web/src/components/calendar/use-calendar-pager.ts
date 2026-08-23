import {
  useEffect,
  useLayoutEffect,
  useRef,
  type PointerEventHandler,
  type TouchEventHandler,
  type UIEventHandler,
} from "react"

import {
  pagerPositionIsStable,
  pagerSettleDelay,
} from "./calendar-pager-settle"

type PagerPhase = "idle" | "dragging" | "settling" | "recentering"

export function useCalendarPager({
  pageKey,
  onNext,
  onPrevious,
  onProgress,
}: {
  pageKey: string
  onNext: () => void
  onPrevious: () => void
  onProgress: (progress: number) => void
}) {
  const pagerRef = useRef<HTMLDivElement>(null)
  const callbacksRef = useRef({ onNext, onPrevious, onProgress })
  const phaseRef = useRef<PagerPhase>("idle")
  const activePointerRef = useRef<number | null>(null)
  const touchActiveRef = useRef(false)
  const gestureIdRef = useRef(0)
  const committedGestureIdRef = useRef<number | null>(null)
  const settleTimerRef = useRef<number | null>(null)
  const settlePositionRef = useRef<number | null>(null)
  const progressFrameRef = useRef<number | null>(null)
  const recenterFrameRef = useRef<number | null>(null)
  const finishRecenterFrameRef = useRef<number | null>(null)
  const originalSnapTypeRef = useRef<string | null>(null)
  callbacksRef.current = { onNext, onPrevious, onProgress }

  function clearSettleTimer() {
    if (settleTimerRef.current === null) return
    window.clearTimeout(settleTimerRef.current)
    settleTimerRef.current = null
    settlePositionRef.current = null
  }

  function clearRecenterFrames() {
    if (recenterFrameRef.current !== null) {
      window.cancelAnimationFrame(recenterFrameRef.current)
      recenterFrameRef.current = null
    }
    if (finishRecenterFrameRef.current !== null) {
      window.cancelAnimationFrame(finishRecenterFrameRef.current)
      finishRecenterFrameRef.current = null
    }
  }

  function centerPager(finishImmediately: boolean) {
    const pager = pagerRef.current
    if (!pager || pager.clientWidth === 0) return
    clearSettleTimer()
    clearRecenterFrames()
    phaseRef.current = "recentering"
    originalSnapTypeRef.current ??= pager.style.scrollSnapType
    pager.style.scrollSnapType = "none"
    pager.scrollLeft = pager.clientWidth
    callbacksRef.current.onProgress(0)
    if (finishImmediately) {
      pager.getBoundingClientRect()
      pager.style.scrollSnapType = originalSnapTypeRef.current
      phaseRef.current = "idle"
      return
    }
    recenterFrameRef.current = window.requestAnimationFrame(() => {
      recenterFrameRef.current = null
      const currentPager = pagerRef.current
      if (!currentPager) return
      currentPager.scrollLeft = currentPager.clientWidth
      finishRecenterFrameRef.current = window.requestAnimationFrame(() => {
        finishRecenterFrameRef.current = null
        const latestPager = pagerRef.current
        if (!latestPager) return
        latestPager.style.scrollSnapType = originalSnapTypeRef.current ?? ""
        phaseRef.current = "idle"
      })
    })
  }

  function scheduleSettle(delay: number) {
    const pager = pagerRef.current
    if (!pager) return
    clearSettleTimer()
    settlePositionRef.current = pager.scrollLeft
    settleTimerRef.current = window.setTimeout(() => {
      settleTimerRef.current = null
      const latestPager = pagerRef.current
      const previousPosition = settlePositionRef.current
      settlePositionRef.current = null
      if (
        latestPager &&
        previousPosition !== null &&
        !pagerPositionIsStable(previousPosition, latestPager.scrollLeft)
      ) {
        scheduleSettle(delay)
        return
      }
      settlePager()
    }, delay)
  }

  function scheduleSafetySettle() {
    const pager = pagerRef.current
    if (!pager) return
    scheduleSettle(pagerSettleDelay("onscrollend" in pager))
  }

  function settlePager() {
    clearSettleTimer()
    if (phaseRef.current === "recentering") return
    if (activePointerRef.current !== null || touchActiveRef.current) return
    const pager = pagerRef.current
    if (!pager || pager.clientWidth === 0) return
    const page = Math.max(
      0,
      Math.min(2, Math.round(pager.scrollLeft / pager.clientWidth))
    )
    callbacksRef.current.onProgress(0)
    if (page === 1) {
      phaseRef.current = "idle"
      return
    }
    const gestureId = gestureIdRef.current
    if (committedGestureIdRef.current === gestureId) {
      centerPager(false)
      return
    }
    committedGestureIdRef.current = gestureId
    phaseRef.current = "recentering"
    if (page === 0) callbacksRef.current.onPrevious()
    if (page === 2) callbacksRef.current.onNext()
  }

  useLayoutEffect(() => {
    centerPager(false)
  }, [pageKey])

  useEffect(
    () => () => {
      clearSettleTimer()
      clearRecenterFrames()
      if (progressFrameRef.current !== null) {
        window.cancelAnimationFrame(progressFrameRef.current)
      }
    },
    []
  )

  const handleScroll: UIEventHandler<HTMLDivElement> = () => {
    if (phaseRef.current === "recentering") return
    if (phaseRef.current === "idle") {
      gestureIdRef.current += 1
      phaseRef.current = "settling"
    }
    if (progressFrameRef.current !== null) {
      window.cancelAnimationFrame(progressFrameRef.current)
    }
    progressFrameRef.current = window.requestAnimationFrame(() => {
      progressFrameRef.current = null
      const pager = pagerRef.current
      if (!pager || pager.clientWidth === 0) return
      callbacksRef.current.onProgress(
        Math.max(-1, Math.min(1, pager.scrollLeft / pager.clientWidth - 1))
      )
    })
    scheduleSafetySettle()
  }

  function beginGesture() {
    if (phaseRef.current === "recentering") centerPager(true)
    clearSettleTimer()
    gestureIdRef.current += 1
    committedGestureIdRef.current = null
    phaseRef.current = "dragging"
  }

  const handlePointerDown: PointerEventHandler<HTMLDivElement> = (event) => {
    if (event.pointerType === "touch" || !event.isPrimary || event.button !== 0)
      return
    beginGesture()
    activePointerRef.current = event.pointerId
  }

  const handlePointerEnd: PointerEventHandler<HTMLDivElement> = (event) => {
    if (activePointerRef.current !== event.pointerId) return
    activePointerRef.current = null
    if (phaseRef.current === "recentering") return
    phaseRef.current = "settling"
    scheduleSafetySettle()
  }

  const handleTouchStart: TouchEventHandler<HTMLDivElement> = (event) => {
    if (event.touches.length !== 1) return
    beginGesture()
    touchActiveRef.current = true
  }

  const handleTouchEnd: TouchEventHandler<HTMLDivElement> = (event) => {
    if (event.touches.length > 0) return
    touchActiveRef.current = false
    if (phaseRef.current === "recentering") return
    phaseRef.current = "settling"
    scheduleSafetySettle()
  }

  const handleTouchCancel: TouchEventHandler<HTMLDivElement> = () => {
    touchActiveRef.current = false
    if (phaseRef.current === "recentering") return
    phaseRef.current = "settling"
    scheduleSafetySettle()
  }

  return {
    pagerRef,
    handlePointerCancel: handlePointerEnd,
    handlePointerDown,
    handlePointerUp: handlePointerEnd,
    handleScroll,
    handleScrollEnd: settlePager,
    handleTouchCancel,
    handleTouchEnd,
    handleTouchStart,
  }
}

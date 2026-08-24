import {
  useEffect,
  useLayoutEffect,
  useRef,
  type CSSProperties,
  type MouseEventHandler,
  type PointerEventHandler,
} from "react"

import {
  beginPagerGesture,
  beginPagerSettlement,
  finishPagerSettlement,
  swipeDirection,
  type PagerPhase,
  type SwipeDirection,
} from "./swipe-pager"

type Gesture = {
  pointerId: number
  startX: number
  startY: number
  startedAt: number
  axis: "pending" | "horizontal" | "vertical"
}

const axisThreshold = 7
const settleDuration = 160
const trackStyle: CSSProperties = {
  transform: "translate3d(-100%, 0, 0)",
  willChange: "transform",
}

export function useSwipePager({
  pageKey,
  onNavigate,
  onProgress,
}: {
  pageKey: string
  onNavigate: (direction: -1 | 1) => void
  onProgress?: (progress: number) => void
}) {
  const viewportRef = useRef<HTMLDivElement>(null)
  const trackRef = useRef<HTMLDivElement>(null)
  const gestureRef = useRef<Gesture | null>(null)
  const phaseRef = useRef<PagerPhase>({ kind: "idle" })
  const gestureIdRef = useRef(0)
  const settlementIdRef = useRef(0)
  const settleTimerRef = useRef<number | null>(null)
  const settleFrameRef = useRef<number | null>(null)
  const progressFrameRef = useRef<number | null>(null)
  const clickResetTimerRef = useRef<number | null>(null)
  const offsetRef = useRef(0)
  const suppressClickRef = useRef(false)
  const callbacksRef = useRef({ onNavigate, onProgress })
  callbacksRef.current = { onNavigate, onProgress }

  function clearSettleTimer() {
    if (settleTimerRef.current === null) return
    window.clearTimeout(settleTimerRef.current)
    settleTimerRef.current = null
  }

  function reportProgress(offset: number) {
    if (!callbacksRef.current.onProgress) return
    if (progressFrameRef.current !== null) {
      window.cancelAnimationFrame(progressFrameRef.current)
    }
    progressFrameRef.current = window.requestAnimationFrame(() => {
      progressFrameRef.current = null
      const width = viewportRef.current?.clientWidth ?? 0
      callbacksRef.current.onProgress?.(
        width > 0 ? Math.max(-1, Math.min(1, -offset / width)) : 0
      )
    })
  }

  function clearSettleFrame() {
    if (settleFrameRef.current === null) return
    window.cancelAnimationFrame(settleFrameRef.current)
    settleFrameRef.current = null
  }

  function writeOffset(offset: number) {
    const track = trackRef.current
    offsetRef.current = offset
    if (track) {
      track.style.transform = `translate3d(calc(-100% + ${offset}px), 0, 0)`
    }
    reportProgress(offset)
  }

  function animateOffset(target: number, settlementId: number) {
    clearSettleFrame()
    const startOffset = offsetRef.current
    const startedAt = performance.now()
    const update = (now: number) => {
      const progress = Math.min(1, (now - startedAt) / settleDuration)
      const eased = 1 - (1 - progress) ** 3
      writeOffset(startOffset + (target - startOffset) * eased)
      if (progress < 1) {
        settleFrameRef.current = window.requestAnimationFrame(update)
      } else {
        settleFrameRef.current = null
        finishSettlement(settlementId)
      }
    }
    settleFrameRef.current = window.requestAnimationFrame(update)
  }

  function finishSettlement(id: number) {
    const result = finishPagerSettlement(phaseRef.current, id)
    if (result.direction === null) return
    phaseRef.current = result.phase
    clearSettleTimer()
    clearSettleFrame()
    writeOffset(0)
    if (result.direction !== 0) {
      callbacksRef.current.onNavigate(result.direction)
    }
  }

  function settle(direction: SwipeDirection) {
    const width = viewportRef.current?.clientWidth ?? 0
    settlementIdRef.current += 1
    const settlementId = settlementIdRef.current
    phaseRef.current = beginPagerSettlement(settlementId, direction)
    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches
    const target = direction === 0 ? 0 : -direction * width
    clearSettleTimer()
    clearSettleFrame()
    if (reducedMotion) writeOffset(target)
    else animateOffset(target, settlementId)
    settleTimerRef.current = window.setTimeout(
      () => finishSettlement(settlementId),
      reducedMotion ? 0 : settleDuration + 80
    )
  }

  function endGesture(
    event: Parameters<PointerEventHandler<HTMLDivElement>>[0],
    cancelled: boolean
  ) {
    const gesture = gestureRef.current
    if (!gesture || gesture.pointerId !== event.pointerId) return
    gestureRef.current = null
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    if (gesture.axis === "horizontal") {
      if (clickResetTimerRef.current !== null) {
        window.clearTimeout(clickResetTimerRef.current)
      }
      clickResetTimerRef.current = window.setTimeout(() => {
        suppressClickRef.current = false
        clickResetTimerRef.current = null
      }, 0)
    }
    if (gesture.axis !== "horizontal" || cancelled) {
      if (offsetRef.current !== 0) settle(0)
      else phaseRef.current = { kind: "idle" }
      return
    }
    settle(
      swipeDirection({
        distance: offsetRef.current,
        elapsed: performance.now() - gesture.startedAt,
        width: event.currentTarget.clientWidth,
      })
    )
  }

  const handlePointerDown: PointerEventHandler<HTMLDivElement> = (event) => {
    if (
      !event.isPrimary ||
      (event.pointerType !== "touch" && event.button !== 0)
    )
      return
    if (clickResetTimerRef.current !== null) {
      window.clearTimeout(clickResetTimerRef.current)
      clickResetTimerRef.current = null
    }
    suppressClickRef.current = false
    gestureIdRef.current += 1
    const next = beginPagerGesture(phaseRef.current, gestureIdRef.current)
    phaseRef.current = next.phase
    if (next.interruptedDirection !== null) {
      clearSettleTimer()
      clearSettleFrame()
      writeOffset(0)
      if (next.interruptedDirection !== 0) {
        callbacksRef.current.onNavigate(next.interruptedDirection)
      }
    }
    gestureRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startedAt: performance.now(),
      axis: "pending",
    }
  }

  const handlePointerMove: PointerEventHandler<HTMLDivElement> = (event) => {
    const gesture = gestureRef.current
    if (!gesture || gesture.pointerId !== event.pointerId) return
    const distanceX = event.clientX - gesture.startX
    const distanceY = event.clientY - gesture.startY
    if (gesture.axis === "pending") {
      if (Math.max(Math.abs(distanceX), Math.abs(distanceY)) < axisThreshold)
        return
      gesture.axis =
        Math.abs(distanceX) > Math.abs(distanceY) ? "horizontal" : "vertical"
      if (gesture.axis === "horizontal") {
        suppressClickRef.current = true
        event.currentTarget.setPointerCapture(event.pointerId)
      }
    }
    if (gesture.axis !== "horizontal") return
    event.preventDefault()
    const width = event.currentTarget.clientWidth
    writeOffset(Math.max(-width, Math.min(width, distanceX)))
  }

  const handlePointerUp: PointerEventHandler<HTMLDivElement> = (event) => {
    endGesture(event, false)
  }

  const handlePointerCancel: PointerEventHandler<HTMLDivElement> = (event) => {
    endGesture(event, true)
  }

  const handleClickCapture: MouseEventHandler<HTMLDivElement> = (event) => {
    if (!suppressClickRef.current) return
    event.preventDefault()
    event.stopPropagation()
    suppressClickRef.current = false
  }

  useLayoutEffect(() => {
    clearSettleTimer()
    clearSettleFrame()
    if (!gestureRef.current) phaseRef.current = { kind: "idle" }
    writeOffset(0)
  }, [pageKey])

  useEffect(
    () => () => {
      clearSettleTimer()
      clearSettleFrame()
      if (progressFrameRef.current !== null) {
        window.cancelAnimationFrame(progressFrameRef.current)
      }
      if (clickResetTimerRef.current !== null) {
        window.clearTimeout(clickResetTimerRef.current)
      }
    },
    []
  )

  return {
    viewportRef,
    trackRef,
    trackStyle,
    handleClickCapture,
    handleLostPointerCapture: handlePointerCancel,
    handlePointerCancel,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
  }
}

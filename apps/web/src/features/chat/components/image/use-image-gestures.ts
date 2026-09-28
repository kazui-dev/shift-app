import { useEffect, useRef, useState, type PointerEvent } from "react"
import {
  initialImageView,
  limitImageView,
  zoomImage,
  type Point,
} from "@/features/chat/components/image/zoom"

type Size = { width: number; height: number }

/**
 * Pinch, pan, double-tap and button zoom for the image in view. Taps and
 * buttons ease between sizes; dragging and pinching follow the finger.
 */
export function useImageGestures(
  image: Size | undefined,
  reducedMotion: boolean
) {
  const frame = useRef<HTMLDivElement | null>(null)
  const pointers = useRef(new Map<number, Point>())
  const current = useRef(initialImageView)
  const [view, setView] = useState(initialImageView)
  const [easing, setEasing] = useState(false)
  const press = useRef<Point | null>(null)
  const lastTap = useRef<{ time: number; x: number; y: number } | null>(null)

  function reset() {
    pointers.current.clear()
    current.current = initialImageView
    setView(initialImageView)
  }
  useEffect(() => {
    const element = frame.current
    if (!element) return undefined
    const observer = new ResizeObserver(reset)
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  function update(value: typeof view, eased = false) {
    setEasing(eased && !reducedMotion)
    const bounds = frame.current?.getBoundingClientRect()
    if (!bounds || !image) return
    const fit = Math.min(
      bounds.width / image.width,
      bounds.height / image.height
    )
    const limited = limitImageView(
      value,
      bounds.width,
      bounds.height,
      image.width * fit,
      image.height * fit
    )
    current.current = limited
    setView(limited)
  }
  function magnify(factor: number) {
    update(
      zoomImage(current.current, current.current.scale * factor, {
        x: 0,
        y: 0,
      }),
      true
    )
  }
  /** Double tap or double click: zoom in on that point, or back to fit. */
  function toggleZoom(point: Point) {
    update(
      current.current.scale === 1
        ? zoomImage(current.current, 2.5, point)
        : initialImageView,
      true
    )
  }
  function center(event: PointerEvent<HTMLElement>, point: Point) {
    const bounds = event.currentTarget.getBoundingClientRect()
    return {
      x: point.x - bounds.left - bounds.width / 2,
      y: point.y - bounds.top - bounds.height / 2,
    }
  }

  return {
    view,
    easing,
    reset,
    magnify,
    /** Attaches the frame the image is measured and zoomed within. */
    attach: (element: HTMLDivElement | null) => {
      frame.current = element
    },
    /** Whether swiping may move between images: only an image at its fit. */
    fitted: () => current.current.scale === 1,
    handlers: {
      onPointerDown: (event: PointerEvent<HTMLDivElement>) => {
        if (event.button !== 0 || pointers.current.size >= 2) return
        setEasing(false)
        press.current = { x: event.clientX, y: event.clientY }
        // Panning a zoomed image keeps the pointer even outside the frame.
        if (current.current.scale > 1)
          event.currentTarget.setPointerCapture(event.pointerId)
        pointers.current.set(event.pointerId, {
          x: event.clientX,
          y: event.clientY,
        })
      },
      onPointerMove: (event: PointerEvent<HTMLDivElement>) => {
        const last = pointers.current.get(event.pointerId)
        if (!last) return
        const point = { x: event.clientX, y: event.clientY }
        const other = [...pointers.current].find(
          ([id]) => id !== event.pointerId
        )?.[1]
        pointers.current.set(event.pointerId, point)
        if (other) {
          const distance = Math.hypot(last.x - other.x, last.y - other.y)
          if (distance < 1) return
          const midpoint = (value: Point) =>
            center(event, {
              x: (value.x + other.x) / 2,
              y: (value.y + other.y) / 2,
            })
          update(
            zoomImage(
              current.current,
              (current.current.scale *
                Math.hypot(point.x - other.x, point.y - other.y)) /
                distance,
              midpoint(last),
              midpoint(point)
            )
          )
        } else if (current.current.scale > 1) {
          update({
            ...current.current,
            x: current.current.x + point.x - last.x,
            y: current.current.y + point.y - last.y,
          })
        }
      },
      onLostPointerCapture: (event: PointerEvent<HTMLDivElement>) =>
        pointers.current.delete(event.pointerId),
      onPointerUp: (event: PointerEvent<HTMLDivElement>) => {
        const single = pointers.current.size === 1
        pointers.current.delete(event.pointerId)
        const start = press.current
        press.current = null
        const tap = {
          time: event.timeStamp,
          x: event.clientX,
          y: event.clientY,
        }
        if (
          !single ||
          !start ||
          Math.hypot(tap.x - start.x, tap.y - start.y) > 10
        ) {
          lastTap.current = null
          return
        }
        const previousTap = lastTap.current
        if (
          previousTap &&
          tap.time - previousTap.time < 300 &&
          Math.hypot(tap.x - previousTap.x, tap.y - previousTap.y) < 30
        ) {
          lastTap.current = null
          toggleZoom(center(event, tap))
          return
        }
        lastTap.current = tap
      },
      onPointerCancel: (event: PointerEvent<HTMLDivElement>) => {
        press.current = null
        pointers.current.delete(event.pointerId)
      },
    },
  }
}

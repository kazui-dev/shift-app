import { TimeGuides } from "./time-guides"
import { useRef, useState, type PointerEvent } from "react"
import { japanTime } from "@workspace/shared/japan-time"
import {
  useTimelineWidth,
  type TimelineWidthAnchor,
} from "./timeline-width-context"
import {
  DEFAULT_HOUR_WIDTH,
  MIN_HOUR_WIDTH,
  MAX_HOUR_WIDTH,
  HOUR_MS,
  resizedHourWidth,
  timelineMarks,
  timelineStep,
} from "./timeline-width"

type Drag = {
  pointer: number
  x: number
  width: number
  intervalHours: number
  anchor: TimelineWidthAnchor
}

export function TimelineAxis({
  start,
  end,
  printing = false,
}: {
  start: number
  end: number
  printing?: boolean
}) {
  const zoom = useTimelineWidth()
  const width = zoom?.width ?? DEFAULT_HOUR_WIDTH
  const axis = useRef<HTMLFieldSetElement>(null)
  const [drag, setDrag] = useState<Drag | null>(null)
  const step = printing ? 60 : timelineStep(width)
  const marks = timelineMarks(start, end, width, step)
  const timeLabel = (time: number) =>
    time === end && time > start && japanTime(time) === "00:00"
      ? "24:00"
      : japanTime(time)
  const resized = (event: PointerEvent) =>
    drag
      ? resizedHourWidth(drag.width, event.clientX - drag.x, drag.intervalHours)
      : width
  return (
    <fieldset
      aria-label="時間軸の目盛り"
      ref={axis}
      className={`relative mx-6 min-w-0 flex-1 text-xs text-muted-foreground ${drag ? "cursor-col-resize" : ""}`}
      onPointerMove={(event) => {
        if (drag && event.pointerId === drag.pointer)
          zoom?.preview(resized(event), drag.anchor)
      }}
      onPointerUp={(event) => {
        if (!drag || event.pointerId !== drag.pointer) return
        zoom?.preview(resized(event), drag.anchor)
        zoom?.commit(resized(event))
        setDrag(null)
        event.currentTarget.releasePointerCapture(event.pointerId)
      }}
      onPointerCancel={() => {
        if (drag) zoom?.commit(drag.width)
        setDrag(null)
      }}
    >
      <span
        className="pointer-events-none absolute inset-x-0 bottom-0 h-2"
        aria-hidden="true"
      >
        <TimeGuides scale={{ start, duration: end - start }} />
      </span>
      {marks.map((time) => (
        <span
          key={time}
          className="absolute inset-y-0"
          style={{ left: `${((time - start) / (end - start)) * 100}%` }}
        >
          <span className="pointer-events-none absolute top-3 -translate-x-1/2 whitespace-nowrap tabular-nums">
            {timeLabel(time)}
          </span>
          {!printing && zoom && time > start && (
            <button
              type="button"
              className="absolute inset-y-0 left-0 z-10 w-4 -translate-x-1/2 cursor-col-resize touch-none outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label={`${timeLabel(time)}の区切りで時間軸の幅を変更`}
              title="ドラッグして時間軸の幅を変更"
              onPointerDown={(event) => {
                if (event.button !== 0 || !axis.current) return
                const intervalHours = Math.min(
                  step / 60,
                  (time - start) / HOUR_MS
                )
                const viewport = axis.current.closest(".shift-timeline-scroll")
                if (!viewport) return
                const offsetHours = (time - start) / HOUR_MS - intervalHours
                const viewportX =
                  axis.current.getBoundingClientRect().left -
                  viewport.getBoundingClientRect().left +
                  offsetHours * width
                event.preventDefault()
                event.currentTarget.focus({ preventScroll: true })
                axis.current.setPointerCapture(event.pointerId)
                setDrag({
                  pointer: event.pointerId,
                  x: event.clientX,
                  width,
                  intervalHours,
                  anchor: { offsetHours, viewportX },
                })
              }}
              onKeyDown={(event) => {
                if (event.key === "Escape" && drag) {
                  event.preventDefault()
                  zoom.commit(drag.width)
                  setDrag(null)
                  axis.current?.releasePointerCapture(drag.pointer)
                  return
                }
                const next =
                  event.key === "ArrowRight"
                    ? width + 8
                    : event.key === "ArrowLeft"
                      ? width - 8
                      : event.key === "Home"
                        ? MIN_HOUR_WIDTH
                        : event.key === "End"
                          ? MAX_HOUR_WIDTH
                          : null
                if (next !== null) {
                  event.preventDefault()
                  zoom.commit(next)
                }
              }}
            />
          )}
        </span>
      ))}
    </fieldset>
  )
}

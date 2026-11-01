import {
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react"
import * as v from "valibot"
import { useViewPreference } from "@/lib/view-preferences"
import {
  TimelineWidthContext,
  type TimelineWidthAnchor,
} from "./timeline-width-context"
import {
  DEFAULT_HOUR_WIDTH,
  MIN_HOUR_WIDTH,
  MAX_HOUR_WIDTH,
  HOUR_MS,
  clampHourWidth,
  timelineStep,
  anchoredScroll,
} from "./timeline-width"
import "./time-grid.css"

const widthSchema = v.pipe(
  v.number(),
  v.integer(),
  v.minValue(MIN_HOUR_WIDTH),
  v.maxValue(MAX_HOUR_WIDTH)
)

export function ShiftTimeline({
  label,
  start,
  end,
  header,
  toolbar,
  detail,
  children,
  printing = false,
}: {
  label: string
  start: number
  end: number
  header: ReactNode
  toolbar?: ReactNode
  detail?: ReactNode
  children: ReactNode
  printing?: boolean
}) {
  const heading = useRef<HTMLDivElement>(null)
  const body = useRef<HTMLDivElement>(null)
  const [saved, save] = useViewPreference(
    "shifts:timeline-hour-width",
    widthSchema,
    DEFAULT_HOUR_WIDTH
  )
  const [draft, setDraft] = useState<number | null>(null)
  const width = printing ? DEFAULT_HOUR_WIDTH : (draft ?? saved)
  const previous = useRef(width)
  const scrollLeft = useRef(0)
  const anchor = useRef<TimelineWidthAnchor | null>(null)
  useLayoutEffect(() => {
    const container = body.current
    if (container && heading.current && previous.current !== width) {
      const nameWidth =
        parseFloat(
          getComputedStyle(container).getPropertyValue("--shift-name-width")
        ) || 192
      const viewportX = Math.min(
        container.clientWidth,
        (container.clientWidth + nameWidth + 24) / 2
      )
      const fixed = anchor.current ?? {
        offsetHours: Math.max(
          0,
          (scrollLeft.current + viewportX - nameWidth - 24) / previous.current
        ),
        viewportX,
      }
      container.scrollLeft = anchoredScroll(
        width,
        fixed.offsetHours,
        fixed.viewportX,
        nameWidth
      )
      heading.current.scrollLeft = container.scrollLeft
      scrollLeft.current = container.scrollLeft
    }
    previous.current = width
    anchor.current = null
  }, [width])
  const style: CSSProperties & Record<`--${string}`, string | number> = {
    "--shift-hour-width": `${width}px`,
    "--shift-time-width": `calc(var(--shift-hour-width) * ${(end - start) / HOUR_MS})`,
    "--shift-tick-minutes": printing ? 60 : timelineStep(width),
  }
  return (
    <TimelineWidthContext
      value={
        printing
          ? null
          : {
              width,
              preview: (next, fixed) => {
                anchor.current = fixed ?? null
                setDraft(clampHourWidth(next))
              },
              commit: (next) => {
                if (clampHourWidth(next) !== saved) save(clampHourWidth(next))
                setDraft(null)
              },
            }
      }
    >
      <section
        className="shift-timeline max-w-full min-w-0 border-b"
        aria-label={label}
        style={style}
      >
        <div className="sticky-header">
          {toolbar}
          <div
            ref={heading}
            className="shift-timeline-scroll [scrollbar-width:none] overflow-x-auto"
            onScroll={(event) => {
              scrollLeft.current = event.currentTarget.scrollLeft
              if (
                body.current &&
                body.current.scrollLeft !== event.currentTarget.scrollLeft
              )
                body.current.scrollLeft = event.currentTarget.scrollLeft
            }}
          >
            <div className="shift-timeline-content">{header}</div>
          </div>
          {detail}
        </div>
        <div
          ref={body}
          className="shift-timeline-scroll overflow-x-auto"
          onScroll={(event) => {
            scrollLeft.current = event.currentTarget.scrollLeft
            if (
              heading.current &&
              heading.current.scrollLeft !== event.currentTarget.scrollLeft
            )
              heading.current.scrollLeft = event.currentTarget.scrollLeft
          }}
        >
          <div className="shift-timeline-content [&>:first-child]:border-t-0">
            {children}
          </div>
        </div>
      </section>
    </TimelineWidthContext>
  )
}

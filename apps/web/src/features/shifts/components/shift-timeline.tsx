import { useRef, type ReactNode } from "react"
import "./time-grid.css"

export function ShiftTimeline({
  label,
  minWidth,
  header,
  detail,
  children,
}: {
  label: string
  minWidth: string
  header: ReactNode
  detail?: ReactNode
  children: ReactNode
}) {
  const heading = useRef<HTMLDivElement>(null)
  const body = useRef<HTMLDivElement>(null)
  return (
    <section
      className="shift-timeline max-w-full min-w-0 border-y"
      aria-label={label}
    >
      {/* Keep vertical stickiness outside the horizontal scroll container. */}
      <div className="sticky top-0 z-20 bg-background">
        <div
          ref={heading}
          className="shift-timeline-scroll [scrollbar-width:none] overflow-x-auto"
          onScroll={(event) => {
            if (
              body.current &&
              body.current.scrollLeft !== event.currentTarget.scrollLeft
            )
              body.current.scrollLeft = event.currentTarget.scrollLeft
          }}
        >
          <div className="shift-timeline-content" style={{ minWidth }}>
            {header}
          </div>
        </div>
        {detail}
      </div>
      <div
        ref={body}
        className="shift-timeline-scroll overflow-x-auto"
        onScroll={(event) => {
          if (
            heading.current &&
            heading.current.scrollLeft !== event.currentTarget.scrollLeft
          )
            heading.current.scrollLeft = event.currentTarget.scrollLeft
        }}
      >
        <div className="shift-timeline-content" style={{ minWidth }}>
          {children}
        </div>
      </div>
    </section>
  )
}

import { useLayoutEffect, useRef, type RefObject } from "react"
import { ChevronLeft, ChevronRight, X } from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import { japanTime } from "@workspace/shared/japan-time"
import type { staffing } from "./staffing"

export function StaffingDetail({
  anchor,
  period,
  previous,
  next,
  candidatesOnly,
  onTime,
  onCandidates,
  onClose,
}: {
  anchor: RefObject<HTMLSpanElement | null>
  period: ReturnType<typeof staffing>[number]
  previous: string | undefined
  next: string | undefined
  candidatesOnly: boolean
  onTime: (time: number) => void
  onCandidates: () => void
  onClose: () => void
}) {
  const panel = useRef<HTMLElement>(null)
  useLayoutEffect(() => {
    const element = panel.current
    const target = anchor.current
    if (!element || !target) return undefined
    const place = () => {
      const rect = target.getBoundingClientRect()
      const width = element.offsetWidth
      element.style.left = `${Math.max(8, Math.min(rect.left + rect.width / 2 - width / 2, window.innerWidth - width - 8))}px`
      // Stay above the member rows, even when the timeline is sticky.
      element.style.maxHeight = `${Math.max(0, rect.bottom - 8)}px`
      element.style.top = `${Math.max(8, rect.top - element.offsetHeight - 8)}px`
    }
    place()
    const observer = new ResizeObserver(place)
    observer.observe(element)
    window.addEventListener("resize", place)
    window.addEventListener("scroll", place, true)
    return () => {
      observer.disconnect()
      window.removeEventListener("resize", place)
      window.removeEventListener("scroll", place, true)
    }
  })

  return (
    <section
      ref={panel}
      aria-label="選択区間の人数と候補"
      className="fixed z-30 w-80 max-w-[calc(100vw-16px)] overflow-auto rounded-md border bg-popover p-2 text-popover-foreground shadow-md"
    >
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon-compact"
          aria-label="前の区間"
          disabled={!previous}
          onClick={() => previous && onTime(Date.parse(previous))}
        >
          <ChevronLeft />
        </Button>
        <span
          className="flex-1 text-center text-sm font-medium tabular-nums"
          aria-live="polite"
        >
          {japanTime(period.startsAt)}–{japanTime(period.endsAt)}
        </span>
        <Button
          variant="ghost"
          size="icon-compact"
          aria-label="次の区間"
          disabled={!next}
          onClick={() => next && onTime(Date.parse(next))}
        >
          <ChevronRight />
        </Button>
        <Button
          variant="ghost"
          size="icon-compact"
          aria-label="区間の選択を解除"
          onClick={onClose}
        >
          <X />
        </Button>
      </div>
      <div className="mt-1 flex items-center justify-between gap-2">
        <output
          aria-live="polite"
          className="text-xs whitespace-nowrap tabular-nums"
        >
          <span className={period.shortage ? "text-destructive" : undefined}>
            配置 {period.assigned}人
          </span>
          <span className="ml-1 text-muted-foreground">
            / 必要{" "}
            {period.required === null ? "未設定" : `${period.required}人`}
          </span>
        </output>
        <Button
          variant={candidatesOnly ? "secondary" : "outline"}
          size="sm"
          aria-pressed={candidatesOnly}
          disabled={!period.shortage}
          onClick={onCandidates}
        >
          {candidatesOnly ? "全員を表示" : "候補を表示"}
        </Button>
      </div>
    </section>
  )
}

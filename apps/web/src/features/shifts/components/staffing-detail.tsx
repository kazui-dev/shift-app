import type { RefObject } from "react"
import { ShiftPopover } from "./shift-popover"
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
  return (
    <ShiftPopover
      anchor={{
        position: anchor,
        focus: () =>
          anchor.current?.parentElement?.querySelector("input") ?? null,
      }}
      onClose={onClose}
      retainOnOutside
      initialFocus={false}
      side="top"
      align="center"
      collisionAvoidance={{
        side: "none",
        align: "shift",
        fallbackAxisSide: "none",
      }}
      aria-label="選択区間の人数と候補"
      className="w-80"
      bodyClassName="p-2"
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
    </ShiftPopover>
  )
}

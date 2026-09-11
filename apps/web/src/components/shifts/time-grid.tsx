import { ListFilter } from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import { timeLabel } from "./time-label"
import { useRef, useState, type CSSProperties, type MouseEvent } from "react"
import type { ShiftSelection } from "./shift-selection-panel"
import type { ActivityEditorInput } from "@workspace/shared/shifts"
import type { getActivity } from "@/api/activities"

export type EditorData = Awaited<ReturnType<typeof getActivity>>
export function TimeGrid({
  data,
  plan,
  role,
  search,
  includeUnavailable,
  selection,
  onSelect,
  onCommit,
  onMember,
  onFilter,
}: {
  data: EditorData
  plan: ActivityEditorInput
  role: string
  search: string
  includeUnavailable: boolean
  selection: ShiftSelection | null
  onSelect: (selection: ShiftSelection) => void
  onCommit: (selection: ShiftSelection) => void
  onMember: (memberId: string) => void
  onFilter: () => void
}) {
  const start = Date.parse(plan.startsAt),
    end = Date.parse(plan.endsAt),
    duration = end - start
  const drag = useRef<{
    memberId: string
    minute: number
    x: number
    left: number
    width: number
    edge: string | null
    slot: ActivityEditorInput["slots"][number] | undefined
  } | null>(null)
  const suppressClick = useRef(false)
  const pointerSlot = useRef<string | null>(null)
  const [preview, setPreview] = useState<ShiftSelection | null>(null)
  const minuteAt = (x: number, left: number, width: number) =>
    Math.max(
      0,
      Math.min(
        Math.floor(duration / 60000),
        (Math.round((start + ((x - left) / width) * duration) / 300000) *
          300000 -
          start) /
          60000
      )
    )
  function range(memberId: string, from: number, to: number): ShiftSelection {
    const max = Math.floor(duration / 60000)
    const first = Math.min(Math.min(from, to), max - 1)
    const last = Math.min(max, Math.max(first + 1, Math.max(from, to)))
    return {
      memberId,
      slotId: null,
      startsAt: new Date(start + first * 60000).toISOString(),
      endsAt: new Date(start + last * 60000).toISOString(),
    }
  }
  function dragged(
    current: NonNullable<typeof drag.current>,
    x: number
  ): ShiftSelection {
    const minute = minuteAt(x, current.left, current.width)
    if (!current.slot || !current.edge)
      return range(current.memberId, current.minute, minute)
    const slot = current.slot
    const value = start + minute * 60000
    return {
      memberId: current.memberId,
      slotId: slot.id,
      startsAt:
        current.edge === "start"
          ? new Date(
              Math.max(
                start,
                Math.min(
                  value,
                  Math.floor((Date.parse(slot.endsAt) - 1) / 300000) * 300000
                )
              )
            ).toISOString()
          : slot.startsAt,
      endsAt:
        current.edge === "end"
          ? new Date(
              Math.min(
                end,
                Math.max(
                  value,
                  Math.ceil((Date.parse(slot.startsAt) + 1) / 300000) * 300000
                )
              )
            ).toISOString()
          : slot.endsAt,
    }
  }
  function click(event: MouseEvent<HTMLButtonElement>, memberId: string) {
    if (suppressClick.current) {
      suppressClick.current = false
      pointerSlot.current = null
      return
    }
    const target = event.target
    const id =
      target instanceof Element
        ? target.closest("[data-slot-id]")?.getAttribute("data-slot-id")
        : null
    const slot = plan.slots.find(
      (item) => item.id === (id ?? pointerSlot.current)
    )
    pointerSlot.current = null
    if (slot) {
      onSelect({
        memberId,
        slotId: slot.id,
        startsAt: slot.startsAt,
        endsAt: slot.endsAt,
      })
      return
    }
    const rect = event.currentTarget.getBoundingClientRect()
    const from =
      event.detail === 0 ? 0 : minuteAt(event.clientX, rect.left, rect.width)
    onCommit(range(memberId, from, from + 60))
  }
  function position(from: string, to: string): CSSProperties {
    const left = Math.max(start, Date.parse(from)),
      right = Math.min(end, Date.parse(to))
    return {
      left: `${((left - start) / duration) * 100}%`,
      width: `${Math.max(0, ((right - left) / duration) * 100)}%`,
    }
  }
  const firstHour = Math.ceil(start / 3600000) * 3600000
  const hours = [
    ...new Set([
      start,
      ...Array.from(
        { length: Math.max(0, Math.ceil((end - firstHour) / 3600000)) },
        (_, index) => firstHour + index * 3600000
      ),
      end,
    ]),
  ]
  const labels = hours.filter(
    (hour) =>
      hour === start ||
      hour === end ||
      (hour - start >= 1800000 && end - hour >= 1800000)
  )
  const members = data.members.filter(
    (member) =>
      (includeUnavailable ||
        data.availability.some(
          (window) =>
            window.memberId === member.id &&
            Date.parse(window.startsAt) < end &&
            Date.parse(window.endsAt) > start
        )) &&
      `${member.displayName} ${member.studentId}`
        .toLocaleLowerCase()
        .includes(search.trim().toLocaleLowerCase()) &&
      (!role ||
        member.roles.some((item) =>
          role === "candidates"
            ? plan.candidateRoleIds.includes(item.id)
            : item.id === role
        ))
  )
  return (
    <div className="min-h-0 max-w-full min-w-0 flex-1 overflow-auto border-y border-border/70">
      <div className="min-w-[720px]">
        <div className="sticky top-0 z-10 flex h-10 bg-background">
          <div className="sticky left-0 z-20 flex w-32 shrink-0 items-center bg-background px-1 sm:w-40">
            <Button
              variant="ghost"
              size="sm"
              className="text-xs text-muted-foreground"
              aria-label="メンバーを絞り込む"
              aria-pressed={Boolean(role || search || !includeUnavailable)}
              onClick={onFilter}
            >
              <ListFilter className="size-3.5" />
              絞り込み
            </Button>
          </div>
          <div className="relative mx-6 min-w-0 flex-1 text-xs text-muted-foreground">
            {labels.map((hour) => (
              <span
                key={hour}
                className="absolute top-3 -translate-x-1/2 tabular-nums"
                style={{ left: `${((hour - start) / duration) * 100}%` }}
              >
                {timeLabel(hour)}
              </span>
            ))}
          </div>
        </div>
        {members.length === 0 && (
          <p className="py-10 text-sm text-muted-foreground">
            条件に合うメンバーがいません。
          </p>
        )}
        {members.map((member) => {
          return (
            <div
              key={member.id}
              className={`flex h-[84px] border-t border-border/70 ${selection?.memberId === member.id ? "bg-[color-mix(in_oklab,var(--muted)_55%,var(--background))]" : "bg-background"}`}
            >
              <button
                type="button"
                onClick={() => onMember(member.id)}
                aria-label={`${member.displayName}のシフトを編集`}
                className="sticky left-0 z-10 flex w-32 shrink-0 items-center gap-2 bg-inherit px-3 text-left text-sm sm:w-40"
              >
                <span className="min-w-0">
                  <span className="block truncate">{member.displayName}</span>
                  {data.submittedMemberIds.includes(member.id) &&
                    !data.availability.some(
                      (window) =>
                        window.memberId === member.id &&
                        Date.parse(window.startsAt) < end &&
                        Date.parse(window.endsAt) > start
                    ) && (
                      <span className="block text-xs font-normal text-muted-foreground">
                        参加不可
                      </span>
                    )}
                  {!data.submittedMemberIds.includes(member.id) && (
                    <span className="block text-xs font-normal text-muted-foreground">
                      未回答
                    </span>
                  )}
                </span>
              </button>
              <button
                type="button"
                className="relative mx-6 min-w-0 flex-1 overflow-hidden bg-inherit text-left outline-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
                aria-label={`${member.displayName}の勤務時間を変更`}
                onClick={(event) => click(event, member.id)}
                onPointerDown={(event) => {
                  const edge =
                    event.target instanceof Element
                      ? (event.target
                          .closest("[data-resize]")
                          ?.getAttribute("data-resize") ?? null)
                      : null
                  if (
                    (event.pointerType === "touch" && !edge) ||
                    event.button !== 0
                  )
                    return
                  const rect = event.currentTarget.getBoundingClientRect()
                  pointerSlot.current =
                    event.target instanceof Element
                      ? (event.target
                          .closest("[data-slot-id]")
                          ?.getAttribute("data-slot-id") ?? null)
                      : null
                  suppressClick.current = false
                  drag.current = {
                    memberId: member.id,
                    minute: minuteAt(event.clientX, rect.left, rect.width),
                    x: event.clientX,
                    left: rect.left,
                    width: rect.width,
                    edge,
                    slot: plan.slots.find(
                      (slot) => slot.id === pointerSlot.current
                    ),
                  }
                  event.currentTarget.setPointerCapture(event.pointerId)
                }}
                onPointerMove={(event) => {
                  const current = drag.current
                  if (!current || Math.abs(event.clientX - current.x) < 4)
                    return
                  setPreview(dragged(current, event.clientX))
                }}
                onPointerUp={(event) => {
                  const current = drag.current
                  if (current && Math.abs(event.clientX - current.x) >= 4) {
                    suppressClick.current = true
                    onCommit(dragged(current, event.clientX))
                  }
                  drag.current = null
                  setPreview(null)
                }}
                onPointerCancel={() => {
                  drag.current = null
                  setPreview(null)
                }}
              >
                {hours.map((hour) => (
                  <span
                    key={hour}
                    className="pointer-events-none absolute inset-y-0 z-[1] border-l border-border/70"
                    style={{ left: `${((hour - start) / duration) * 100}%` }}
                  />
                ))}
                {data.availability
                  .filter((item) => item.memberId === member.id)
                  .map((window) => (
                    <span
                      key={window.startsAt}
                      className="absolute top-2.5 z-[2] h-[30px] truncate rounded-[5px] bg-[#e7edf3] px-[9px] py-1.5 text-[13px] leading-[18px] font-medium text-[#3c4b59] tabular-nums dark:bg-slate-800 dark:text-slate-200"
                      style={position(window.startsAt, window.endsAt)}
                      title={`参加可能 ${timeLabel(window.startsAt)}–${timeLabel(window.endsAt)}`}
                    >
                      {timeLabel(window.startsAt)}–{timeLabel(window.endsAt)}
                    </span>
                  ))}
                {data.otherAssignments
                  .filter(
                    (item) =>
                      item.memberId === member.id &&
                      Date.parse(item.startsAt) < end &&
                      Date.parse(item.endsAt) > start
                  )
                  .map((item) => (
                    <span
                      key={`${item.startsAt}-${item.endsAt}`}
                      className="absolute top-[47px] z-[2] h-[25px] truncate rounded border border-border bg-background px-[9px] py-1 text-xs leading-[17px] text-muted-foreground"
                      style={position(item.startsAt, item.endsAt)}
                      title={item.name}
                    >
                      {item.name}
                    </span>
                  ))}
                {plan.slots
                  .filter((slot) => slot.memberIds.includes(member.id))
                  .map((slot) => {
                    const draft = preview
                    const shown =
                      draft?.memberId === member.id && draft.slotId === slot.id
                        ? draft
                        : slot
                    return (
                      <span
                        key={slot.id}
                        data-slot-id={slot.id}
                        className="absolute top-[47px] z-[2] h-[25px] truncate rounded py-1 pr-[14px] pl-[14px] text-xs leading-[17px] text-foreground tabular-nums"
                        style={{
                          ...position(shown.startsAt, shown.endsAt),
                          backgroundColor: `color-mix(in oklab, ${plan.color} 22%, var(--background))`,
                        }}
                      >
                        <span
                          aria-hidden="true"
                          data-resize="start"
                          className="absolute inset-y-0 left-0 flex w-3 cursor-ew-resize touch-none items-center justify-center"
                          title="ドラッグして開始時刻を変更"
                        >
                          <span className="pointer-events-none h-3 w-0.5 rounded-full bg-foreground/25" />
                        </span>
                        <span
                          aria-hidden="true"
                          data-resize="end"
                          className="absolute inset-y-0 right-0 flex w-3 cursor-ew-resize touch-none items-center justify-center"
                          title="ドラッグして終了時刻を変更"
                        >
                          <span className="pointer-events-none h-3 w-0.5 rounded-full bg-foreground/25" />
                        </span>
                        {timeLabel(shown.startsAt)}–{timeLabel(shown.endsAt)}
                      </span>
                    )
                  })}
                {preview?.memberId === member.id &&
                  (() => {
                    const value =
                      preview?.memberId === member.id ? preview : selection
                    return (
                      value && (
                        <span
                          aria-hidden="true"
                          className="pointer-events-none absolute top-[45px] z-[3] h-[29px] rounded border border-dashed border-foreground/50 bg-foreground/5"
                          style={position(value.startsAt, value.endsAt)}
                        />
                      )
                    )
                  })()}
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}

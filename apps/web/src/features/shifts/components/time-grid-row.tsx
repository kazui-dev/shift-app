import { MemberAvatar } from "@/features/members/components/member-avatar"
import { japanTime } from "@workspace/shared/japan-time"
import { useRef, useState, type MouseEvent } from "react"
import type { ActivityEditorInput } from "@workspace/shared/shifts"
import type { EditorData } from "../editor-data"
import type { ShiftSelection } from "./shift-selection-panel"
import type { timeScale } from "./time-scale"

export function TimeGridRow({
  member,
  submitted,
  availability,
  otherAssignments,
  slots,
  color,
  scale,
  selected,
  showAvailability,
  onSelect,
  onCommit,
  onMember,
}: {
  member: EditorData["members"][number]
  submitted: boolean
  availability: EditorData["availability"]
  otherAssignments: EditorData["otherAssignments"]
  slots: ActivityEditorInput["slots"]
  color: string
  scale: ReturnType<typeof timeScale>
  selected: boolean
  showAvailability: boolean
  onSelect: (selection: ShiftSelection) => void
  onCommit: (selection: ShiftSelection) => void
  onMember: (memberId: string) => void
}) {
  const { start, end, duration, hours, minuteAt, range, position, resize } =
    scale
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
  function dragged(
    current: NonNullable<typeof drag.current>,
    x: number
  ): ShiftSelection {
    const minute = minuteAt(x, current.left, current.width)
    if (!current.slot || !current.edge)
      return range(current.memberId, current.minute, minute)
    return {
      ...resize(current.slot, current.edge, minute),
      memberId: current.memberId,
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
    const slot = slots.find((item) => item.id === (id ?? pointerSlot.current))
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
    onMember(memberId)
  }
  return (
    <div
      className={`flex h-14 border-t border-border/70 pr-6 ${selected ? "bg-[color-mix(in_oklab,var(--muted)_55%,var(--background))]" : "bg-background"}`}
    >
      <button
        type="button"
        onClick={() => onMember(member.id)}
        aria-label={`${member.displayName}のシフトを編集`}
        data-shift-member={member.id}
        className="shift-name sticky left-0 z-10 flex shrink-0 items-center gap-2 bg-inherit px-3 text-left text-sm"
      >
        <MemberAvatar
          name={member.displayName}
          image={member.image}
          className="size-6 text-[10px]"
        />
        <span className="min-w-0">
          <span className="block truncate">{member.displayName}</span>
          {submitted &&
            !availability.some(
              (window) =>
                window.memberId === member.id &&
                Date.parse(window.startsAt) < end &&
                Date.parse(window.endsAt) > start
            ) && (
              <span className="block text-xs font-normal text-muted-foreground">
                参加不可
              </span>
            )}
          {!submitted && (
            <span className="block text-xs font-normal text-muted-foreground">
              未回答
            </span>
          )}
        </span>
      </button>
      <button
        type="button"
        className="relative block min-w-0 flex-1 overflow-hidden bg-inherit text-left outline-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
        aria-label={`${member.displayName}の勤務時間を変更`}
        onClick={(event) => click(event, member.id)}
        onPointerDown={(event) => {
          const edge =
            event.target instanceof Element
              ? (event.target
                  .closest("[data-resize]")
                  ?.getAttribute("data-resize") ?? null)
              : null
          if ((event.pointerType === "touch" && !edge) || event.button !== 0)
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
            slot: slots.find((slot) => slot.id === pointerSlot.current),
          }
          event.currentTarget.setPointerCapture(event.pointerId)
        }}
        onPointerMove={(event) => {
          const current = drag.current
          if (!current || Math.abs(event.clientX - current.x) < 4) return
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
        {showAvailability &&
          availability.map((window) => (
            <span
              key={window.startsAt}
              className="absolute top-[9px] h-9 rounded-sm bg-muted"
              style={position(window.startsAt, window.endsAt)}
              title={`参加可能 ${japanTime(window.startsAt)}〜${japanTime(window.endsAt)}`}
            ></span>
          ))}
        {otherAssignments
          .filter(
            (item) =>
              Date.parse(item.startsAt) < end && Date.parse(item.endsAt) > start
          )
          .map((item) => (
            <span
              key={`${item.startsAt}-${item.endsAt}`}
              className="absolute top-[17px] z-[2] h-5 truncate rounded border border-border bg-background px-[9px] text-xs leading-[17px] text-muted-foreground"
              style={position(item.startsAt, item.endsAt)}
              title={item.name}
            >
              {item.name}
            </span>
          ))}
        {slots.map((slot) => {
          const draft = preview
          const shown = draft?.slotId === slot.id ? draft : slot
          return (
            <span
              key={slot.id}
              data-slot-id={slot.id}
              className="absolute top-[17px] z-[2] h-5 truncate rounded pr-[14px] pl-[14px] text-xs leading-[17px] text-foreground tabular-nums"
              style={{
                ...position(shown.startsAt, shown.endsAt),
                backgroundColor: `color-mix(in oklab, ${color} 22%, var(--background))`,
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
              {japanTime(shown.startsAt)}〜{japanTime(shown.endsAt)}
            </span>
          )
        })}
        {preview && (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute top-[15px] z-[3] h-6 rounded border border-dashed border-foreground/50 bg-foreground/5"
            style={position(preview.startsAt, preview.endsAt)}
          />
        )}
      </button>
    </div>
  )
}

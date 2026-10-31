import { AssignmentRowCheckbox } from "./assignment-selection"
import { assignmentKey, memberSelectionKeys } from "./assignment-removal"
import type { AssignmentSelection } from "./use-assignment-selection"
import { ShiftMemberLabel } from "./shift-member-label"
import { TimeGuides } from "./time-guides"
import {
  clickAnchor,
  elementAnchor,
  shiftBarStyle,
  type ShiftAnchor,
} from "./shift-anchor"
import { MemberAvatar } from "@/features/members/components/member-avatar"
import { japanTime } from "@workspace/shared/japan-time"
import { memo, useRef, useState, type MouseEvent } from "react"
import type { ActivityEditorInput, Attendance } from "@workspace/shared/shifts"
import { cn } from "@workspace/ui/lib/utils"
import type { EditorData } from "../editor-data"
import type { ShiftSelection } from "./shift-selection-panel"
import type { timeScale } from "./time-scale"

export const TimeGridRow = memo(function TimeGridRow({
  assignmentSelection,
  activityId,
  member,
  duties,
  status,
  availability,
  otherAssignments,
  slots,
  attendance,
  color,
  scale,
  selected,
  onSelect,
  onCommit,
  onMember,
  onOther,
}: {
  assignmentSelection?: AssignmentSelection | undefined
  activityId: string
  duties: string[]
  member: EditorData["members"][number]
  status: "available" | "unavailable" | "unanswered"
  availability: EditorData["availability"]
  otherAssignments: EditorData["otherAssignments"]
  slots: ActivityEditorInput["slots"]
  attendance: Attendance | undefined
  color: string
  scale: ReturnType<typeof timeScale>
  selected: boolean
  onSelect: (selection: ShiftSelection, anchor: ShiftAnchor) => void
  onCommit: (selection: ShiftSelection) => void
  onMember: (memberId: string, anchor: ShiftAnchor) => void
  onOther?:
    | ((
        assignment: EditorData["otherAssignments"][number],
        anchor: ShiftAnchor
      ) => void)
    | undefined
}) {
  const { start, end, minuteAt, range, position, resize } = scale
  const attendanceLabel =
    attendance?.state === "late"
      ? "遅刻"
      : attendance?.state === "absent"
        ? "欠勤"
        : ""
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
      const bar = event.currentTarget.querySelector(
        `[data-slot-id="${slot.id}"]`
      )
      onSelect(
        {
          memberId,
          slotId: slot.id,
          startsAt: slot.startsAt,
          endsAt: slot.endsAt,
        },
        clickAnchor(event, bar instanceof HTMLElement ? bar : undefined)
      )
      return
    }
    const rect = event.currentTarget.getBoundingClientRect()
    const minute =
      event.detail === 0 ? 0 : minuteAt(event.clientX, rect.left, rect.width)
    onSelect(range(memberId, minute, minute + 60), clickAnchor(event))
  }
  const content = (
    <>
      <TimeGuides scale={scale} />
      {availability.map((window) => (
        <span
          key={window.startsAt}
          className="absolute top-[9px] h-9 rounded-sm bg-muted"
          style={position(window.startsAt, window.endsAt)}
          title={`参加可能 ${japanTime(window.startsAt)}〜${japanTime(window.endsAt)}`}
        ></span>
      ))}
      {slots.map((slot) => {
        const draft = preview
        const shown = draft?.slotId === slot.id ? draft : slot
        const key = assignmentKey({
          activityId,
          slotId: slot.id,
          memberId: member.id,
        })
        const attributes = {
          className: `absolute inset-x-0 truncate rounded pr-[14px] pl-[14px] text-left text-xs leading-[17px] text-foreground tabular-nums`,
          style: {
            ...shiftBarStyle,
            backgroundColor: `color-mix(in oklab, ${color} ${assignmentSelection?.keys.includes(key) ? 60 : 22}%, var(--background))`,
          },
        }
        if (assignmentSelection?.active)
          return (
            <button
              key={slot.id}
              type="button"
              className="absolute inset-y-0 z-[2] text-left"
              style={position(shown.startsAt, shown.endsAt)}
              data-assignment-key={key}
              aria-pressed={assignmentSelection.keys.includes(key)}
              aria-label={`${member.displayName} ${japanTime(slot.startsAt)}〜${japanTime(slot.endsAt)}の勤務を選択`}
              onClick={() => assignmentSelection.toggle(key)}
            >
              <span {...attributes}>
                {japanTime(slot.startsAt)}〜{japanTime(slot.endsAt)}
              </span>
            </button>
          )
        return (
          <span
            key={slot.id}
            data-slot-id={slot.id}
            className="absolute inset-y-0 z-[2]"
            style={position(shown.startsAt, shown.endsAt)}
          >
            <span data-shift-bar {...attributes}>
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
    </>
  )
  return (
    <div
      className={cn(
        "shift-timeline-row flex h-14 border-t border-border/70 bg-background",
        selected &&
          "bg-[color-mix(in_oklab,var(--muted)_55%,var(--background))]",
        attendance?.state === "late" && "bg-amber-50 dark:bg-amber-950",
        attendance?.state === "absent" && "bg-red-50 dark:bg-red-950",
        attendanceLabel && "[--muted-foreground:var(--foreground)]",
        selected && attendanceLabel && "ring-2 ring-ring ring-inset"
      )}
    >
      <div className="shift-name sticky left-0 z-10 flex shrink-0 items-center gap-2 bg-inherit px-2 text-sm sm:px-3">
        {assignmentSelection && (
          <AssignmentRowCheckbox
            selection={assignmentSelection}
            keys={memberSelectionKeys(activityId, member.id, slots)}
            name={member.displayName}
          />
        )}
        <button
          type="button"
          onClick={(event) =>
            onMember(member.id, elementAnchor(event.currentTarget))
          }
          disabled={assignmentSelection?.active}
          aria-label={`${member.displayName}のシフトを編集${attendanceLabel ? `。${attendanceLabel}` : ""}`}
          data-shift-member={member.id}
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
        >
          <span
            className={
              assignmentSelection
                ? "relative hidden shrink-0 sm:block"
                : "relative shrink-0"
            }
          >
            <MemberAvatar
              name={member.displayName}
              image={member.image}
              className="size-6 text-[10px]"
            />
          </span>
          <ShiftMemberLabel
            name={member.displayName}
            studentId={member.studentId}
            duties={duties}
            status={status}
          />
        </button>
      </div>
      <div className="relative mx-6 min-w-0 flex-1 overflow-hidden">
        {assignmentSelection?.active ? (
          <div data-selection-surface className="relative h-full w-full">
            {content}
          </div>
        ) : (
          <button
            type="button"
            className="relative block h-full w-full bg-inherit text-left outline-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
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
              drag.current = null
              // Clicking a duty (including its vertical padding) never starts a new duty drag.
              if (pointerSlot.current && !edge) return
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
            {content}
          </button>
        )}
        {otherAssignments
          .filter(
            (item) =>
              Date.parse(item.startsAt) < end && Date.parse(item.endsAt) > start
          )
          .map((item) => (
            <button
              key={`${item.activityId}-${item.slotId}-${item.startsAt}`}
              type="button"
              className="absolute inset-y-0 z-[2] text-left"
              style={position(item.startsAt, item.endsAt)}
              title={item.name}
              disabled={
                assignmentSelection?.active ||
                !onOther ||
                !item.activityId ||
                !item.slotId
              }
              onClick={(event) =>
                onOther?.(item, clickAnchor(event, event.currentTarget))
              }
            >
              <span
                data-shift-bar
                className="absolute inset-x-0 truncate rounded border border-border bg-background px-[9px] text-center text-xs leading-[17px] text-muted-foreground"
                style={shiftBarStyle}
              >
                {item.name}
              </span>
            </button>
          ))}
      </div>
    </div>
  )
})

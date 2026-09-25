import { MemberAvatar } from "@/components/member-avatar"
import { japanTime } from "@workspace/shared/japan-time"
import { useRef, useState, useLayoutEffect, type MouseEvent } from "react"
import type { ShiftSelection } from "./shift-selection-panel"
import type { ActivityEditorInput } from "@workspace/shared/shifts"
import type { getActivity } from "@/api/activities"
import { gridMembers, timeScale } from "./time-scale"

import { useShiftView } from "@/components/manage/context"

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
}) {
  const view = useShiftView(data.activity.year)
  const viewport = useRef<HTMLDivElement>(null)
  const [scrollTop, setScrollTop] = useState(() => view.scrollTop)
  useLayoutEffect(() => {
    if (viewport.current) viewport.current.scrollTop = view.scrollTop
  }, [view])
  const lastFilter = useRef(`${search}|${role}|${includeUnavailable}`)
  useLayoutEffect(() => {
    const key = `${search}|${role}|${includeUnavailable}`
    if (lastFilter.current === key) return
    lastFilter.current = key
    if (viewport.current) viewport.current.scrollTop = 0
    view.scrollTop = 0
    setScrollTop(0)
  }, [search, role, includeUnavailable, view])
  const scale = timeScale(plan.startsAt, plan.endsAt)
  const { start, end, duration, hours, labels } = scale
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
  const { minuteAt, range, position, resize } = scale
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
    onMember(memberId)
  }
  const members = gridMembers(
    data,
    plan,
    { search, role, includeUnavailable },
    scale
  )
  const first = Math.min(
    Math.max(0, members.length - 1),
    Math.max(0, Math.floor(scrollTop / 76) - 5)
  )
  const visible = members.slice(first, first + 30)
  return (
    <div
      ref={viewport}
      onScroll={(event) => {
        const top = event.currentTarget.scrollTop
        setScrollTop(top)
        view.scrollTop = top
      }}
      className="min-h-0 max-w-full min-w-0 flex-1 overflow-auto border-y border-border/70"
    >
      <div className="min-w-0 md:min-w-[720px]">
        <div className="sticky top-0 z-10 flex h-10 bg-background">
          <div className="sticky left-0 z-20 flex w-48 shrink-0 items-center bg-background px-1 sm:w-56">
            <span className="text-sm">
              メンバー{" "}
              <span className="ml-2 text-xs text-muted-foreground">
                {members.length}人
              </span>
            </span>
          </div>
          <div className="relative mx-6 hidden min-w-0 flex-1 text-xs text-muted-foreground md:block">
            {labels.map((hour) => (
              <span
                key={hour}
                className="absolute top-3 -translate-x-1/2 tabular-nums"
                style={{ left: `${((hour - start) / duration) * 100}%` }}
              >
                {japanTime(hour)}
              </span>
            ))}
          </div>
        </div>
        {members.length === 0 && (
          <p className="py-10 text-sm text-muted-foreground">
            条件に合うメンバーがいません。
          </p>
        )}
        <div style={{ height: first * 76 }} />
        {visible.map((member) => {
          return (
            <div
              key={member.id}
              className={`flex h-[76px] border-t border-border/70 ${selection?.memberId === member.id ? "bg-[color-mix(in_oklab,var(--muted)_55%,var(--background))]" : "bg-background"}`}
            >
              <button
                type="button"
                onClick={() => onMember(member.id)}
                aria-label={`${member.displayName}のシフトを編集`}
                className="sticky left-0 z-10 flex w-48 shrink-0 items-center gap-2 bg-inherit px-3 text-left text-sm sm:w-56"
              >
                <MemberAvatar
                  name={member.displayName}
                  image={member.image}
                  className="size-6 text-[10px]"
                />
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
              <div className="flex min-w-0 flex-1 flex-col justify-center gap-1 px-2 text-right text-sm md:hidden">
                {plan.slots
                  .filter((slot) => slot.memberIds.includes(member.id))
                  .map((slot) => (
                    <p key={slot.id}>
                      {japanTime(slot.startsAt)}〜{japanTime(slot.endsAt)}
                    </p>
                  ))}
                {!plan.slots.some((slot) =>
                  slot.memberIds.includes(member.id)
                ) && <p className="text-muted-foreground">勤務なし</p>}
                <p className="truncate text-xs text-muted-foreground">
                  シフト希望：
                  {data.availability
                    .filter((item) => item.memberId === member.id)
                    .map(
                      (item) =>
                        `${japanTime(item.startsAt)}〜${japanTime(item.endsAt)}`
                    )
                    .join("、") ||
                    (data.submittedMemberIds.includes(member.id)
                      ? "参加不可"
                      : "未回答")}
                </p>
              </div>
              <button
                type="button"
                className="relative mx-6 hidden min-w-0 flex-1 overflow-hidden bg-inherit text-left outline-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring md:block"
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
                      className="absolute top-2 z-[2] h-[25px] truncate rounded bg-muted px-2 py-1 text-xs leading-[17px] text-foreground tabular-nums"
                      style={position(window.startsAt, window.endsAt)}
                      title={`参加可能 ${japanTime(window.startsAt)}〜${japanTime(window.endsAt)}`}
                    >
                      {japanTime(window.startsAt)}〜{japanTime(window.endsAt)}
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
                      className="absolute top-[39px] z-[2] h-[25px] truncate rounded border border-border bg-background px-[9px] py-1 text-xs leading-[17px] text-muted-foreground"
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
                        className="absolute top-[39px] z-[2] h-[25px] truncate rounded py-1 pr-[14px] pl-[14px] text-xs leading-[17px] text-foreground tabular-nums"
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
                        {japanTime(shown.startsAt)}〜{japanTime(shown.endsAt)}
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
                          className="pointer-events-none absolute top-[37px] z-[3] h-[29px] rounded border border-dashed border-foreground/50 bg-foreground/5"
                          style={position(value.startsAt, value.endsAt)}
                        />
                      )
                    )
                  })()}
              </button>
            </div>
          )
        })}
        <div
          style={{
            height: Math.max(0, members.length - first - visible.length) * 76,
          }}
        />
      </div>
    </div>
  )
}

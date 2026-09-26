import { japanTime } from "@workspace/shared/japan-time"
import { useRef, useState, useLayoutEffect } from "react"
import type { ShiftSelection } from "./shift-selection-panel"
import type { ActivityEditorInput } from "@workspace/shared/shifts"
import type { EditorData } from "../editor-data"
import { TimeGridRow } from "./time-grid-row"
import { gridMembers, timeScale } from "./time-scale"

import { useShiftView } from "@/features/shifts/shift-view-context"

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
  const { start, duration, labels } = scale
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
  const visible = members.slice(first, first + 30).map((member) => ({
    member,
    submitted: data.submittedMemberIds.includes(member.id),
    availability: data.availability.filter(
      (window) => window.memberId === member.id
    ),
    otherAssignments: data.otherAssignments.filter(
      (assignment) => assignment.memberId === member.id
    ),
    slots: plan.slots.filter((slot) => slot.memberIds.includes(member.id)),
  }))
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
        {visible.map((row) => (
          <TimeGridRow
            key={row.member.id}
            {...row}
            color={plan.color}
            scale={scale}
            selected={selection?.memberId === row.member.id}
            onSelect={onSelect}
            onCommit={onCommit}
            onMember={onMember}
          />
        ))}
        <div
          style={{
            height: Math.max(0, members.length - first - visible.length) * 76,
          }}
        />
      </div>
    </div>
  )
}

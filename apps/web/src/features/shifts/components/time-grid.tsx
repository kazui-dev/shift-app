import { TimeGuides } from "./time-guides"
import { memberAvailability } from "./member-availability"
import { staffing } from "./staffing"
import "./time-grid.css"
import {
  japanInputValue,
  japanLocalDateTime,
  japanTime,
} from "@workspace/shared/japan-time"
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
  includeUnanswered,
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
  includeUnanswered: boolean
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
  const lastFilter = useRef(
    `${search}|${role}|${includeUnavailable}|${includeUnanswered}`
  )
  useLayoutEffect(() => {
    const key = `${search}|${role}|${includeUnavailable}|${includeUnanswered}`
    if (lastFilter.current === key) return
    lastFilter.current = key
    if (viewport.current) viewport.current.scrollTop = 0
    view.save({ scrollTop: 0 })
    setScrollTop(0)
  }, [search, role, includeUnavailable, includeUnanswered, view])
  const scale = timeScale(plan.startsAt, plan.endsAt)
  const { start, duration, labels } = scale
  const periods = staffing(plan)
  const [selectedTime, setSelectedTime] = useState<number | null>(null)
  const [candidatesOnly, setCandidatesOnly] = useState(false)
  const periodDetail = periods.find(
    (period) =>
      selectedTime !== null &&
      Date.parse(period.startsAt) <= selectedTime &&
      selectedTime < Date.parse(period.endsAt)
  )
  const members = gridMembers(data, plan, {
    search,
    role,
    includeUnavailable,
    includeUnanswered,
  }).filter((member) => {
    if (!candidatesOnly || !periodDetail) return true
    const from = Date.parse(periodDetail.startsAt),
      to = Date.parse(periodDetail.endsAt)
    return (
      data.availability.some(
        (item) =>
          item.memberId === member.id &&
          Date.parse(item.startsAt) <= from &&
          Date.parse(item.endsAt) >= to
      ) &&
      !data.otherAssignments.some(
        (item) =>
          item.memberId === member.id &&
          Date.parse(item.startsAt) < to &&
          Date.parse(item.endsAt) > from
      ) &&
      !plan.slots.some(
        (item) =>
          item.memberIds.includes(member.id) &&
          Date.parse(item.startsAt) < to &&
          Date.parse(item.endsAt) > from
      )
    )
  })
  const first = Math.min(
    Math.max(0, members.length - 1),
    Math.max(0, Math.floor(scrollTop / 56) - 5)
  )
  const visible = members.slice(first, first + 30).map((member) => ({
    member,
    status: memberAvailability(data, plan, member.id),
    availability: data.availability.filter(
      (window) => window.memberId === member.id
    ),
    otherAssignments: data.otherAssignments.filter(
      (assignment) => assignment.memberId === member.id
    ),
    slots: plan.slots.filter((slot) => slot.memberIds.includes(member.id)),
  }))
  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      {periodDetail && selectedTime !== null && (
        <div className="absolute top-[68px] left-2 z-30 flex max-w-[calc(100%-16px)] flex-wrap items-center gap-x-2 gap-y-2 rounded-md border bg-popover py-2 pr-9 pl-2 text-xs shadow-sm">
          <input
            type="time"
            step={60}
            aria-label="確認時刻"
            value={japanInputValue(selectedTime).slice(11, 16)}
            onChange={(event) => {
              const at = japanLocalDateTime(
                `${japanInputValue(selectedTime).slice(0, 10)}T${event.currentTarget.value}`
              )
              if (
                Number.isFinite(at) &&
                at >= start &&
                at < Date.parse(plan.endsAt)
              ) {
                setSelectedTime(at)
                setCandidatesOnly(false)
              }
            }}
            className="h-9 w-28 rounded-md border bg-background px-2 text-sm tabular-nums"
          />
          <output aria-live="polite" className="tabular-nums">
            <span
              className={periodDetail.shortage ? "text-destructive" : undefined}
            >
              配置 {periodDetail.assigned}人
            </span>
            <span className="ml-2 text-muted-foreground">
              / 必要{" "}
              {periodDetail.required === null
                ? "未設定"
                : `${periodDetail.required}人`}
            </span>
          </output>
          {periodDetail.shortage && (
            <button
              type="button"
              className="underline underline-offset-4"
              onClick={() => setCandidatesOnly(!candidatesOnly)}
            >
              {candidatesOnly ? "全員を表示" : "候補を表示"}
            </button>
          )}
          <button
            type="button"
            className="absolute top-0 right-0 flex size-9 items-center justify-center"
            aria-label="人数の詳細を閉じる"
            onClick={() => {
              setSelectedTime(null)
              setCandidatesOnly(false)
            }}
          >
            ×
          </button>
        </div>
      )}
      <div
        ref={viewport}
        onScroll={(event) => {
          const top = event.currentTarget.scrollTop
          setScrollTop(top)
          view.save({ scrollTop: top })
        }}
        className="shift-timeline min-h-0 max-w-full min-w-0 flex-1 overflow-auto border-y"
      >
        <div
          style={{
            minWidth: `max(680px, calc(var(--shift-name-width) + ${Math.ceil(duration / 3_600_000) * 64 + 48}px))`,
          }}
        >
          <div className="sticky top-0 z-20 bg-background">
            <div className="flex h-10">
              <div className="shift-name sticky left-0 z-20 flex shrink-0 items-center bg-background px-3 text-xs text-muted-foreground">
                メンバー
              </div>
              <div className="relative mx-6 min-w-0 flex-1 text-xs text-muted-foreground">
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
            <div className="flex h-8">
              <div className="shift-name sticky left-0 z-20 flex shrink-0 items-center bg-background px-3 text-xs">
                必要人数
              </div>
              <div className="relative mx-6 min-w-0 flex-1">
                <TimeGuides scale={scale} />
                {plan.requirements.map((requirement) => (
                  <span
                    key={requirement.id}
                    aria-hidden="true"
                    style={scale.position(
                      requirement.startsAt,
                      requirement.endsAt
                    )}
                    className="pointer-events-none absolute inset-y-1.5 border-x border-border bg-muted/50"
                  />
                ))}
                {periods
                  .filter((period) => period.shortage)
                  .map((period) => (
                    <span
                      key={period.startsAt}
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-y-1.5 bg-destructive/10"
                      style={scale.position(period.startsAt, period.endsAt)}
                    />
                  ))}
                {plan.requirements.map((requirement) => (
                  <span
                    key={requirement.id}
                    style={scale.position(
                      requirement.startsAt,
                      requirement.endsAt
                    )}
                    className="pointer-events-none absolute inset-y-0 z-[3] flex items-center justify-center overflow-hidden text-xs tabular-nums"
                  >
                    {requirement.requiredCount}人
                  </span>
                ))}
                <input
                  type="range"
                  aria-label="配置人数を確認する時刻"
                  aria-valuetext={`${japanTime(selectedTime ?? start)}、配置${periods.find((period) => Date.parse(period.startsAt) <= (selectedTime ?? start) && (selectedTime ?? start) < Date.parse(period.endsAt))?.assigned ?? 0}人`}
                  min={start}
                  max={Math.max(start, Date.parse(plan.endsAt) - 60_000)}
                  step={60_000}
                  value={selectedTime ?? start}
                  data-selected={selectedTime !== null}
                  onFocus={() => {
                    if (selectedTime === null) setSelectedTime(start)
                  }}
                  onChange={(event) => {
                    setSelectedTime(event.currentTarget.valueAsNumber)
                    setCandidatesOnly(false)
                  }}
                  className="shift-staffing-cursor"
                />
              </div>
            </div>
          </div>
          {members.length === 0 && (
            <p className="py-10 text-sm text-muted-foreground">
              条件に合うメンバーがいません。
            </p>
          )}
          <div style={{ height: first * 56 }} />
          {visible.map((row) => (
            <TimeGridRow
              key={row.member.id}
              {...row}
              color={plan.color}
              scale={scale}
              selected={selection?.memberId === row.member.id}
              onSelect={onSelect}
              onCommit={onCommit}
              onMember={(memberId) => {
                if (candidatesOnly && periodDetail)
                  onSelect({
                    memberId,
                    slotId: null,
                    startsAt: periodDetail.startsAt,
                    endsAt: periodDetail.endsAt,
                  })
                else onMember(memberId)
              }}
            />
          ))}
          <div
            style={{
              height: Math.max(0, members.length - first - visible.length) * 56,
            }}
          />
        </div>
      </div>
    </div>
  )
}

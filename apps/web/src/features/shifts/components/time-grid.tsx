import { staffing } from "./staffing"
import "./time-grid.css"
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
  showAvailability,
  selection,
  onSelect,
  onCommit,
  onMember,
}: {
  data: EditorData
  plan: ActivityEditorInput
  role: string
  search: string
  showAvailability: boolean
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
  const lastFilter = useRef(`${search}|${role}`)
  useLayoutEffect(() => {
    const key = `${search}|${role}`
    if (lastFilter.current === key) return
    lastFilter.current = key
    if (viewport.current) viewport.current.scrollTop = 0
    view.save({ scrollTop: 0 })
    setScrollTop(0)
  }, [search, role, view])
  const scale = timeScale(plan.startsAt, plan.endsAt)
  const { start, duration, labels } = scale
  const periods = staffing(plan)
  const [selectedPeriod, setSelectedPeriod] = useState<string | null>(null)
  const [candidatesOnly, setCandidatesOnly] = useState(false)
  const periodDetail = periods.find(
    (period) => period.startsAt === selectedPeriod
  )
  const members = gridMembers(data, plan, { search, role }).filter((member) => {
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
        view.save({ scrollTop: top })
      }}
      className="shift-timeline min-h-0 max-w-full min-w-0 flex-1 overflow-auto border-y"
    >
      <div className="min-w-[680px]">
        <div className="sticky top-0 z-20 bg-background">
          <div className="flex h-9 pr-6">
            <div className="shift-name sticky left-0 z-20 flex shrink-0 items-center bg-background px-3 text-xs text-muted-foreground">
              メンバー
            </div>
            <div className="relative min-w-0 flex-1 border-b text-xs text-muted-foreground">
              {labels.map((hour) => (
                <span
                  key={hour}
                  className="shift-tick"
                  style={{ left: `${((hour - start) / duration) * 100}%` }}
                >
                  <span>{japanTime(hour)}</span>
                </span>
              ))}
            </div>
          </div>
          <div className="flex h-8 pr-6">
            <div className="shift-name sticky left-0 z-20 flex shrink-0 items-center bg-background px-3 text-xs">
              必要人数
            </div>
            <div className="relative min-w-0 flex-1">
              {plan.requirements.map((requirement) => (
                <span
                  key={requirement.id}
                  aria-hidden="true"
                  style={{
                    ...scale.position(requirement.startsAt, requirement.endsAt),
                    backgroundColor: `color-mix(in oklab, ${plan.color} 22%, var(--background))`,
                  }}
                  className="pointer-events-none absolute top-1.5 h-5 rounded"
                />
              ))}
              {periods
                .filter((period) => period.required !== null)
                .map((period) => (
                  <button
                    type="button"
                    key={period.startsAt}
                    onClick={() => {
                      setSelectedPeriod(period.startsAt)
                      setCandidatesOnly(false)
                    }}
                    aria-label={`${japanTime(period.startsAt)}–${japanTime(period.endsAt)}、必要${period.required ?? "未設定"}、配置${period.assigned}人、${period.required === null ? "未判定" : period.shortage ? "NG・不足" : "OK"}`}
                    title={`${japanTime(period.startsAt)}–${japanTime(period.endsAt)} 必要${period.required ?? "未設定"}・配置${period.assigned}人 ${period.required === null ? "未判定" : period.shortage ? "NG" : "OK"}`}
                    className={`absolute top-1.5 h-5 border-b-2 outline-offset-[-2px] hover:bg-foreground/5 focus-visible:outline-2 ${period.shortage ? "border-destructive" : "border-transparent"}`}
                    style={scale.position(period.startsAt, period.endsAt)}
                  >
                    <span className="sr-only">
                      {period.required ?? "未設定"}
                    </span>
                  </button>
                ))}
              {plan.requirements.map((requirement) => (
                <span
                  key={requirement.id}
                  style={scale.position(
                    requirement.startsAt,
                    requirement.endsAt
                  )}
                  className="pointer-events-none absolute top-1.5 flex h-5 items-center justify-center overflow-hidden rounded text-xs text-foreground tabular-nums"
                >
                  {requirement.requiredCount}人
                </span>
              ))}
            </div>
          </div>
        </div>
        {periodDetail && (
          <output className="sticky left-0 flex items-center gap-2 border-b bg-background px-3 py-2 text-xs">
            {japanTime(periodDetail.startsAt)}–{japanTime(periodDetail.endsAt)}{" "}
            必要{periodDetail.required ?? "未設定"}・配置{periodDetail.assigned}
            人{" "}
            {periodDetail.required === null
              ? "未判定"
              : periodDetail.shortage
                ? "NG・不足"
                : "OK"}
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
              onClick={() => {
                setSelectedPeriod(null)
                setCandidatesOnly(false)
              }}
              aria-label="人数の詳細を閉じる"
            >
              ×
            </button>
          </output>
        )}
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
            showAvailability={showAvailability}
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
  )
}

import type { FilterValue } from "@workspace/ui/lib/filters"
import { memberSelectionKeys } from "./assignment-removal"
import { AssignmentSelectAll } from "./assignment-selection"
import type { AssignmentSelection } from "./use-assignment-selection"
import { TimeGuides } from "./time-guides"
import { memberAvailability } from "./member-availability"
import { staffing } from "./staffing"
import { ShiftTimeline } from "./shift-timeline"
import { StaffingDetail } from "./staffing-detail"
import type { ShiftAnchor } from "./shift-anchor"
import { japanTime } from "@workspace/shared/japan-time"
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react"
import type { ShiftSelection } from "./shift-selection-panel"
import type { ActivityEditorInput, Attendance } from "@workspace/shared/shifts"
import type { AttendanceData } from "./attendance-data"
import type { EditorData } from "../editor-data"
import { TimeGridRow } from "./time-grid-row"
import { gridMembers, timeScale } from "./time-scale"

const emptyAttendance = new Map<string, Attendance>()

export const TimeGrid = memo(function TimeGrid({
  assignmentSelection,
  data,
  attendance,
  attendanceColors = false,
  plan,
  roles,
  search,
  availability,
  selection,
  onSelect,
  onCommit,
  onMember,
  onOther,
}: {
  assignmentSelection?: AssignmentSelection | undefined
  data: EditorData
  attendance?: AttendanceData["assignments"] | undefined
  attendanceColors?: boolean
  plan: ActivityEditorInput
  roles: FilterValue
  search: string
  availability: FilterValue
  selection: ShiftSelection | null
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
  const scale = useMemo(
    () => timeScale(plan.startsAt, plan.endsAt),
    [plan.startsAt, plan.endsAt]
  )
  const { start, duration, labels } = scale
  const periods = useMemo(() => staffing(plan), [plan])
  const detailAnchor = useRef<HTMLSpanElement>(null)
  const [selectedTime, setSelectedTime] = useState<number | null>(null)
  const [candidatesOnly, setCandidatesOnly] = useState(false)
  const periodIndex =
    selectedTime === null || assignmentSelection?.active
      ? -1
      : periods.findIndex(
          (period) =>
            Date.parse(period.startsAt) <= selectedTime &&
            selectedTime < Date.parse(period.endsAt)
        )
  const periodDetail = periods[periodIndex]
  function selectTime(time: number) {
    setSelectedTime(time)
    setCandidatesOnly(false)
  }
  function clearSelection() {
    setSelectedTime(null)
    setCandidatesOnly(false)
  }
  useEffect(() => {
    if (selectedTime === null) return undefined
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSelectedTime(null)
        setCandidatesOnly(false)
      }
    }
    window.addEventListener("keydown", escape)
    return () => window.removeEventListener("keydown", escape)
  }, [selectedTime])
  const showingCandidates =
    candidatesOnly && !!periodDetail?.shortage && !assignmentSelection?.active
  const members = useMemo(
    () =>
      gridMembers(data, plan, {
        search,
        roles,
        availability,
      }).filter((member) => {
        if (!showingCandidates || !periodDetail) return true
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
      }),
    [data, plan, search, roles, availability, showingCandidates, periodDetail]
  )
  const attendanceByMember = useMemo(() => {
    const records = new Map<string, Attendance>()
    for (const assignment of attendance ?? []) {
      if (assignment.active && assignment.attendance)
        records.set(
          `${assignment.memberId}:${Date.parse(assignment.startsAt)}:${Date.parse(assignment.endsAt)}`,
          assignment.attendance
        )
    }
    const result = new Map<string, Map<string, Attendance>>()
    for (const slot of data.slots) {
      for (const memberId of slot.memberIds) {
        const record = records.get(
          `${memberId}:${Date.parse(slot.startsAt)}:${Date.parse(slot.endsAt)}`
        )
        if (!record) continue
        const memberRecords =
          result.get(memberId) ?? new Map<string, Attendance>()
        memberRecords.set(slot.id, record)
        result.set(memberId, memberRecords)
      }
    }
    return result
  }, [data.slots, attendance])
  const visible = useMemo(() => {
    const duties = new Set(
      data.roles.filter((item) => item.duty).map((item) => item.id)
    )
    return members.map((member) => {
      const slots = plan.slots.filter((slot) =>
        slot.memberIds.includes(member.id)
      )
      return {
        member,
        attendance: attendanceByMember.get(member.id) ?? emptyAttendance,
        duties: member.roles
          .filter((item) => duties.has(item.id))
          .map((item) => item.name),
        status: memberAvailability(data, plan, member.id),
        availability: data.availability.filter(
          (window) => window.memberId === member.id
        ),
        otherAssignments: data.otherAssignments.filter(
          (assignment) => assignment.memberId === member.id
        ),
        slots,
      }
    })
  }, [members, data, plan, attendanceByMember])
  const selectMember = useCallback(
    (memberId: string, anchor: ShiftAnchor) => {
      if (showingCandidates && periodDetail)
        onSelect(
          {
            memberId,
            slotId: null,
            startsAt: periodDetail.startsAt,
            endsAt: periodDetail.endsAt,
          },
          anchor
        )
      else onMember(memberId, anchor)
    },
    [showingCandidates, periodDetail, onSelect, onMember]
  )
  return (
    <ShiftTimeline
      label="シフト配置時間軸"
      minWidth={`max(680px, calc(var(--shift-name-width) + ${Math.ceil(duration / 3_600_000) * 64 + 48}px))`}
      detail={
        periodDetail && (
          <StaffingDetail
            anchor={detailAnchor}
            period={periodDetail}
            previous={periods[periodIndex - 1]?.startsAt}
            next={periods[periodIndex + 1]?.startsAt}
            candidatesOnly={showingCandidates}
            onTime={selectTime}
            onCandidates={() => setCandidatesOnly(!showingCandidates)}
            onClose={clearSelection}
          />
        )
      }
      header={
        <>
          <div className="flex h-10">
            <div className="shift-name sticky left-0 z-20 flex shrink-0 items-center bg-background px-3 text-xs text-muted-foreground">
              {assignmentSelection && (
                <AssignmentSelectAll
                  selection={{
                    ...assignmentSelection,
                    available: members.flatMap((member) =>
                      memberSelectionKeys(
                        data.activity.id,
                        member.id,
                        plan.slots
                      )
                    ),
                  }}
                />
              )}
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
                  className="shift-requirement-label pointer-events-none absolute inset-y-0 z-[3] flex items-center justify-center overflow-hidden text-xs whitespace-nowrap tabular-nums"
                >
                  <span>{requirement.requiredCount}人</span>
                </span>
              ))}
              {periodDetail && (
                <span
                  ref={detailAnchor}
                  aria-hidden="true"
                  style={scale.position(
                    periodDetail.startsAt,
                    periodDetail.endsAt
                  )}
                  className="pointer-events-none absolute inset-y-0 min-w-px border-x-2 border-primary bg-primary/15"
                />
              )}
              <input
                type="range"
                disabled={assignmentSelection?.active}
                aria-label="配置人数を確認する時刻"
                aria-valuetext={`${japanTime(selectedTime ?? start)}、配置${periodDetail?.assigned ?? 0}人`}
                min={start}
                max={Math.max(start, Date.parse(plan.endsAt) - 60_000)}
                step={60_000}
                value={selectedTime ?? start}
                data-selected={!!periodDetail}
                onClick={(event) => {
                  if (selectedTime === null)
                    selectTime(event.currentTarget.valueAsNumber)
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault()
                    selectTime(event.currentTarget.valueAsNumber)
                  }
                }}
                onChange={(event) => {
                  selectTime(event.currentTarget.valueAsNumber)
                }}
                className="shift-staffing-cursor"
              />
            </div>
          </div>
        </>
      }
    >
      {members.length === 0 && (
        <p className="py-10 text-sm text-muted-foreground">
          条件に合うメンバーがいません。
        </p>
      )}
      {visible.map((row) => (
        <TimeGridRow
          key={row.member.id}
          activityId={data.activity.id}
          assignmentSelection={assignmentSelection}
          {...row}
          color={plan.color}
          attendanceColors={attendanceColors}
          scale={scale}
          selected={selection?.memberId === row.member.id}
          onSelect={onSelect}
          onCommit={onCommit}
          onMember={selectMember}
          onOther={onOther}
        />
      ))}
    </ShiftTimeline>
  )
})

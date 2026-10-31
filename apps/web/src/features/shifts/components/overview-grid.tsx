import { memo } from "react"
import {
  clickAnchor,
  elementAnchor,
  shiftBarStyle,
  type ShiftAnchor,
} from "./shift-anchor"
import {
  AssignmentRowCheckbox,
  AssignmentSelectAll,
} from "./assignment-selection"
import { assignmentKey, overviewMemberKeys } from "./assignment-removal"
import type { AssignmentSelection } from "./use-assignment-selection"
import { ShiftMemberLabel } from "./shift-member-label"
import { TimeGuides } from "./time-guides"
import { ShiftTimeline } from "./shift-timeline"
import type { ShiftOverview } from "@workspace/shared/shifts"
import { japanTime } from "@workspace/shared/japan-time"
import { MemberAvatar } from "@/features/members/components/member-avatar"
import { timeScale } from "./time-scale"
import {
  overviewAttendance,
  overviewRange,
  type OverviewSelection,
  type overviewRows,
} from "./overview-model"

export const OverviewGrid = memo(function OverviewGrid({
  attendanceColors = false,
  assignmentSelection,
  data,
  date,
  rows,
  now,
  onSelect,
  onInspect,
  printing = false,
}: {
  attendanceColors?: boolean
  assignmentSelection?: AssignmentSelection | undefined
  printing?: boolean
  data: ShiftOverview
  date: string
  rows: ReturnType<typeof overviewRows>
  now: number
  onSelect: (s: OverviewSelection, anchor: ShiftAnchor) => void
  onInspect: (activityId: string) => void
}) {
  const { start, end } = overviewRange(data, date)
  const scale = timeScale(
    new Date(start).toISOString(),
    new Date(end).toISOString()
  )
  const marks = Array.from(
    { length: Math.round((end - start) / 1_800_000) + 1 },
    (_, i) => start + i * 1_800_000
  )
  const position = scale.position
  const lateCount = rows
    .flatMap((row) => row.assignments)
    .filter((assignment) => assignment.attendance?.state === "late").length
  const duties = new Set(
    data.roles.filter((role) => role.duty).map((role) => role.id)
  )
  const activities = new Map(data.activities.map((a) => [a.id, a]))
  return (
    <ShiftTimeline
      label="全体シフト時間軸"
      minWidth={`max(680px, calc(var(--shift-name-width) + ${Math.ceil((end - start) / 3_600_000) * 64 + 48}px))`}
      header={
        <div className="flex h-10 bg-background text-xs text-muted-foreground">
          <div className="shift-name sticky left-0 z-20 flex shrink-0 items-center bg-background px-3">
            {assignmentSelection ? (
              <>
                <AssignmentSelectAll selection={assignmentSelection} />
                <span className="leading-4">
                  <span className="block tabular-nums">
                    メンバー {rows.length}人
                  </span>
                  <span
                    className="block text-[11px] tabular-nums"
                    title="表示中の勤務で遅刻として記録された件数"
                  >
                    遅刻 {lateCount}件
                  </span>
                </span>
              </>
            ) : (
              <>
                メンバー{" "}
                <span className="ml-2 tabular-nums">{rows.length}人</span>
                <span
                  className="ml-2 tabular-nums"
                  title="表示中の勤務で遅刻として記録された件数"
                >
                  遅刻 {lateCount}件
                </span>
              </>
            )}
          </div>
          <div className="relative mx-6 flex-1">
            {marks
              .filter((t, i) => i % 2 === 0 || t === end)
              .map((t) => (
                <span
                  key={t}
                  className="absolute top-3 -translate-x-1/2 tabular-nums"
                  style={{ left: `${((t - start) / (end - start)) * 100}%` }}
                >
                  {t === Date.parse(`${date}T00:00:00+09:00`) + 86_400_000
                    ? "24:00"
                    : japanTime(new Date(t).toISOString())}
                </span>
              ))}
          </div>
          {printing && (
            <div className="overview-writing flex shrink-0 items-center justify-center border-l">
              記録・修正
            </div>
          )}
        </div>
      }
    >
      {rows.map(({ member, assignments }) => (
        <div
          key={member.id}
          className="shift-timeline-row overview-row flex h-14 border-t border-border/70 bg-background"
        >
          <div className="shift-name sticky left-0 z-10 flex shrink-0 items-center gap-2 bg-background px-2 text-sm sm:px-3">
            {assignmentSelection && (
              <AssignmentRowCheckbox
                selection={assignmentSelection}
                keys={overviewMemberKeys(member.id, assignments)}
                name={member.displayName}
              />
            )}
            <button
              type="button"
              className="flex min-w-0 flex-1 items-center gap-2 text-left"
              aria-label={`${member.displayName}のシフトを確認`}
              disabled={assignmentSelection?.active}
              onClick={(event) => {
                const assignment = assignments[0]
                if (!data.canEdit) {
                  if (assignment) onInspect(assignment.activityId)
                  return
                }
                onSelect(
                  {
                    memberId: member.id,
                    activityId: assignment?.activityId ?? "",
                    slotId: assignment?.slotId ?? null,
                    startsAt:
                      assignment?.startsAt ?? new Date(start).toISOString(),
                    endsAt:
                      assignment?.endsAt ??
                      new Date(Math.min(end, start + 3_600_000)).toISOString(),
                  },
                  elementAnchor(event.currentTarget)
                )
              }}
            >
              <MemberAvatar
                name={member.displayName}
                image={member.image}
                className={`size-6 text-[10px] ${assignmentSelection ? "hidden sm:flex" : ""}`}
              />
              <ShiftMemberLabel
                name={member.displayName}
                studentId={member.studentId}
                duties={member.roles
                  .filter((role) => duties.has(role.id))
                  .map((role) => role.name)}
              />
            </button>
          </div>
          <div data-selection-surface className="relative mx-6 min-w-0 flex-1">
            <TimeGuides scale={scale} stepMinutes={30} />
            {data.availability
              .filter((w) => w.memberId === member.id)
              .map((w) => (
                <span
                  key={`${w.startsAt}-${w.endsAt}`}
                  title={`希望 ${japanTime(w.startsAt)}–${japanTime(w.endsAt)}`}
                  className="pointer-events-none absolute top-[9px] h-9 rounded-sm bg-muted"
                  style={position(w.startsAt, w.endsAt)}
                />
              ))}
            {data.canEdit && !assignmentSelection?.active && (
              <button
                className="absolute inset-0 focus-visible:outline-2 focus-visible:outline-ring"
                aria-label={`${member.displayName}に勤務を追加`}
                onClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect()
                  const t =
                    e.detail === 0
                      ? start
                      : Math.min(
                          end - 60_000,
                          start +
                            Math.round(
                              (((e.clientX - rect.left) / rect.width) *
                                (end - start)) /
                                60_000
                            ) *
                              60_000
                        )
                  onSelect(
                    {
                      memberId: member.id,
                      activityId: "",
                      slotId: null,
                      startsAt: new Date(t).toISOString(),
                      endsAt: new Date(
                        Math.min(end, t + 3_600_000)
                      ).toISOString(),
                    },
                    clickAnchor(e)
                  )
                }}
              />
            )}
            {assignments.map((a) => {
              const activity = activities.get(a.activityId)
              const label = overviewAttendance(a)
              const key = assignmentKey(a)
              const color = attendanceColors
                ? {
                    late: "#D97706",
                    absent: "#DC2626",
                    present: "#16A34A",
                    unrecorded: "#64748B",
                  }[a.attendance?.state ?? "unrecorded"]
                : (activity?.color ?? "#64748B")
              return (
                <button
                  key={a.id}
                  type="button"
                  data-assignment-key={key}
                  aria-pressed={
                    assignmentSelection?.active
                      ? assignmentSelection.keys.includes(key)
                      : undefined
                  }
                  className="absolute inset-y-0 z-[2] text-left focus-visible:outline-2 focus-visible:outline-ring"
                  style={position(a.startsAt, a.endsAt)}
                  title={`${activity?.name} ${japanTime(a.startsAt)}–${japanTime(a.endsAt)} / ${label}`}
                  aria-label={`${member.displayName} ${activity?.name} ${japanTime(a.startsAt)}–${japanTime(a.endsAt)} ${label}`}
                  onClick={(event) =>
                    assignmentSelection?.active
                      ? assignmentSelection.toggle(key)
                      : data.canEdit
                        ? onSelect(
                            {
                              memberId: member.id,
                              activityId: a.activityId,
                              slotId: a.slotId,
                              startsAt: a.startsAt,
                              endsAt: a.endsAt,
                            },
                            clickAnchor(event, event.currentTarget)
                          )
                        : onInspect(a.activityId)
                  }
                >
                  <span
                    data-shift-bar
                    className="absolute inset-x-0 truncate rounded px-[9px] text-xs leading-[17px] text-foreground tabular-nums"
                    style={{
                      ...shiftBarStyle,
                      backgroundColor: `color-mix(in oklab, ${color} ${assignmentSelection?.keys.includes(key) ? 60 : attendanceColors ? 30 : 22}%, var(--background))`,
                    }}
                  >
                    {activity?.name}
                    {activity?.active === false ? "（無効）" : ""}{" "}
                    {japanTime(a.startsAt)}〜{japanTime(a.endsAt)}
                  </span>
                </button>
              )
            })}
            {now >= start && now < end && (
              <span
                aria-label="現在時刻"
                className="pointer-events-none absolute inset-y-0 z-10 border-l border-blue-500"
                style={{ left: `${((now - start) / (end - start)) * 100}%` }}
              />
            )}
          </div>
          {printing && (
            <div
              className="overview-writing shrink-0 border-l"
              aria-label={`${member.displayName}の手書き欄`}
            />
          )}
        </div>
      ))}
    </ShiftTimeline>
  )
})

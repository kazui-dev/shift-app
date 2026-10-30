import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import {
  Check,
  Circle,
  CircleHelp,
  Clock3,
  LoaderCircle,
  X,
} from "lucide-react"

import type { ShiftCoworker } from "@workspace/shared/shifts"
import { japanTime } from "@workspace/shared/japan-time"
import { Button } from "@workspace/ui/components/button"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@workspace/ui/components/tooltip"
import { cn } from "@workspace/ui/lib/utils"
import {
  shiftCoworkersQuery,
  type CalendarAssignment,
} from "@/features/shifts/api/assignments"

export function LiveShiftCoworkers({
  assignment,
  now,
  offline,
}: {
  assignment: CalendarAssignment
  now: number
  offline: boolean
}) {
  const query = useQuery({
    ...shiftCoworkersQuery(assignment.activityId, assignment.id),
    enabled: !offline,
  })
  if (offline)
    return (
      <p className="py-12 text-center text-sm text-muted-foreground">
        オンラインで確認してください。
      </p>
    )
  if (query.isError)
    return (
      <div role="alert" className="space-y-3 py-12 text-center text-sm">
        <p>シフトメンバーを読み込めませんでした。</p>
        <Button
          variant="outline"
          size="sm"
          onClick={() => void query.refetch()}
        >
          再読み込み
        </Button>
      </div>
    )
  if (!query.data)
    return (
      <output className="flex justify-center py-12">
        <LoaderCircle className="size-5 animate-spin" aria-hidden="true" />
        <span className="sr-only">シフトメンバーを読み込み中</span>
      </output>
    )
  return (
    <ShiftCoworkers
      assignment={assignment}
      members={query.data.members}
      now={now}
    />
  )
}

function AttendanceIcon({ member }: { member: ShiftCoworker }) {
  const [open, setOpen] = useState(false)
  const attendance = member.attendance
  const status =
    attendance?.state === "present"
      ? attendance.checkInStatus === "confirmed"
        ? {
            Icon: Check,
            label: "出勤済み",
            tone: "text-green-700 dark:text-green-400",
          }
        : {
            Icon: CircleHelp,
            label: "出勤確認待ち",
            tone: "text-muted-foreground",
          }
      : attendance?.state === "late"
        ? {
            Icon: Clock3,
            label: attendance.expectedAt
              ? `遅刻・${japanTime(attendance.expectedAt)}到着予定`
              : "遅刻",
            tone: "text-amber-700 dark:text-amber-400",
          }
        : attendance?.state === "absent"
          ? { Icon: X, label: "欠勤", tone: "text-red-700 dark:text-red-400" }
          : {
              Icon: Circle,
              label: "出勤記録なし",
              tone: "text-muted-foreground",
            }

  return (
    <Tooltip open={open} onOpenChange={setOpen}>
      <TooltipTrigger
        render={<Button type="button" variant="ghost" size="icon" />}
        className={cn("size-9 shrink-0", status.tone)}
        aria-label={`${member.name}：${status.label}`}
        onClick={() => setOpen(true)}
      >
        <status.Icon aria-hidden="true" className="size-4" />
      </TooltipTrigger>
      <TooltipContent>{status.label}</TooltipContent>
    </Tooltip>
  )
}

export function ShiftCoworkers({
  assignment,
  members,
  now,
}: {
  assignment: CalendarAssignment
  members: readonly ShiftCoworker[]
  now: number
}) {
  // Freeze the ordering for this visit so a time boundary cannot move a row
  // while someone is reading it. Reopening the list uses the current time.
  const [openedAt] = useState(now)
  const overlapping = members
    .filter(
      (member) =>
        member.activityId === assignment.activityId &&
        member.memberId !== assignment.memberId &&
        Date.parse(member.startsAt) < Date.parse(assignment.endsAt) &&
        Date.parse(member.endsAt) > Date.parse(assignment.startsAt)
    )
    .toSorted(
      (a, b) =>
        Date.parse(a.startsAt) - Date.parse(b.startsAt) ||
        Date.parse(a.endsAt) - Date.parse(b.endsAt) ||
        a.studentId.localeCompare(b.studentId) ||
        a.id.localeCompare(b.id)
    )
  const groups = [
    {
      title: "現在の勤務予定",
      current: true,
      rows: overlapping.filter(
        (member) =>
          Date.parse(member.startsAt) <= openedAt &&
          openedAt < Date.parse(member.endsAt)
      ),
    },
    {
      title: "勤務開始前",
      current: false,
      rows: overlapping.filter(
        (member) => openedAt < Date.parse(member.startsAt)
      ),
    },
    {
      title: "勤務時間終了",
      current: false,
      rows: overlapping.filter(
        (member) => Date.parse(member.endsAt) <= openedAt
      ),
    },
  ]

  return (
    <TooltipProvider>
      <div className="space-y-5">
        {overlapping.length === 0 && (
          <p className="py-12 text-center text-sm text-muted-foreground">
            時間が重なるメンバーはいません。
          </p>
        )}
        {groups.map(
          (group) =>
            group.rows.length > 0 && (
              <section key={group.title} aria-label={group.title}>
                <h3 className="mb-2 flex items-center gap-2 px-1 text-xs font-medium text-muted-foreground">
                  <span
                    className={cn(
                      group.current && "font-semibold text-foreground"
                    )}
                  >
                    {group.title}
                  </span>
                  <span className="tabular-nums">
                    {new Set(group.rows.map((member) => member.memberId)).size}
                    人
                  </span>
                  {group.current && (
                    <span className="ml-auto tabular-nums">
                      {japanTime(new Date(openedAt).toISOString())}時点
                    </span>
                  )}
                </h3>
                <ul
                  className={cn(
                    "divide-y overflow-hidden rounded-lg border",
                    group.current && "border-blue-200 dark:border-blue-900"
                  )}
                >
                  {group.rows.map((member) => (
                    <li
                      key={member.id}
                      className={cn(
                        "flex min-h-12 items-center gap-1 pr-3 pl-1 sm:gap-2",
                        member.attendance?.state === "present" &&
                          member.attendance.checkInStatus === "confirmed" &&
                          "bg-green-50 dark:bg-green-950/40",
                        member.attendance?.state === "late" &&
                          "bg-amber-50 dark:bg-amber-950/40",
                        member.attendance?.state === "absent" &&
                          "bg-red-50 dark:bg-red-950/40"
                      )}
                    >
                      <AttendanceIcon member={member} />
                      <div className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-2 gap-y-0.5 py-2">
                        <span className="text-sm font-medium [overflow-wrap:anywhere] break-words">
                          {member.name}
                        </span>
                        <span className="text-xs whitespace-nowrap text-muted-foreground tabular-nums">
                          {member.studentId}
                        </span>
                      </div>
                      <span className="shrink-0 text-sm whitespace-nowrap tabular-nums">
                        {japanTime(member.startsAt)}〜{japanTime(member.endsAt)}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            )
        )}
      </div>
    </TooltipProvider>
  )
}

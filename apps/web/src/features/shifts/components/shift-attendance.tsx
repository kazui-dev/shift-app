import { attendanceQuery } from "@/features/shifts/data/attendance"
import { LoadingState } from "@/app/page-layout"
import type { AttendanceData } from "./attendance-data"
import { AttendanceCorrection } from "./attendance-correction"
import { AttendanceHistory } from "./attendance-history"
import { keys } from "@/app/data/keys"
import { japanTime } from "@workspace/shared/japan-time"
import { useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Button } from "@workspace/ui/components/button"
import { toast } from "@workspace/ui/lib/toast"
import { manageAttendance } from "@/features/shifts/api/assignments"
import { errorMessage } from "@/lib/http/client"
import { ResponsiveDialog } from "@/components/responsive-overlay"
import { FilterMenu } from "@workspace/ui/components/filter-menu"
import { emptyFilter, matchesFilter } from "@workspace/ui/lib/filters"
import { cn } from "@workspace/ui/lib/utils"
import {
  useViewPreference,
  filterPreferenceSchema,
} from "@/lib/view-preferences"

type Assignment = AttendanceData["assignments"][number]

/** One assignment's attendance as a short line. */
function attendanceSummary(assignment: Assignment) {
  const attendance = assignment.attendance
  switch (attendance?.state) {
    case "present":
      return attendance.checkedInAt
        ? `${japanTime(attendance.checkedInAt)} 出勤${attendance.checkInStatus === "pending" ? "（確認待ち）" : ""}`
        : "出勤"
    case "late":
      return `遅刻${attendance.expectedAt ? `・${japanTime(attendance.expectedAt)}ごろ到着予定` : "・到着時刻は未定"}${attendance.resolvedAt ? "（対応済み）" : ""}`
    case "absent":
      return `欠勤${attendance.resolvedAt ? "（対応済み）" : ""}`
    default:
      return "出勤記録なし"
  }
}

export function ShiftAttendance({
  activityId,
  onClose,
}: {
  activityId: string
  onClose: () => void
}) {
  const client = useQueryClient()
  const query = useQuery(attendanceQuery(activityId))
  const [correcting, setCorrecting] = useState<Assignment | null>(null)
  const [history, setHistory] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [filter, setFilter] = useViewPreference(
    `attendance:${activityId}`,
    filterPreferenceSchema,
    emptyFilter()
  )
  async function run(work: () => Promise<unknown>) {
    setPending(true)
    try {
      await work()
      await Promise.all([
        client.invalidateQueries({
          queryKey: keys.shiftAttendance(activityId),
        }),
        client.invalidateQueries({ queryKey: keys.assignments() }),
        client.invalidateQueries({ queryKey: keys.attendanceEvents() }),
      ])
      setCorrecting(null)
    } catch (error) {
      toast.error(errorMessage(error))
    } finally {
      setPending(false)
    }
  }
  const data = query.data
  const assignments =
    data?.assignments.filter((a) => a.active || a.attendance) ?? []
  const visible = assignments.filter((a) =>
    matchesFilter(
      [
        a.attendance?.state === "present"
          ? a.attendance.checkInStatus === "pending"
            ? "pending"
            : "present"
          : (a.attendance?.state ?? "none"),
      ],
      filter
    )
  )
  return (
    <ResponsiveDialog
      open
      title="勤怠"
      className="sm:max-w-5xl"
      headerActions={
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground">
            {visible.length} / {assignments.length}件
          </span>
          <FilterMenu
            label="勤怠"
            optionsReady
            searchable={false}
            allowExclusion={false}
            value={filter}
            onChange={setFilter}
            options={[
              { value: "late", label: "遅刻" },
              { value: "absent", label: "欠勤" },
              { value: "present", label: "出勤済み" },
              { value: "pending", label: "出勤確認待ち" },
              { value: "none", label: "出勤記録なし" },
            ]}
          />
        </div>
      }
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      {query.isPending && <LoadingState />}
      {query.isError && (
        <p role="alert" className="py-4 text-sm">
          勤怠を読み込めませんでした。
          <Button
            variant="outline"
            size="sm"
            onClick={() => void query.refetch()}
          >
            再読み込み
          </Button>
        </p>
      )}
      {data && visible.length === 0 && (
        <p className="py-4 text-sm text-muted-foreground">
          該当する勤怠はありません。
        </p>
      )}
      <ul className="divide-y">
        {visible.map((a) => {
          const standing =
            a.attendance?.state === "late" || a.attendance?.state === "absent"
          return (
            <li
              className={cn(
                "grid gap-3 px-3 py-4 sm:grid-cols-[minmax(0,1fr)_auto]",
                a.attendance?.state === "late" &&
                  "bg-amber-50 dark:bg-amber-950",
                a.attendance?.state === "absent" && "bg-red-50 dark:bg-red-950"
              )}
              key={a.id}
            >
              <div className="min-w-0">
                <p className="flex flex-wrap items-baseline gap-x-2 text-sm">
                  <span>{a.memberDisplayName}</span>
                  {(a.memberStudentId || (a.memberDuties?.length ?? 0) > 0) && (
                    <span
                      className={cn(
                        "text-xs",
                        standing ? "text-foreground" : "text-muted-foreground"
                      )}
                    >
                      {[a.memberStudentId, ...(a.memberDuties ?? [])]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  )}
                </p>
                <p
                  className={cn(
                    "text-xs",
                    standing ? "text-foreground" : "text-muted-foreground"
                  )}
                >
                  {japanTime(a.startsAt)}〜{japanTime(a.endsAt)} ·{" "}
                  {attendanceSummary(a)}
                </p>
                {standing && a.attendance?.reason && (
                  <p className="mt-2 text-sm break-words whitespace-pre-wrap">
                    {a.attendance.reason}
                  </p>
                )}
              </div>
              <div className="flex flex-wrap items-start gap-2">
                {data?.canManage && standing && !a.attendance?.resolvedAt && (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={pending}
                    onClick={() =>
                      void run(() =>
                        manageAttendance(a.id, { action: "resolve" })
                      )
                    }
                  >
                    対応済みにする
                  </Button>
                )}
                {data?.canManage && !standing && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setCorrecting(a)}
                  >
                    {a.attendance?.checkInStatus === "pending"
                      ? "出勤を確認"
                      : "出勤を修正"}
                  </Button>
                )}
                {(a.own || data?.canManage) && a.attendance && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setHistory(a.id)}
                  >
                    履歴
                  </Button>
                )}
              </div>
            </li>
          )
        })}
      </ul>
      {correcting && (
        <AttendanceCorrection
          assignment={correcting}
          pending={pending}
          onCancel={() => setCorrecting(null)}
          onSubmit={(at, reason) =>
            void run(() =>
              manageAttendance(correcting.id, {
                action: "correct",
                checkedInAt: at,
                reason,
              })
            )
          }
        />
      )}
      {history && (
        <AttendanceHistory id={history} onClose={() => setHistory(null)} />
      )}
    </ResponsiveDialog>
  )
}

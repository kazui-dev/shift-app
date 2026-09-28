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
  return (
    <ResponsiveDialog
      open
      title="勤怠"
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      {query.isPending && <LoadingState />}
      <ul className="divide-y">
        {data?.assignments
          .filter((a) => a.active || a.attendance)
          .map((a) => {
            const standing =
              a.attendance?.state === "late" || a.attendance?.state === "absent"
            return (
              <li className="space-y-2 py-3" key={a.id}>
                <div>
                  <p className="text-sm">{a.memberDisplayName}</p>
                  <p className="text-xs text-muted-foreground">
                    {japanTime(a.startsAt)}〜{japanTime(a.endsAt)} ·{" "}
                    {attendanceSummary(a)}
                  </p>
                  {standing && a.attendance?.reason && (
                    <p className="mt-1 text-sm whitespace-pre-wrap">
                      {a.attendance.reason}
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap gap-1">
                  {data.canManage && standing && !a.attendance?.resolvedAt && (
                    <Button
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
                  {data.canManage && !standing && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setCorrecting(a)}
                    >
                      {a.attendance?.checkInStatus === "pending"
                        ? "出勤を確認"
                        : "出勤を修正"}
                    </Button>
                  )}
                  {(a.own || data.canManage) && a.attendance && (
                    <Button
                      size="sm"
                      variant="ghost"
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

import { attendanceQuery } from "@/data/attendance"
import { LoadingState } from "@/components/page-layout"
import type { AttendanceData } from "./attendance-data"
import { AttendanceCorrection } from "./attendance-correction"
import { AttendanceHistory, ReportHistory } from "./attendance-history"
import { ReportForm } from "./attendance-report-form"
import { keys } from "@/data/keys"
import { japanTime } from "@workspace/shared/japan-time"
import { useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Button } from "@workspace/ui/components/button"
import { toast } from "@workspace/ui/lib/toast"
import {
  correctAttendance,
  submitAssignmentReport,
  updateReportState,
} from "@/api/assignments"
import { errorMessage } from "@/api/client"
import { ResponsiveDialog } from "@/components/responsive-overlay"

export function ShiftAttendance({
  activityId,
  selectedAssignment,
  onClose,
}: {
  activityId: string
  selectedAssignment?: string | undefined
  onClose: () => void
}) {
  const client = useQueryClient()
  const query = useQuery({
    ...attendanceQuery(activityId),
    refetchInterval: 30000,
  })
  const [editing, setEditing] = useState<string | null>(
    selectedAssignment ?? null
  )
  const [correcting, setCorrecting] = useState<
    AttendanceData["assignments"][number] | null
  >(null)
  const [attendanceHistory, setAttendanceHistory] = useState<string | null>(
    null
  )
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
        client.invalidateQueries({ queryKey: keys.reportEvents() }),
      ])
      setEditing(null)
      setCorrecting(null)
    } catch (error) {
      toast.error(errorMessage(error))
    } finally {
      setPending(false)
    }
  }
  const data = query.data
  const target = data?.assignments.find(
    (a) => a.id === editing && a.own && a.active
  )
  const report = data?.reports.find((r) => r.assignmentId === target?.id)
  return (
    <ResponsiveDialog
      open
      title="出勤・連絡"
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      {query.isPending && <LoadingState />}
      {target ? (
        <ReportForm
          key={target.id}
          pending={pending}
          report={report}
          onCancel={() => setEditing(null)}
          onSubmit={(input) =>
            void run(() => submitAssignmentReport(target.id, input))
          }
        />
      ) : (
        <div className="space-y-6">
          <ul className="divide-y">
            {data?.reports.map((r) => (
              <li className="space-y-2 py-3" key={r.id}>
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium">
                    {r.memberDisplayName} ·{" "}
                    {r.kind === "late" ? "遅刻" : "欠勤"}
                  </p>
                  <span className="text-xs text-muted-foreground">
                    {r.status === "open"
                      ? "未確認"
                      : r.status === "resolved"
                        ? "確認済み"
                        : "取り消し済み"}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {japanTime(r.startsAt)}–{japanTime(r.endsAt)}
                  {r.kind === "late" &&
                    ` · 到着${r.eta ? japanTime(r.eta) : "未定"}`}
                </p>
                <p className="text-sm whitespace-pre-wrap">{r.message}</p>
                <div className="flex flex-wrap gap-1">
                  {data.canManage && r.status === "open" && (
                    <Button
                      size="sm"
                      disabled={pending}
                      onClick={() =>
                        void run(() =>
                          updateReportState(r.id, "resolved", r.updatedAt)
                        )
                      }
                    >
                      確認
                    </Button>
                  )}
                  {data.assignments.some(
                    (a) => a.id === r.assignmentId && a.own
                  ) &&
                    r.status !== "withdrawn" && (
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={pending}
                          onClick={() => setEditing(r.assignmentId)}
                        >
                          修正
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={pending}
                          onClick={() =>
                            void run(() =>
                              updateReportState(r.id, "withdrawn", r.updatedAt)
                            )
                          }
                        >
                          取り消し
                        </Button>
                      </>
                    )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setHistory(r.id)}
                  >
                    履歴
                  </Button>
                </div>
              </li>
            ))}
          </ul>
          <ul className="divide-y">
            {data?.assignments
              .filter((a) => a.active || a.checkedInAt)
              .map((a) => (
                <li
                  className="flex items-center justify-between gap-2 py-3"
                  key={a.id}
                >
                  <div>
                    <p className="text-sm">{a.memberDisplayName}</p>
                    <p className="text-xs text-muted-foreground">
                      {japanTime(a.startsAt)}–{japanTime(a.endsAt)} ·{" "}
                      {a.checkedInAt
                        ? `${japanTime(a.checkedInAt)} 出勤${a.attendanceStatus === "pending" ? "（確認待ち）" : ""}`
                        : "出勤記録なし"}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    {a.own && a.active && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setEditing(a.id)}
                      >
                        連絡
                      </Button>
                    )}
                    {(a.own || data.canManage) && a.checkedInAt && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setAttendanceHistory(a.id)}
                      >
                        履歴
                      </Button>
                    )}
                    {data.canManage && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setCorrecting(a)}
                      >
                        {a.attendanceStatus === "pending"
                          ? "出勤を確認"
                          : "出勤を修正"}
                      </Button>
                    )}
                  </div>
                </li>
              ))}
          </ul>
        </div>
      )}
      {correcting && (
        <AttendanceCorrection
          assignment={correcting}
          pending={pending}
          onCancel={() => setCorrecting(null)}
          onSubmit={(at, reason) =>
            void run(() => correctAttendance(correcting.id, at, reason))
          }
        />
      )}
      {attendanceHistory && (
        <AttendanceHistory
          id={attendanceHistory}
          onClose={() => setAttendanceHistory(null)}
        />
      )}
      {history && (
        <ReportHistory id={history} onClose={() => setHistory(null)} />
      )}
    </ResponsiveDialog>
  )
}

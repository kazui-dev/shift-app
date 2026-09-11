import { useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Textarea } from "@workspace/ui/components/textarea"
import { toast } from "@workspace/ui/lib/toast"
import {
  getAttendanceEvents,
  correctAttendance,
  getReportEvents,
  getShiftAttendance,
  submitAssignmentReport,
  updateReportState,
} from "@/api/assignments"
import { errorMessage } from "@/api/client"
import { ResponsiveDialog } from "@/components/responsive-overlay"
import { japanDateTime, japanLocalDateTime } from "@/lib/japan-time"
import { timeLabel } from "./time-label"

type Data = Awaited<ReturnType<typeof getShiftAttendance>>
function local(value: string) {
  const d = japanDateTime(value)
  return `${d.date}T${String(d.hour).padStart(2, "0")}:${String(d.minute).padStart(2, "0")}`
}
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
    queryKey: ["shift-attendance", activityId],
    queryFn: () => getShiftAttendance(activityId),
    refetchInterval: 30000,
  })
  const [editing, setEditing] = useState<string | null>(
    selectedAssignment ?? null
  )
  const [correcting, setCorrecting] = useState<
    Data["assignments"][number] | null
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
          queryKey: ["shift-attendance", activityId],
        }),
        client.invalidateQueries({ queryKey: ["assignments"] }),
        client.invalidateQueries({ queryKey: ["attendance-events"] }),
        client.invalidateQueries({ queryKey: ["report-events"] }),
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
      {query.isPending && (
        <p className="text-sm text-muted-foreground">読み込み中…</p>
      )}
      {query.error && <p role="alert">{errorMessage(query.error)}</p>}
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
                  {timeLabel(r.startsAt)}–{timeLabel(r.endsAt)}
                  {r.kind === "late" &&
                    ` · 到着${r.eta ? timeLabel(r.eta) : "未定"}`}
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
                      {timeLabel(a.startsAt)}–{timeLabel(a.endsAt)} ·{" "}
                      {a.checkedInAt
                        ? `${timeLabel(a.checkedInAt)} 出勤${a.attendanceStatus === "pending" ? "（確認待ち）" : ""}`
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
function ReportForm({
  report,
  pending,
  onSubmit,
  onCancel,
}: {
  report?: Data["reports"][number] | undefined
  pending: boolean
  onSubmit: (input: {
    kind: "late" | "absence"
    message: string
    eta: string | null
  }) => void
  onCancel: () => void
}) {
  const [kind, setKind] = useState<"late" | "absence">(report?.kind ?? "late")
  const [message, setMessage] = useState(report?.message ?? "")
  const [eta, setEta] = useState(report?.eta ? local(report.eta) : "")
  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault()
        onSubmit({
          kind,
          message,
          eta:
            kind === "late" && eta
              ? new Date(japanLocalDateTime(eta)).toISOString()
              : null,
        })
      }}
    >
      <div className="flex gap-2">
        {(["late", "absence"] as const).map((k) => (
          <Button
            key={k}
            type="button"
            variant={kind === k ? "default" : "outline"}
            onClick={() => setKind(k)}
          >
            {k === "late" ? "遅刻" : "欠勤"}
          </Button>
        ))}
      </div>
      {kind === "late" && (
        <label htmlFor="report-eta" className="block space-y-2 text-sm">
          到着見込み（未定なら空欄）
          <Input
            id="report-eta"
            type="datetime-local"
            value={eta}
            onChange={(e) => setEta(e.target.value)}
          />
        </label>
      )}
      <label htmlFor="report-message" className="block space-y-2 text-sm">
        理由
        <Textarea
          id="report-message"
          required
          maxLength={1000}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        />
      </label>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onCancel}>
          戻る
        </Button>
        <Button disabled={pending || !message.trim()}>送信</Button>
      </div>
    </form>
  )
}
function AttendanceCorrection({
  assignment,
  pending,
  onSubmit,
  onCancel,
}: {
  assignment: Data["assignments"][number]
  pending: boolean
  onSubmit: (at: string, reason: string) => void
  onCancel: () => void
}) {
  const [at, setAt] = useState(
    local(assignment.checkedInAt ?? new Date().toISOString())
  )
  const [reason, setReason] = useState("")
  return (
    <ResponsiveDialog
      open
      title="出勤を確認・修正"
      onOpenChange={(open) => {
        if (!open) onCancel()
      }}
    >
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault()
          onSubmit(new Date(japanLocalDateTime(at)).toISOString(), reason)
        }}
      >
        <label htmlFor="attendance-time" className="block space-y-2 text-sm">
          出勤時刻
          <Input
            id="attendance-time"
            type="datetime-local"
            required
            value={at}
            onChange={(e) => setAt(e.target.value)}
          />
        </label>
        <label htmlFor="attendance-reason" className="block space-y-2 text-sm">
          確認・修正の理由
          <Textarea
            id="attendance-reason"
            required
            maxLength={1000}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </label>
        <Button disabled={pending || !reason.trim()}>記録</Button>
      </form>
    </ResponsiveDialog>
  )
}
function ReportHistory({ id, onClose }: { id: string; onClose: () => void }) {
  const query = useQuery({
    queryKey: ["report-events", id],
    queryFn: () => getReportEvents(id),
  })
  return (
    <ResponsiveDialog
      open
      title="連絡の履歴"
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <ul className="space-y-4">
        {query.data?.events.map((e) => (
          <li key={e.id} className="text-sm">
            <p>
              {e.actor} ·{" "}
              {e.action === "submitted"
                ? "送信・修正"
                : e.action === "resolved"
                  ? "確認"
                  : "取り消し"}{" "}
              · {timeLabel(e.createdAt)}
            </p>
            <HistoryDetails details={e.details} />
          </li>
        ))}
      </ul>
    </ResponsiveDialog>
  )
}
function HistoryDetails({ details }: { details: string }) {
  try {
    const value: unknown = JSON.parse(details)
    return typeof value === "object" &&
      value !== null &&
      "message" in value &&
      typeof value.message === "string" ? (
      <p className="mt-1 whitespace-pre-wrap text-muted-foreground">
        {value.message}
      </p>
    ) : null
  } catch {
    return null
  }
}

function AttendanceHistory({
  id,
  onClose,
}: {
  id: string
  onClose: () => void
}) {
  const query = useQuery({
    queryKey: ["attendance-events", id],
    queryFn: () => getAttendanceEvents(id),
  })
  return (
    <ResponsiveDialog
      open
      title="出勤の修正履歴"
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      {query.isError && <p role="alert">{errorMessage(query.error)}</p>}
      {query.isPending && (
        <p className="text-sm text-muted-foreground">読み込み中…</p>
      )}
      {query.data?.events.length === 0 && (
        <p className="text-sm text-muted-foreground">修正履歴はありません。</p>
      )}
      <ul className="divide-y">
        {query.data?.events.map((event) => (
          <li key={event.id} className="space-y-1 py-3 text-sm">
            <p>
              {event.before ? timeLabel(event.before) : "記録なし"} →{" "}
              {timeLabel(event.after)}
            </p>
            <p>{event.reason}</p>
            <p className="text-xs text-muted-foreground">
              {event.actor} ·{" "}
              {new Intl.DateTimeFormat("ja-JP", {
                timeZone: "Asia/Tokyo",
                month: "numeric",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              }).format(new Date(event.createdAt))}
            </p>
          </li>
        ))}
      </ul>
    </ResponsiveDialog>
  )
}

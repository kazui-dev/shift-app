import { useState } from "react"
import { LoaderCircle } from "lucide-react"

import { Button } from "@workspace/ui/components/button"
import { Textarea } from "@workspace/ui/components/textarea"

import type { CalendarAssignment } from "@/api/assignments"
import { nativeSelectClassName } from "@/components/form-styles"
import { ResponsiveDialog } from "@/components/responsive-overlay"
import { formatCalendarTime } from "./calendar-format"

export function AssignmentDetailsDialog({
  assignment,
  dataUpdatedAt,
  offline,
  pending,
  onCheckIn,
  onClose,
  onSubmitReport,
}: {
  assignment: CalendarAssignment
  dataUpdatedAt: number
  offline: boolean
  pending: boolean
  onCheckIn: (assignmentId: string) => Promise<void>
  onClose: () => void
  onSubmitReport: (
    assignmentId: string,
    kind: "late" | "absence",
    message: string
  ) => Promise<boolean>
}) {
  const [reportOpen, setReportOpen] = useState(false)
  const [reportKind, setReportKind] = useState<"late" | "absence">("late")
  const [reportMessage, setReportMessage] = useState("")

  async function submitReport() {
    const submitted = await onSubmitReport(
      assignment.id,
      reportKind,
      reportMessage
    )
    if (!submitted) return
    setReportOpen(false)
    setReportMessage("")
  }

  return (
    <ResponsiveDialog
      open
      title={assignment.activityName}
      description={`${formatCalendarTime(assignment.startsAt)}–${formatCalendarTime(assignment.endsAt)} · ${assignment.place}`}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <div className="space-y-3">
        {assignment.notes && <p className="text-sm">{assignment.notes}</p>}
        <div className="flex flex-wrap gap-2">
          {assignment.checkedInAt ? (
            <p className="self-center text-xs text-muted-foreground">
              {formatCalendarTime(assignment.checkedInAt)}に出勤記録済み
            </p>
          ) : !offline ? (
            <Button
              size="sm"
              disabled={
                pending ||
                dataUpdatedAt < new Date(assignment.startsAt).getTime() ||
                dataUpdatedAt > new Date(assignment.endsAt).getTime()
              }
              onClick={() => void onCheckIn(assignment.id)}
            >
              {pending && <LoaderCircle className="animate-spin" />}
              出勤
            </Button>
          ) : null}
          {!offline && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setReportOpen((open) => !open)}
            >
              遅刻・欠勤連絡
            </Button>
          )}
        </div>
        {!offline && reportOpen && (
          <div className="space-y-3 border-t pt-4">
            <select
              aria-label="連絡種別"
              className={nativeSelectClassName}
              value={reportKind}
              onChange={(event) => {
                const kind = event.target.value
                if (kind === "late" || kind === "absence") {
                  setReportKind(kind)
                }
              }}
            >
              <option value="late">遅刻</option>
              <option value="absence">欠勤</option>
            </select>
            <Textarea
              className="min-h-24"
              maxLength={1000}
              placeholder="到着見込み、理由など"
              required
              value={reportMessage}
              onChange={(event) => setReportMessage(event.target.value)}
            />
            <Button
              size="sm"
              disabled={!reportMessage.trim() || pending}
              onClick={() => void submitReport()}
            >
              送信
            </Button>
          </div>
        )}
      </div>
    </ResponsiveDialog>
  )
}

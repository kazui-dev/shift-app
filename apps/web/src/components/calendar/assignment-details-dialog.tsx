import { japanTime } from "@workspace/shared/japan-time"
import { LoaderCircle } from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import type { CalendarAssignment } from "@/api/assignments"
import { ResponsiveDialog } from "@/components/responsive-overlay"
import { reportLabel, reportOpen, standingReport } from "./assignment-actions"

export function AssignmentDetailsDialog({
  assignment,
  now,
  offline,
  checkingIn,
  onCheckIn,
  onReport,
  onClose,
}: {
  assignment: CalendarAssignment
  now: number
  offline: boolean
  checkingIn: boolean
  onCheckIn: (id: string) => void
  onReport: (id: string) => void
  onClose: () => void
}) {
  const absent = standingReport(assignment)?.kind === "absence"
  return (
    <ResponsiveDialog
      open
      title={assignment.activityName}
      description={`${japanTime(assignment.startsAt)}–${japanTime(assignment.endsAt)} · ${assignment.place}`}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <div className="space-y-4">
        {assignment.notes && <p className="text-sm">{assignment.notes}</p>}
        <div className="flex flex-wrap items-center gap-2">
          {assignment.checkedInAt ? (
            <p className="text-sm text-muted-foreground">
              {japanTime(assignment.checkedInAt)}に出勤
              {assignment.attendanceStatus === "pending"
                ? "（確認待ち）"
                : "記録済み"}
            </p>
          ) : (
            !absent && (
              <Button
                disabled={offline || checkingIn}
                onClick={() => onCheckIn(assignment.id)}
              >
                {checkingIn && <LoaderCircle className="animate-spin" />}出勤
              </Button>
            )
          )}
          {!assignment.checkedInAt && reportOpen(assignment, now) && (
            <Button
              variant="outline"
              disabled={offline}
              onClick={() => onReport(assignment.id)}
            >
              {reportLabel(assignment)}
            </Button>
          )}
        </div>
      </div>
    </ResponsiveDialog>
  )
}

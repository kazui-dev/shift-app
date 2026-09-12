import { Link } from "@tanstack/react-router"
import { LoaderCircle } from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import type { CalendarAssignment } from "@/api/assignments"
import { ResponsiveDialog } from "@/components/responsive-overlay"
import { formatCalendarTime } from "./calendar-format"

export function AssignmentDetailsDialog({
  assignment,
  offline,
  pending,
  onCheckIn,
  onClose,
}: {
  assignment: CalendarAssignment
  offline: boolean
  pending: boolean
  onCheckIn: (id: string) => Promise<void>
  onClose: () => void
}) {
  return (
    <ResponsiveDialog
      open
      title={assignment.activityName}
      description={`${formatCalendarTime(assignment.startsAt)}–${formatCalendarTime(assignment.endsAt)} · ${assignment.place}`}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <div className="space-y-4">
        {assignment.notes && <p className="text-sm">{assignment.notes}</p>}
        <div className="flex flex-wrap items-center gap-2">
          {assignment.checkedInAt ? (
            <p className="text-sm text-muted-foreground">
              {formatCalendarTime(assignment.checkedInAt)}に出勤
              {assignment.attendanceStatus === "pending"
                ? "（確認待ち）"
                : "記録済み"}
            </p>
          ) : (
            <Button
              disabled={offline || pending}
              onClick={() => void onCheckIn(assignment.id)}
            >
              {pending && <LoaderCircle className="animate-spin" />}出勤
            </Button>
          )}
          {!offline && assignment.roomId && (
            <Link
              className="inline-flex h-9 items-center rounded-md border px-3 text-sm hover:bg-muted"
              to="/chat/$roomId"
              params={{ roomId: assignment.roomId }}
              search={{ report: assignment.id }}
            >
              遅刻・欠勤連絡
            </Link>
          )}
        </div>
      </div>
    </ResponsiveDialog>
  )
}

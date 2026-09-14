import { japanTime } from "@workspace/shared/japan-time"
import { Button } from "@workspace/ui/components/button"
import type { CalendarAssignment } from "@/api/assignments"
import { ResponsiveDialog } from "@/components/responsive-overlay"
import { attendanceLabel } from "./assignment-actions"

export function AssignmentDetailsDialog({
  assignment,
  onAttendance,
  onClose,
}: {
  assignment: CalendarAssignment
  onAttendance: (id: string) => void
  onClose: () => void
}) {
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
        <Button variant="outline" onClick={() => onAttendance(assignment.id)}>
          {attendanceLabel(assignment)}
        </Button>
      </div>
    </ResponsiveDialog>
  )
}

import { useState } from "react"
import { japanLocalDateTime } from "@workspace/shared/japan-time"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Textarea } from "@workspace/ui/components/textarea"
import { ResponsiveDialog } from "@/components/responsive-overlay"
import type { AttendanceData } from "./attendance-data"
import { localDateTime } from "./attendance-data"

export function AttendanceCorrection({
  assignment,
  pending,
  onSubmit,
  onCancel,
}: {
  assignment: AttendanceData["assignments"][number]
  pending: boolean
  onSubmit: (at: string, reason: string) => void
  onCancel: () => void
}) {
  const [at, setAt] = useState(
    localDateTime(assignment.checkedInAt ?? new Date().toISOString())
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

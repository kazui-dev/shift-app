import { useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { LoaderCircle } from "lucide-react"

import {
  japanInputValue,
  japanLocalDateTime,
  japanTime,
} from "@workspace/shared/japan-time"
import { Button } from "@workspace/ui/components/button"
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import {
  Drawer,
  DrawerContent,
  DrawerTitle,
} from "@workspace/ui/components/drawer"
import { Input } from "@workspace/ui/components/input"
import { Textarea } from "@workspace/ui/components/textarea"
import { toast } from "@workspace/ui/lib/toast"

import {
  submitAttendance,
  withdrawAttendance,
  type CalendarAssignment,
} from "@/api/assignments"
import { errorMessage } from "@/api/client"
import { keys } from "@/data/keys"
import { useMediaQuery } from "@/hooks/use-media-query"
import { attendanceOpen } from "./assignment-actions"

type Choice = "late" | "absent"

/**
 * A shift's attendance: check in, or say late or absent. Choosing check-in
 * acts at once; late and absent open their fields in space kept from the
 * start, so the sheet never changes height.
 */
function AttendanceForm({
  assignment,
  now,
  offline,
  checkingIn,
  onCheckIn,
  onClose,
}: {
  assignment: CalendarAssignment
  now: number
  offline: boolean
  checkingIn: boolean
  onCheckIn: (assignmentId: string) => void
  onClose: () => void
}) {
  const client = useQueryClient()
  const current = assignment.attendance
  const standingState: Choice | null =
    current?.state === "late" || current?.state === "absent"
      ? current.state
      : null
  const standing = standingState ? current : null
  const [choice, setChoice] = useState<Choice | null>(standingState)
  const [arrival, setArrival] = useState(
    standing?.expectedAt
      ? japanInputValue(standing.expectedAt).slice(11, 16)
      : ""
  )
  const [reason, setReason] = useState(standing?.reason ?? "")
  const [pending, setPending] = useState<"send" | "withdraw" | null>(null)
  const open = attendanceOpen(assignment, now)
  const locked = offline || !open || pending !== null
  const shiftDate = japanInputValue(assignment.startsAt).slice(0, 10)

  async function run(work: () => Promise<unknown>, done: string) {
    try {
      await work()
      await client.invalidateQueries({ queryKey: keys.assignmentMonth() })
      toast.success(done)
      onClose()
    } catch (error) {
      toast.error(errorMessage(error))
    } finally {
      setPending(null)
    }
  }

  function send() {
    if (!choice) return
    setPending("send")
    void run(
      () =>
        submitAttendance(
          assignment.id,
          choice === "late"
            ? {
                state: "late",
                expectedAt: arrival
                  ? new Date(
                      japanLocalDateTime(`${shiftDate}T${arrival}`)
                    ).toISOString()
                  : null,
                reason: reason.trim(),
              }
            : { state: "absent", reason: reason.trim() }
        ),
      choice === "late" ? "遅刻を送信しました。" : "欠勤を送信しました。"
    )
  }

  function withdraw() {
    setPending("withdraw")
    void run(
      () => withdrawAttendance(assignment.id),
      standingState === "late"
        ? "遅刻を取り消しました。"
        : "欠勤を取り消しました。"
    )
  }

  const reasonField = (
    <label htmlFor="attendance-reason" className="block space-y-1.5 text-sm">
      理由（任意）
      <Textarea
        id="attendance-reason"
        rows={2}
        maxLength={1000}
        disabled={locked}
        value={reason}
        onChange={(event) => setReason(event.target.value)}
        className="min-h-0 resize-none"
      />
    </label>
  )

  return (
    <div className="space-y-4 px-4 pt-2 pb-4">
      <p className="flex justify-center">
        <span className="max-w-full truncate rounded-full bg-muted px-3 py-1 text-sm">
          {assignment.activityName} {japanTime(assignment.startsAt)}–
          {japanTime(assignment.endsAt)}
        </span>
      </p>
      <div className="grid grid-cols-3 gap-2">
        <Button
          type="button"
          variant="outline"
          size="lg"
          disabled={locked || checkingIn}
          onClick={() => {
            onClose()
            onCheckIn(assignment.id)
          }}
        >
          {checkingIn && <LoaderCircle className="animate-spin" />}
          出勤
        </Button>
        {(["late", "absent"] as const).map((value) => (
          <Button
            key={value}
            type="button"
            size="lg"
            variant={choice === value ? "default" : "outline"}
            aria-pressed={choice === value}
            disabled={locked}
            onClick={() => setChoice(value)}
          >
            {value === "late" ? "遅刻" : "欠勤"}
          </Button>
        ))}
      </div>
      {/* Kept as tall as late's two fields, so choosing never moves the sheet. */}
      <div className="min-h-44 space-y-3">
        {current?.state === "present" && current.checkedInAt ? (
          <p className="text-sm text-muted-foreground">
            {japanTime(current.checkedInAt)} 出勤
            {current.checkInStatus === "pending" && "（確認待ち）"}
          </p>
        ) : choice === "late" ? (
          <>
            <label
              htmlFor="attendance-arrival"
              className="flex items-center gap-3 text-sm"
            >
              <span className="shrink-0">到着見込み</span>
              <Input
                id="attendance-arrival"
                type="time"
                disabled={locked}
                value={arrival}
                onChange={(event) => setArrival(event.target.value)}
                className="w-32"
              />
            </label>
            {reasonField}
          </>
        ) : choice === "absent" ? (
          reasonField
        ) : null}
      </div>
      <div className="flex items-center justify-end gap-2">
        {standing && (
          <Button
            type="button"
            variant="ghost"
            className="mr-auto text-destructive"
            disabled={locked}
            onClick={withdraw}
          >
            {pending === "withdraw" && (
              <LoaderCircle className="animate-spin" />
            )}
            取り消し
          </Button>
        )}
        <Button type="button" disabled={locked || !choice} onClick={send}>
          {pending === "send" && <LoaderCircle className="animate-spin" />}
          送信
        </Button>
      </div>
    </div>
  )
}

/** Attendance for one shift: a drawer on phones, a dialog on wider screens. */
export function AttendanceSheet(props: {
  assignment: CalendarAssignment
  now: number
  offline: boolean
  checkingIn: boolean
  onCheckIn: (assignmentId: string) => void
  onClose: () => void
}) {
  const desktop = useMediaQuery("(min-width: 768px)")
  const title = `${props.assignment.activityName}の勤怠`
  if (desktop)
    return (
      <Dialog
        open
        onOpenChange={(open) => {
          if (!open) props.onClose()
        }}
      >
        <DialogContent showCloseButton={false} className="gap-0 p-0 pt-4">
          <DialogTitle className="sr-only">{title}</DialogTitle>
          <AttendanceForm {...props} />
        </DialogContent>
      </Dialog>
    )
  return (
    <Drawer
      open
      onOpenChange={(open) => {
        if (!open) props.onClose()
      }}
    >
      <DrawerContent
        finalFocus={false}
        className="pb-[env(safe-area-inset-bottom)]"
      >
        <DrawerTitle className="sr-only">{title}</DrawerTitle>
        <AttendanceForm {...props} />
      </DrawerContent>
    </Drawer>
  )
}

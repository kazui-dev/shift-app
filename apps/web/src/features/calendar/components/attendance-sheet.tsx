import { useEffect, useRef, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { ArrowLeft, LoaderCircle, MapPin, Users, X } from "lucide-react"

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
import { cn } from "@workspace/ui/lib/utils"

import {
  submitAttendance,
  withdrawAttendance,
  type CalendarAssignment,
} from "@/features/shifts/api/assignments"
import { errorMessage } from "@/lib/http/client"
import { keys } from "@/app/data/keys"
import { useMediaQuery } from "@/lib/hooks/use-media-query"
import { attendanceOpen } from "./assignment-actions"
import { AttendanceNotices } from "@/features/shifts/components/shift-notices"
import { LiveShiftCoworkers, ShiftCoworkers } from "./shift-coworkers"
import type { ShiftCoworker } from "@workspace/shared/shifts"

type Choice = "late" | "absent"

const tones = {
  late: {
    idle: "bg-amber-100 text-amber-900 hover:bg-amber-100 hover:text-amber-900 dark:bg-amber-950 dark:text-amber-200 dark:hover:bg-amber-950 dark:hover:text-amber-200",
    chosen:
      "bg-amber-500 text-white hover:bg-amber-500 hover:text-white dark:bg-amber-600 dark:hover:bg-amber-600 dark:hover:text-white",
  },
  absent: {
    idle: "bg-red-100 text-red-900 hover:bg-red-100 hover:text-red-900 dark:bg-red-950 dark:text-red-200 dark:hover:bg-red-950 dark:hover:text-red-200",
    chosen:
      "bg-red-600 text-white hover:bg-red-600 hover:text-white dark:bg-red-700 dark:hover:bg-red-700 dark:hover:text-white",
  },
}

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
  onShowMembers,
}: {
  assignment: CalendarAssignment
  now: number
  offline: boolean
  checkingIn: boolean
  onCheckIn: (assignmentId: string) => void
  onClose: () => void
  onShowMembers?: () => void
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
    if (locked || !choice || !reason.trim()) return
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

  /** The reason field; a stand-in copy only holds its space. */
  const reasonField = (standIn = false) => (
    <label
      htmlFor={standIn ? undefined : "attendance-reason"}
      className="block space-y-2.5 text-sm font-medium"
    >
      理由（必須）
      <Textarea
        id={standIn ? undefined : "attendance-reason"}
        rows={2}
        required={!standIn}
        maxLength={1000}
        disabled={locked}
        value={reason}
        onChange={(event) => setReason(event.target.value)}
        className="min-h-0 resize-none"
      />
    </label>
  )

  return (
    <div
      className={cn(
        "space-y-6 px-4 pt-2 pb-8",
        "max-h-[80dvh] overflow-y-auto"
      )}
    >
      <div className="relative space-y-2 text-center">
        <p
          className={cn(
            "flex min-h-9 items-center justify-center",
            onShowMembers && "px-10"
          )}
        >
          <span
            className="max-w-full truncate rounded-full px-3 py-1 text-sm"
            style={{
              backgroundColor: `color-mix(in oklab, ${assignment.color} 14%, var(--background))`,
            }}
          >
            {assignment.activityName} {japanTime(assignment.startsAt)}〜
            {japanTime(assignment.endsAt)}
          </span>
        </p>
        {onShowMembers && (
          <Button
            type="button"
            variant="secondary"
            size="icon"
            className="absolute top-0 right-0 rounded-full"
            aria-label="シフトメンバー"
            title="シフトメンバー"
            onClick={onShowMembers}
          >
            <Users aria-hidden="true" />
          </Button>
        )}
        {assignment.place && (
          <p className="flex items-start justify-center gap-1.5 text-sm text-muted-foreground">
            <MapPin aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
            <span className="min-w-0 break-words">{assignment.place}</span>
          </p>
        )}
      </div>
      <AttendanceNotices assignment={assignment} />
      <div className="grid grid-cols-3 gap-2">
        <Button
          type="button"
          variant="ghost"
          size="lg"
          className="bg-green-100 text-green-900 transition-none hover:bg-green-100 hover:text-green-900 active:bg-green-700 active:text-white dark:bg-green-950 dark:text-green-200 dark:hover:bg-green-950 dark:hover:text-green-200 dark:active:bg-green-700 dark:active:text-white"
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
            variant="ghost"
            className={cn(
              "transition-none",
              choice === value ? tones[value].chosen : tones[value].idle
            )}
            aria-pressed={choice === value}
            disabled={locked}
            onClick={() => setChoice(value)}
          >
            {value === "late" ? "遅刻" : "欠勤"}
          </Button>
        ))}
      </div>
      {/* Every panel shares one grid cell, so the sheet keeps late's height. */}
      <div className="grid">
        {current?.state === "present" && current.checkedInAt && (
          <p className="col-start-1 row-start-1 text-sm text-muted-foreground">
            {japanTime(current.checkedInAt)} 出勤
            {current.checkInStatus === "pending" && "（確認待ち）"}
          </p>
        )}
        <div
          className={cn(
            "col-start-1 row-start-1 space-y-6",
            choice !== "late" && "invisible"
          )}
          inert={choice !== "late"}
        >
          <label
            htmlFor="attendance-arrival"
            className="flex items-center gap-3 text-sm font-medium"
          >
            <span className="shrink-0">到着見込み：</span>
            <Input
              id="attendance-arrival"
              type="time"
              disabled={locked}
              value={arrival}
              onChange={(event) => setArrival(event.target.value)}
              className="w-32"
            />
          </label>
          {reasonField(choice !== "late")}
        </div>
        {choice === "absent" && (
          <div className="col-start-1 row-start-1">{reasonField()}</div>
        )}
      </div>
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
        {standing && (
          <Button
            type="button"
            variant="ghost"
            className="justify-self-start text-destructive"
            disabled={locked}
            onClick={withdraw}
          >
            {pending === "withdraw" && (
              <LoaderCircle className="animate-spin" />
            )}
            取り消し
          </Button>
        )}
        <Button
          type="button"
          size="lg"
          disabled={locked || !choice || !reason.trim()}
          onClick={send}
          className="col-start-2 w-48"
        >
          {pending === "send" && <LoaderCircle className="animate-spin" />}
          送信
        </Button>
      </div>
    </div>
  )
}

function AttendanceContent({
  members,
  ...props
}: Parameters<typeof AttendanceForm>[0] & {
  members: readonly ShiftCoworker[] | undefined
}) {
  const [showMembers, setShowMembers] = useState(false)
  const trigger = useRef<HTMLDivElement>(null)
  const back = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (showMembers) back.current?.focus()
  }, [showMembers])

  return (
    <div className="min-h-0">
      <div
        ref={trigger}
        className={cn("min-h-0 overflow-y-auto", showMembers && "hidden")}
        inert={showMembers}
        aria-hidden={showMembers}
      >
        <AttendanceForm {...props} onShowMembers={() => setShowMembers(true)} />
      </div>
      {showMembers && (
        <div className="flex max-h-[min(38rem,80dvh)] min-h-0 flex-col">
          <div className="shrink-0 px-4 pb-4">
            <div className="flex items-center justify-between gap-2">
              <Button
                ref={back}
                type="button"
                variant="ghost"
                size="icon"
                aria-label="勤怠に戻る"
                onClick={() => {
                  setShowMembers(false)
                  requestAnimationFrame(() =>
                    trigger.current
                      ?.querySelector<HTMLButtonElement>(
                        "button[aria-label='シフトメンバー']"
                      )
                      ?.focus()
                  )
                }}
              >
                <ArrowLeft aria-hidden="true" />
              </Button>
              <h2 className="text-base font-semibold">シフトメンバー</h2>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="閉じる"
                onClick={props.onClose}
              >
                <X aria-hidden="true" />
              </Button>
            </div>
            <p className="mt-1 text-center text-sm text-muted-foreground">
              {props.assignment.activityName} ·{" "}
              {japanTime(props.assignment.startsAt)}〜
              {japanTime(props.assignment.endsAt)}
            </p>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-6">
            {members ? (
              <ShiftCoworkers
                assignment={props.assignment}
                members={members}
                now={props.now}
              />
            ) : (
              <LiveShiftCoworkers
                assignment={props.assignment}
                now={props.now}
                offline={props.offline}
              />
            )}
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * Attendance for one shift: a drawer on phones, a dialog on wider screens.
 * It stays mounted while closed so it can slide in and out.
 */
export function AttendanceSheet({
  open,
  assignment,
  onClosed,
  members,
  ...props
}: {
  open: boolean
  /** Null only while nothing has been opened yet. */
  assignment: CalendarAssignment | null
  now: number
  offline: boolean
  checkingIn: boolean
  onCheckIn: (assignmentId: string) => void
  onClose: () => void
  onClosed: () => void
  /** Only the isolated local preview supplies fictional members. */
  members?: readonly ShiftCoworker[]
}) {
  const desktop = useMediaQuery("(min-width: 768px)")
  // A long press opens the sheet with the finger still down; lifting it must
  // not count as a press outside.
  const openingGesture = useRef(true)
  useEffect(() => {
    if (!open) return undefined
    openingGesture.current = true
    const started = () => {
      openingGesture.current = false
    }
    document.addEventListener("pointerdown", started, true)
    return () => document.removeEventListener("pointerdown", started, true)
  }, [open])
  const title = assignment ? `${assignment.activityName}の勤怠` : "勤怠"
  const form = assignment && (
    <AttendanceContent
      key={assignment.id}
      assignment={assignment}
      members={members}
      {...props}
    />
  )
  const change = (
    next: boolean,
    details: { reason: string; cancel: () => void }
  ) => {
    if (!next && openingGesture.current && details.reason === "outside-press") {
      details.cancel()
      return
    }
    if (!next) props.onClose()
  }
  const complete = (next: boolean) => {
    if (!next) onClosed()
  }
  if (desktop)
    return (
      <Dialog open={open} onOpenChange={change} onOpenChangeComplete={complete}>
        <DialogContent
          showCloseButton={false}
          className="gap-0 p-0 pt-4 sm:max-w-xl"
        >
          <DialogTitle className="sr-only">{title}</DialogTitle>
          {form}
        </DialogContent>
      </Dialog>
    )
  return (
    <Drawer open={open} onOpenChange={change} onOpenChangeComplete={complete}>
      <DrawerContent
        finalFocus={false}
        className="pb-[env(safe-area-inset-bottom)]"
      >
        <DrawerTitle className="sr-only">{title}</DrawerTitle>
        {form}
      </DrawerContent>
    </Drawer>
  )
}

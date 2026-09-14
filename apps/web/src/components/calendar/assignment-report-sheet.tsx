import { useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { LoaderCircle } from "lucide-react"

import {
  japanInputValue,
  japanLocalDateTime,
  japanTime,
} from "@workspace/shared/japan-time"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Textarea } from "@workspace/ui/components/textarea"
import { toast } from "@workspace/ui/lib/toast"

import {
  submitAssignmentReport,
  type CalendarAssignment,
} from "@/api/assignments"
import { errorMessage } from "@/api/client"
import { ResponsiveDialog } from "@/components/responsive-overlay"
import { keys } from "@/data/keys"
import { standingReport } from "./assignment-actions"

type Arrival =
  | { type: "after"; minutes: 10 | 30 | 60 }
  | { type: "time"; value: string }
  | { type: "unknown" }

const afterChoices = [
  { minutes: 10, label: "10分後" },
  { minutes: 30, label: "30分後" },
  { minutes: 60, label: "1時間後" },
] as const

/** When a late member expects to arrive, as sent with the report. */
function arrivalAt(arrival: Arrival, shiftDate: string, now: number) {
  if (arrival.type === "after")
    return new Date(now + arrival.minutes * 60_000).toISOString()
  if (arrival.type === "time" && arrival.value)
    return new Date(
      japanLocalDateTime(`${shiftDate}T${arrival.value}`)
    ).toISOString()
  return null
}

/**
 * A late or absence report for one shift, sent from where the shift is shown.
 * Choosing late or absent comes first; the arrival and reason follow.
 */
export function AssignmentReportSheet({
  assignment,
  onClose,
}: {
  assignment: CalendarAssignment
  onClose: () => void
}) {
  const client = useQueryClient()
  const existing = standingReport(assignment)
  const [kind, setKind] = useState<"late" | "absence" | null>(
    existing?.kind ?? null
  )
  const [arrival, setArrival] = useState<Arrival>(
    existing?.eta
      ? { type: "time", value: japanInputValue(existing.eta).slice(11, 16) }
      : { type: "unknown" }
  )
  const [message, setMessage] = useState(existing?.message ?? "")
  const [pending, setPending] = useState(false)
  const shiftDate = japanInputValue(assignment.startsAt).slice(0, 10)
  const ready =
    kind !== null &&
    !(kind === "late" && arrival.type === "time" && !arrival.value)

  async function send() {
    if (!kind || !ready) return
    setPending(true)
    try {
      await submitAssignmentReport(assignment.id, {
        kind,
        message: message.trim(),
        eta: kind === "late" ? arrivalAt(arrival, shiftDate, Date.now()) : null,
      })
      await client.invalidateQueries({ queryKey: keys.assignmentMonth() })
      toast.success(
        kind === "late" ? "遅刻を連絡しました。" : "欠勤を連絡しました。"
      )
      onClose()
    } catch (error) {
      toast.error(errorMessage(error))
    } finally {
      setPending(false)
    }
  }

  return (
    <ResponsiveDialog
      open
      title="遅刻・欠勤の連絡"
      description={`${assignment.activityName} · ${japanTime(assignment.startsAt)}–${japanTime(assignment.endsAt)}`}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <form
        className="space-y-5"
        onSubmit={(event) => {
          event.preventDefault()
          void send()
        }}
      >
        <div className="grid grid-cols-2 gap-2">
          {(["late", "absence"] as const).map((choice) => (
            <Button
              key={choice}
              type="button"
              size="lg"
              variant={kind === choice ? "default" : "outline"}
              aria-pressed={kind === choice}
              onClick={() => setKind(choice)}
            >
              {choice === "late" ? "遅刻" : "欠勤"}
            </Button>
          ))}
        </div>
        {kind === "late" && (
          <fieldset className="space-y-2">
            <legend className="text-sm">到着見込み</legend>
            <div className="flex flex-wrap gap-2">
              {afterChoices.map((choice) => (
                <Button
                  key={choice.minutes}
                  type="button"
                  size="sm"
                  variant={
                    arrival.type === "after" &&
                    arrival.minutes === choice.minutes
                      ? "default"
                      : "outline"
                  }
                  onClick={() =>
                    setArrival({ type: "after", minutes: choice.minutes })
                  }
                >
                  {choice.label}
                </Button>
              ))}
              <Button
                type="button"
                size="sm"
                variant={arrival.type === "time" ? "default" : "outline"}
                onClick={() =>
                  setArrival({
                    type: "time",
                    value: arrival.type === "time" ? arrival.value : "",
                  })
                }
              >
                時刻を指定
              </Button>
              <Button
                type="button"
                size="sm"
                variant={arrival.type === "unknown" ? "default" : "outline"}
                onClick={() => setArrival({ type: "unknown" })}
              >
                未定
              </Button>
            </div>
            {arrival.type === "time" && (
              <Input
                type="time"
                aria-label="到着時刻"
                value={arrival.value}
                onChange={(event) =>
                  setArrival({ type: "time", value: event.target.value })
                }
              />
            )}
          </fieldset>
        )}
        {kind && (
          <label
            htmlFor="assignment-report-message"
            className="block space-y-2 text-sm"
          >
            理由（任意）
            <Textarea
              id="assignment-report-message"
              maxLength={1000}
              value={message}
              onChange={(event) => setMessage(event.target.value)}
            />
          </label>
        )}
        <div className="flex justify-end">
          <Button disabled={pending || !ready}>
            {pending && <LoaderCircle className="animate-spin" />}
            送信
          </Button>
        </div>
      </form>
    </ResponsiveDialog>
  )
}

import { useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { LoaderCircle } from "lucide-react"

import { Button } from "@workspace/ui/components/button"

import { PushControl } from "@/components/push-control"
import { errorMessage } from "@/lib/api"
import { checkIn, getTimeline, submitAssignmentReport } from "@/lib/shifts-api"

function today(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`
}

function dayRange(date: string): { from: string; to: string } {
  const from = new Date(`${date}T00:00:00`)
  const to = new Date(from)
  to.setDate(to.getDate() + 1)
  return { from: from.toISOString(), to: to.toISOString() }
}

function time(value: string): string {
  return new Intl.DateTimeFormat("ja-JP", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value))
}

export function TimelinePage() {
  const queryClient = useQueryClient()
  const [date, setDate] = useState(today)
  const [checkInPending, setCheckInPending] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [reportTarget, setReportTarget] = useState<string | null>(null)
  const [reportKind, setReportKind] = useState<"late" | "absence">("late")
  const [reportMessage, setReportMessage] = useState("")
  const range = dayRange(date)
  const timeline = useQuery({
    queryKey: ["timeline", date],
    queryFn: () => getTimeline(range.from, range.to),
  })

  async function recordCheckIn(assignmentId: string) {
    setCheckInPending(assignmentId)
    setMessage(null)
    try {
      await checkIn(assignmentId)
      await queryClient.invalidateQueries({ queryKey: ["timeline", date] })
      setMessage("出勤を記録しました。")
    } catch (error) {
      setMessage(errorMessage(error))
    } finally {
      setCheckInPending(null)
    }
  }

  async function submitReport(assignmentId: string) {
    setCheckInPending(assignmentId)
    setMessage(null)
    try {
      await submitAssignmentReport(assignmentId, {
        kind: reportKind,
        message: reportMessage,
      })
      setReportTarget(null)
      setReportMessage("")
      setMessage("連絡を送信しました。")
    } catch (error) {
      setMessage(errorMessage(error))
    } finally {
      setCheckInPending(null)
    }
  }

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">自分の予定</p>
          <h1 className="text-xl font-medium">タイムライン</h1>
        </div>
        <div className="space-y-2 text-right">
          <input
            type="date"
            className="h-10 rounded-md border bg-background px-3"
            value={date}
            onChange={(event) => setDate(event.target.value)}
          />
          <PushControl />
        </div>
      </div>

      {timeline.isPending && <LoaderCircle className="animate-spin" />}
      {timeline.isError && (
        <div className="space-y-2 text-destructive">
          <p>{errorMessage(timeline.error)}</p>
          <Button
            size="sm"
            variant="outline"
            onClick={() => timeline.refetch()}
          >
            再試行
          </Button>
        </div>
      )}
      {timeline.data?.assignments.length === 0 && (
        <p className="rounded-lg border p-4 text-muted-foreground">
          この日のシフトはありません。
        </p>
      )}
      <ol className="space-y-3">
        {timeline.data?.assignments.map((assignment) => (
          <li
            key={assignment.id}
            className="border-l-4 bg-card p-4"
            style={{ borderColor: assignment.color }}
          >
            <p className="font-mono text-sm">
              {time(assignment.startsAt)}–{time(assignment.endsAt)}
            </p>
            <h2 className="font-medium">{assignment.activityName}</h2>
            <p className="text-sm text-muted-foreground">
              {assignment.place} · {assignment.activityType}
            </p>
            {assignment.notes && (
              <p className="mt-2 text-sm">{assignment.notes}</p>
            )}
            <div className="mt-3">
              {assignment.checkedInAt ? (
                <p className="text-xs text-muted-foreground">
                  {time(assignment.checkedInAt)} 出勤済み
                </p>
              ) : (
                <Button
                  size="sm"
                  disabled={
                    checkInPending !== null ||
                    timeline.dataUpdatedAt <
                      new Date(assignment.startsAt).getTime() ||
                    timeline.dataUpdatedAt >
                      new Date(assignment.endsAt).getTime()
                  }
                  onClick={() => void recordCheckIn(assignment.id)}
                >
                  {checkInPending === assignment.id && (
                    <LoaderCircle className="animate-spin" />
                  )}
                  出勤
                </Button>
              )}
              <Button
                className="ml-2"
                size="sm"
                variant="outline"
                onClick={() =>
                  setReportTarget((current) =>
                    current === assignment.id ? null : assignment.id
                  )
                }
              >
                遅刻・欠勤連絡
              </Button>
            </div>
            {reportTarget === assignment.id && (
              <div className="mt-3 space-y-2 rounded-md border p-3">
                <select
                  className="h-9 rounded-md border bg-background px-2"
                  value={reportKind}
                  onChange={(event) =>
                    setReportKind(event.target.value as "late" | "absence")
                  }
                >
                  <option value="late">遅刻</option>
                  <option value="absence">欠勤</option>
                </select>
                <textarea
                  className="min-h-20 w-full rounded-md border bg-background p-2"
                  maxLength={1000}
                  placeholder="到着見込み、理由など"
                  required
                  value={reportMessage}
                  onChange={(event) => setReportMessage(event.target.value)}
                />
                <Button
                  size="sm"
                  disabled={!reportMessage.trim() || checkInPending !== null}
                  onClick={() => void submitReport(assignment.id)}
                >
                  送信
                </Button>
              </div>
            )}
          </li>
        ))}
      </ol>
      {message && <p className="text-sm">{message}</p>}
    </section>
  )
}

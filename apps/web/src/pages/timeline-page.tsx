import { useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { LoaderCircle } from "lucide-react"

import { Button } from "@workspace/ui/components/button"

import { PushControl } from "@/components/push-control"
import { FeedbackNotice } from "@/components/feedback-notice"
import { fieldClassName, textareaClassName } from "@/components/form-styles"
import { EmptyState, LoadingState, PageHeader } from "@/components/page-layout"
import { errorMessage } from "@/api/client"
import { checkIn, submitAssignmentReport } from "@/api/assignments"
import { getTimeline } from "@/api/timeline"

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
    <section className="space-y-6">
      <PageHeader title="タイムライン">
        <div className="flex w-full items-center gap-2 sm:w-auto">
          <input
            type="date"
            aria-label="表示する日"
            className={`${fieldClassName} min-w-0 flex-1 sm:w-auto`}
            value={date}
            onChange={(event) => setDate(event.target.value)}
          />
          <PushControl />
        </div>
      </PageHeader>

      {timeline.isPending && <LoadingState />}
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
        <EmptyState>この日のシフトはありません</EmptyState>
      )}
      <ol className="space-y-4">
        {timeline.data?.assignments.map((assignment) => (
          <li
            key={assignment.id}
            className="relative overflow-hidden rounded-xl border bg-card p-4 pl-5 shadow-xs"
          >
            <span
              className="absolute inset-y-0 left-0 w-1"
              style={{ backgroundColor: assignment.color }}
            />
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-mono text-sm font-medium tabular-nums">
                  {time(assignment.startsAt)}–{time(assignment.endsAt)}
                </p>
                <h2 className="mt-1 font-semibold">
                  {assignment.activityName}
                </h2>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  {assignment.place} · {assignment.activityType}
                </p>
              </div>
              {assignment.checkedInAt && (
                <span className="shrink-0 rounded-full bg-muted px-2 py-1 text-xs font-medium">
                  出勤済み
                </span>
              )}
            </div>
            {assignment.notes && (
              <p className="mt-3 border-t pt-3 text-sm">{assignment.notes}</p>
            )}
            <div className="mt-4 flex flex-wrap gap-2">
              {assignment.checkedInAt ? (
                <p className="self-center text-xs text-muted-foreground">
                  {time(assignment.checkedInAt)}に記録
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
              <div className="mt-4 space-y-3 border-t pt-4">
                <select
                  aria-label="連絡種別"
                  className={fieldClassName}
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
                <textarea
                  className={textareaClassName}
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
      {message && (
        <FeedbackNotice message={message} onDismiss={() => setMessage(null)} />
      )}
    </section>
  )
}

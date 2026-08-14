import { useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { LoaderCircle } from "lucide-react"

import { Button } from "@workspace/ui/components/button"

import { errorMessage } from "@/lib/api"
import { checkIn, getTimeline } from "@/lib/shifts-api"

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

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">自分の予定</p>
          <h1 className="text-xl font-medium">タイムライン</h1>
        </div>
        <input
          type="date"
          className="h-10 rounded-md border bg-background px-3"
          value={date}
          onChange={(event) => setDate(event.target.value)}
        />
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
            </div>
          </li>
        ))}
      </ol>
      {message && <p className="text-sm">{message}</p>}
    </section>
  )
}

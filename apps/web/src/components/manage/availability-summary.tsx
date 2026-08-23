import { useState, type FormEvent } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Trash2 } from "lucide-react"

import { Button } from "@workspace/ui/components/button"

import {
  createAvailabilityDate,
  deleteAvailabilityDate,
  getAvailabilityDates,
  getAvailabilitySubmissions,
} from "@/api/availability"
import { errorMessage } from "@/api/client"
import { ConfirmDialog } from "@/components/confirm-dialog"
import { FeedbackNotice } from "@/components/feedback-notice"
import { fieldClassName } from "@/components/form-styles"
import { EmptyState, LoadingState } from "@/components/page-layout"

function dateLabel(value: string): string {
  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short",
  }).format(new Date(`${value}T12:00:00+09:00`))
}

export function AvailabilitySummary({ year }: { year: number }) {
  const queryClient = useQueryClient()
  const [newDate, setNewDate] = useState("")
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<{
    message: string
    tone: "default" | "error"
  } | null>(null)
  const dates = useQuery({
    queryKey: ["availability-dates", year],
    queryFn: () => getAvailabilityDates(year),
  })
  const submissions = useQuery({
    queryKey: ["availability-submissions", year],
    queryFn: () => getAvailabilitySubmissions(year),
  })
  const createDate = useMutation({
    mutationFn: (date: string) => createAvailabilityDate(year, date),
    onSuccess: async () => {
      setNewDate("")
      setFeedback({ message: "入力日を追加しました。", tone: "default" })
      await queryClient.invalidateQueries({
        queryKey: ["availability-dates", year],
      })
    },
    onError: (error) =>
      setFeedback({ message: errorMessage(error), tone: "error" }),
  })
  const deleteDate = useMutation({
    mutationFn: (date: string) => deleteAvailabilityDate(year, date),
    onSuccess: async () => {
      setDeleteTarget(null)
      setFeedback({ message: "入力日を削除しました。", tone: "default" })
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["availability-dates", year],
        }),
        queryClient.invalidateQueries({
          queryKey: ["availability-submissions", year],
        }),
        queryClient.invalidateQueries({ queryKey: ["availability", year] }),
      ])
    },
    onError: (error) => {
      setDeleteTarget(null)
      setFeedback({ message: errorMessage(error), tone: "error" })
    },
  })

  function submitDate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (newDate) createDate.mutate(newDate)
  }

  return (
    <section className="space-y-8">
      <div>
        <h2 className="flex min-h-11 items-center border-b font-medium">
          入力日
        </h2>
        {dates.isPending ? (
          <LoadingState />
        ) : (
          <ul className="divide-y">
            {dates.data?.dates.map((date) => (
              <li
                key={date}
                className="flex min-h-12 items-center justify-between gap-3"
              >
                <span className="text-sm">{dateLabel(date)}</span>
                <Button
                  type="button"
                  size="icon-sm"
                  variant="ghost"
                  className="text-muted-foreground hover:text-destructive"
                  aria-label={`${dateLabel(date)}を削除`}
                  onClick={() => setDeleteTarget(date)}
                >
                  <Trash2 />
                </Button>
              </li>
            ))}
          </ul>
        )}
        <form className="mt-3 flex gap-2" onSubmit={submitDate}>
          <input
            type="date"
            aria-label="追加する入力日"
            className={`${fieldClassName} min-w-0 flex-1`}
            value={newDate}
            onChange={(event) => setNewDate(event.target.value)}
          />
          <Button
            type="submit"
            variant="outline"
            disabled={!newDate || createDate.isPending}
          >
            追加
          </Button>
        </form>
      </div>

      <div>
        <h2 className="flex min-h-11 items-center border-b font-medium">
          提出状況
          <span className="ml-2 text-xs font-normal text-muted-foreground">
            {submissions.data?.submissions.length ?? 0}件
          </span>
        </h2>
        {submissions.isPending ? (
          <LoadingState />
        ) : submissions.data?.submissions.length === 0 ? (
          <EmptyState>提出はありません</EmptyState>
        ) : (
          <ul className="divide-y border-b text-sm">
            {submissions.data?.submissions.map((submission) => (
              <li
                key={submission.id}
                className="flex items-center justify-between gap-3 py-3"
              >
                <span>{submission.member.displayName}</span>
                <span className="text-xs text-muted-foreground">
                  {submission.status === "submitted" ? "提出済み" : "下書き"}
                  {` · ${submission.windows.length}枠`}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {deleteTarget && (
        <ConfirmDialog
          title="入力日を削除しますか"
          description={`${dateLabel(deleteTarget)}の入力内容も削除されます。`}
          confirmLabel="削除"
          onCancel={() => setDeleteTarget(null)}
          onConfirm={() => deleteDate.mutate(deleteTarget)}
        />
      )}
      {feedback && (
        <FeedbackNotice
          message={feedback.message}
          tone={feedback.tone}
          onDismiss={() => setFeedback(null)}
        />
      )}
    </section>
  )
}

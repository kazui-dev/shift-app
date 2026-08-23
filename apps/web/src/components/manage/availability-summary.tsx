import { useState, type FormEvent } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Trash2 } from "lucide-react"

import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { toast } from "@workspace/ui/lib/toast"

import {
  createAvailabilityDate,
  deleteAvailabilityDate,
  getAvailabilityDates,
  getAvailabilitySubmissions,
} from "@/api/availability"
import { errorMessage } from "@/api/client"
import { ConfirmDialog } from "@/components/confirm-dialog"
import { EmptyState } from "@/components/page-layout"

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
      toast.success("入力日を追加しました。")
      await queryClient.invalidateQueries({
        queryKey: ["availability-dates", year],
      })
    },
    onError: (error) => toast.error(errorMessage(error)),
  })
  const deleteDate = useMutation({
    mutationFn: (date: string) => deleteAvailabilityDate(year, date),
    onSuccess: async () => {
      setDeleteTarget(null)
      toast.success("入力日を削除しました。")
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
      toast.error(errorMessage(error))
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
        {!dates.isPending && (
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
          <Input
            type="date"
            aria-label="追加する入力日"
            className="h-11 min-w-0 flex-1"
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
        {submissions.data?.submissions.length === 0 ? (
          <EmptyState>提出はありません</EmptyState>
        ) : submissions.data ? (
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
        ) : null}
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
    </section>
  )
}

import { useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import { Bell, ChevronRight, Plus, Trash2 } from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import { Checkbox } from "@workspace/ui/components/checkbox"
import { toast } from "@workspace/ui/lib/toast"
import type { FormDate } from "@workspace/shared/availability"
import {
  availabilitySubmissionsQuery,
  availabilityDatesQuery,
} from "@/data/availability"
import {
  notifyAvailability,
  saveAvailabilityDate,
  deleteAvailabilityDate,
} from "@/api/availability"
import { errorMessage } from "@/api/client"
import { ConfirmDialog } from "@/components/confirm-dialog"
import { MemberAvatar } from "@/components/member-avatar"
import { formatLongDate } from "@/components/calendar/calendar-format"

function clock(minute: number) {
  return `${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`
}
export function AvailabilitySummary({ year }: { year: number }) {
  const client = useQueryClient()
  const dates = useQuery(availabilityDatesQuery(year))
  const submissions = useQuery(availabilitySubmissionsQuery(year))
  const [selected, setSelected] = useState<string[]>([])
  const [removing, setRemoving] = useState<FormDate | null>(null)
  const [pending, setPending] = useState(false)
  async function run(action: () => Promise<unknown>) {
    if (pending) return
    setPending(true)
    try {
      await action()
      await Promise.all([
        client.invalidateQueries({ queryKey: ["availability-dates", year] }),
        client.invalidateQueries({ queryKey: ["availability", year] }),
        client.invalidateQueries({
          queryKey: ["availability-submissions", year],
        }),
      ])
      setSelected([])
      setRemoving(null)
    } catch (error) {
      toast.error(errorMessage(error))
    } finally {
      setPending(false)
    }
  }
  return (
    <div className="space-y-8">
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-medium">受付日程</h2>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              disabled={
                pending || !dates.data?.dates.some((date) => date.accepting)
              }
              onClick={() =>
                void run(async () => {
                  await notifyAvailability(year, "all")
                  toast.success("受付を通知しました。")
                })
              }
            >
              <Bell />
              受付を通知
            </Button>
            <Button
              size="sm"
              render={<Link to="/manage/shifts/availability/new" />}
              nativeButton={false}
            >
              <Plus />
              日程を追加
            </Button>
          </div>
        </div>
        {dates.isError ? (
          <Button variant="outline" onClick={() => void dates.refetch()}>
            日程を再読み込み
          </Button>
        ) : (
          <ul className="divide-y border-y">
            {dates.data?.dates.map((date) => (
              <li key={date.date} className="flex items-center gap-3 py-4">
                <Checkbox
                  aria-label={`${date.date}を選択`}
                  disabled={pending}
                  checked={selected.includes(date.date)}
                  onCheckedChange={(checked) =>
                    setSelected((values) =>
                      checked
                        ? [...values, date.date]
                        : values.filter((value) => value !== date.date)
                    )
                  }
                />
                <Link
                  to="/manage/shifts/availability/$date"
                  params={{ date: date.date }}
                  className="flex min-w-0 flex-1 items-center gap-3"
                >
                  <div className="min-w-0 flex-1 space-y-1">
                    <span className="block text-sm font-medium">
                      {formatLongDate(date.date)}
                    </span>
                    <span className="block text-xs text-muted-foreground tabular-nums">
                      {clock(date.startsMinute)}–{clock(date.endsMinute)}{" "}
                      <span className="ml-2">
                        {date.accepting ? "受付中" : "受付終了"}
                      </span>
                    </span>
                  </div>
                  <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                </Link>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`${date.date}を削除`}
                  disabled={pending}
                  onClick={() => setRemoving(date)}
                >
                  <Trash2 />
                </Button>
              </li>
            ))}
            {dates.data?.dates.length === 0 && (
              <li className="py-8 text-center text-sm text-muted-foreground">
                日程がありません
              </li>
            )}
            {dates.isPending && (
              <li className="py-8 text-center text-sm text-muted-foreground">
                読み込み中…
              </li>
            )}
          </ul>
        )}
        <div className="flex min-h-9 flex-wrap items-center gap-2">
          <span className="mr-auto text-xs text-muted-foreground">
            {selected.length ? `${selected.length}日選択中` : ""}
          </span>
          {[true, false].map((accepting) => (
            <Button
              key={String(accepting)}
              size="sm"
              variant="outline"
              disabled={pending || selected.length === 0}
              onClick={() =>
                void run(() =>
                  Promise.all(
                    (dates.data?.dates ?? [])
                      .filter((date) => selected.includes(date.date))
                      .map((date) =>
                        saveAvailabilityDate(year, {
                          date: date.date,
                          startsMinute: date.startsMinute,
                          endsMinute: date.endsMinute,
                          accepting,
                        })
                      )
                  )
                )
              }
            >
              {accepting ? "受付を開始" : "受付を終了"}
            </Button>
          ))}
        </div>
      </section>
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-medium">提出状況</h2>
          <Button
            variant="ghost"
            size="sm"
            disabled={
              pending ||
              !submissions.data?.progress.some((item) => !item.complete)
            }
            onClick={() =>
              void run(async () => {
                await notifyAvailability(year, "incomplete")
                toast.success("未提出のメンバーに通知しました。")
              })
            }
          >
            <Bell />
            未提出者に通知
          </Button>
        </div>
        {submissions.isError ? (
          <Button variant="outline" onClick={() => void submissions.refetch()}>
            提出状況を再読み込み
          </Button>
        ) : (
          <ul className="divide-y border-y">
            {submissions.data?.progress.map((item) => (
              <li key={item.memberId} className="flex items-center gap-3 py-3">
                <MemberAvatar name={item.displayName} image={null} />
                <span className="min-w-0 flex-1 truncate text-sm">
                  {item.displayName}
                </span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {item.complete ? "提出済み" : "未提出"}
                </span>
              </li>
            ))}
            {submissions.data?.progress.length === 0 && (
              <li className="py-6 text-center text-sm text-muted-foreground">
                メンバーがいません
              </li>
            )}
          </ul>
        )}
      </section>
      {removing && (
        <ConfirmDialog
          title="日程を削除しますか"
          confirmLabel="削除"
          onCancel={() => setRemoving(null)}
          onConfirm={() =>
            void run(() => deleteAvailabilityDate(year, removing.date))
          }
        />
      )}
    </div>
  )
}

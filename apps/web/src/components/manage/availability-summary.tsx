import { MinuteInput } from "@/components/minute-input"
import { useState, type FormEvent } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import type { FormDate } from "@workspace/shared/availability"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { toast } from "@workspace/ui/lib/toast"
import {
  notifyAvailability,
  getAvailabilityDates,
  saveAvailabilityDate,
  deleteAvailabilityDate,
  getAvailabilitySubmissions,
} from "@/api/availability"
import { errorMessage } from "@/api/client"
import { ResponsiveDialog } from "@/components/responsive-overlay"
import { ConfirmDialog } from "@/components/confirm-dialog"
function clock(minute: number) {
  return `${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`
}
function minutes(value: string) {
  const [h = "0", m = "0"] = value.split(":")
  return Number(h) * 60 + Number(m)
}
export function AvailabilitySummary({ year }: { year: number }) {
  const client = useQueryClient()
  const dates = useQuery({
    queryKey: ["availability-dates", year],
    queryFn: () => getAvailabilityDates(year),
  })
  const submissions = useQuery({
    queryKey: ["availability-submissions", year],
    queryFn: () => getAvailabilitySubmissions(year),
  })
  const [editing, setEditing] = useState<FormDate | "new" | null>(null)
  const [removing, setRemoving] = useState<FormDate | null>(null)
  const [selected, setSelected] = useState<string[]>([])
  const [pending, setPending] = useState(false)
  async function run(action: () => Promise<unknown>) {
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
      setEditing(null)
      setRemoving(null)
      setSelected([])
    } catch (error) {
      toast.error(errorMessage(error))
    } finally {
      setPending(false)
    }
  }
  return (
    <div className="space-y-5">
      <nav className="flex gap-4 border-b text-sm">
        <Link to="/manage/shifts" className="pb-3 text-muted-foreground">
          シフト一覧
        </Link>
        <span className="border-b-2 border-foreground pb-3 font-medium">
          シフト希望フォーム
        </span>
      </nav>
      <div className="flex justify-end gap-2">
        <Button
          variant="outline"
          disabled={pending || !dates.data?.dates.some((d) => d.accepting)}
          onClick={() =>
            void run(async () => {
              await notifyAvailability(year, "all")
              toast.success("受付を通知しました。")
            })
          }
        >
          受付を通知する
        </Button>
        <Button onClick={() => setEditing("new")}>日程を追加</Button>
      </div>
      {selected.length > 0 && (
        <div className="flex items-center gap-2 rounded-md bg-muted p-2 text-sm">
          <span className="mr-auto">{selected.length}日選択中</span>
          {[true, false].map((accepting) => (
            <Button
              key={String(accepting)}
              size="sm"
              variant="ghost"
              disabled={pending}
              onClick={() =>
                void run(() =>
                  Promise.all(
                    (
                      dates.data?.dates.filter((date) =>
                        selected.includes(date.date)
                      ) ?? []
                    ).map((date) =>
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
      )}
      <ul className="divide-y border-y">
        {dates.data?.dates.map((date) => (
          <li key={date.date} className="flex min-h-16 items-center gap-3">
            <input
              aria-label={`${date.date}を選択`}
              type="checkbox"
              checked={selected.includes(date.date)}
              onChange={(event) =>
                setSelected(
                  event.target.checked
                    ? [...selected, date.date]
                    : selected.filter((value) => value !== date.date)
                )
              }
            />
            <button
              className="flex-1 py-3 text-left"
              onClick={() => setEditing(date)}
            >
              <span className="block text-sm font-medium">{date.date}</span>
              <span className="text-xs text-muted-foreground">
                {clock(date.startsMinute)}–{clock(date.endsMinute)}
              </span>
            </button>
            <span className="text-xs text-muted-foreground">
              {date.accepting ? "受付中" : "受付終了"}
            </span>
            <Button variant="ghost" size="sm" onClick={() => setRemoving(date)}>
              削除
            </Button>
          </li>
        ))}
      </ul>
      <details>
        <summary className="cursor-pointer py-2 text-sm">提出状況</summary>
        <ul className="divide-y">
          {submissions.data?.progress.map((submission) => (
            <li
              key={submission.memberId}
              className="flex justify-between py-3 text-sm"
            >
              <span>{submission.displayName}</span>
              <span className="text-muted-foreground">
                {submission.complete ? "提出済み" : "未提出"}
              </span>
            </li>
          ))}
        </ul>
        <Button
          variant="ghost"
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
          未提出者にリマインド
        </Button>
      </details>
      {editing && (
        <DateEditor
          key={editing === "new" ? "new" : editing.date}
          date={editing === "new" ? null : editing}
          pending={pending}
          onClose={() => setEditing(null)}
          onSave={(date) => void run(() => saveAvailabilityDate(year, date))}
        />
      )}
      {removing && (
        <ConfirmDialog
          title="日程を削除しますか"
          description="フォームから非表示にします。過去の提出内容とシフトは保持されます。"
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
function DateEditor({
  date,
  pending,
  onClose,
  onSave,
}: {
  date: FormDate | null
  pending: boolean
  onClose: () => void
  onSave: (date: Omit<FormDate, "version">) => void
}) {
  const [day, setDay] = useState(date?.date ?? ""),
    [from, setFrom] = useState(clock(date?.startsMinute ?? 540)),
    [to, setTo] = useState(date?.endsMinute ?? 1080),
    [accepting, setAccepting] = useState(date?.accepting ?? false)
  function submit(event: FormEvent) {
    event.preventDefault()
    onSave({
      date: day,
      startsMinute: minutes(from),
      endsMinute: to,
      accepting,
    })
  }
  return (
    <ResponsiveDialog
      open
      title={date ? "日程を編集" : "日程を追加"}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <form className="space-y-4" onSubmit={submit}>
        <Input
          type="date"
          aria-label="日付"
          required
          disabled={date !== null}
          value={day}
          onChange={(event) => setDay(event.target.value)}
        />
        <div className="flex items-center gap-2">
          <Input
            type="time"
            aria-label="開始時刻"
            required
            value={from}
            onChange={(event) => setFrom(event.target.value)}
          />
          <span>–</span>
          <MinuteInput label="終了時刻" value={to} onChange={setTo} />
        </div>
        <label className="flex justify-between text-sm">
          希望を受け付ける
          <input
            type="checkbox"
            checked={accepting}
            onChange={(event) => setAccepting(event.target.checked)}
          />
        </label>
        <Button disabled={pending}>保存</Button>
      </form>
    </ResponsiveDialog>
  )
}

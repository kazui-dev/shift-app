import { useState } from "react"
import { ChevronDown, ChevronUp, Plus, Trash2, X } from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import { toast } from "@workspace/ui/lib/toast"
import { Input } from "@workspace/ui/components/input"
import type { ActivityEditorInput } from "@workspace/shared/shifts"
import { japanDateTime, japanLocalDateTime } from "@/lib/japan-time"
import type { EditorData } from "./time-grid"

export type ShiftSelection = {
  memberId: string
  slotId: string | null
  startsAt: string
  endsAt: string
}
function local(value: string) {
  const date = japanDateTime(value)
  return `${String(date.hour).padStart(2, "0")}:${String(date.minute).padStart(2, "0")}`
}
export function ShiftSelectionPanel({
  selection,
  slots,
  startsAt,
  endsAt,
  data,
  pending,
  onClose,
  onApply,
  onRemove,
}: {
  selection: ShiftSelection
  slots: ActivityEditorInput["slots"]
  startsAt: string
  endsAt: string
  data: EditorData
  pending: boolean
  onClose: () => void
  onApply: (selection: ShiftSelection) => string | null
  onRemove: (slotId: string) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [adding, setAdding] = useState(false)
  const member = data.members.find((item) => item.id === selection.memberId)
  const shifts = slots.filter((slot) =>
    slot.memberIds.includes(selection.memberId)
  )
  const all = [
    ...shifts,
    ...data.otherAssignments.filter(
      (item) => item.memberId === selection.memberId
    ),
  ]
  const dayStart = japanLocalDateTime(`${japanDateTime(startsAt).date}T00:00`)
  const minutes = (from: number, to: number) =>
    all.reduce(
      (total, item) =>
        total +
        Math.max(
          0,
          Math.min(to, Date.parse(item.endsAt)) -
            Math.max(from, Date.parse(item.startsAt))
        ) /
          60000,
      0
    )
  const duration = (value: number) =>
    `${Math.floor(value / 60)}時間${value % 60 ? `${value % 60}分` : ""}`
  return (
    <aside
      aria-label="シフトの編集パネル"
      className="flex min-h-0 min-w-0 shrink-0 flex-col border-t bg-background lg:h-full lg:w-72 lg:border-t-0 lg:border-l"
    >
      <header className="flex min-h-12 shrink-0 items-center gap-2 px-4">
        <h2 className="min-w-0 flex-1 truncate text-sm font-semibold">
          {member?.displayName}
        </h2>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={
            expanded ? "編集パネルを小さくする" : "編集パネルを広げる"
          }
          className="lg:hidden"
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? <ChevronDown /> : <ChevronUp />}
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="編集パネルを閉じる"
          onClick={onClose}
        >
          <X />
        </Button>
      </header>
      <div
        className={`min-h-0 space-y-4 overflow-y-auto px-4 pb-4 ${expanded ? "max-h-[55dvh]" : "max-h-[30dvh]"} lg:max-h-none`}
      >
        <div className="space-y-2 text-xs text-muted-foreground">
          <p>希望時間</p>
          {data.availability
            .filter((item) => item.memberId === selection.memberId)
            .map((item) => (
              <p key={item.startsAt}>
                {local(item.startsAt)}–{local(item.endsAt)}
              </p>
            ))}
          {!data.submittedMemberIds.includes(selection.memberId) && (
            <p>未回答</p>
          )}
        </div>
        <div className="space-y-2 border-t pt-3">
          <p className="text-xs text-muted-foreground">シフト</p>
          {shifts.map((slot) => (
            <ShiftTimeRow
              key={`${slot.id}-${slot.startsAt}-${slot.endsAt}`}
              value={{
                memberId: selection.memberId,
                slotId: slot.id,
                startsAt: slot.startsAt,
                endsAt: slot.endsAt,
              }}
              pending={pending}
              onApply={onApply}
              onRemove={() => onRemove(slot.id)}
            />
          ))}
          {adding && (
            <ShiftTimeRow
              key="new"
              value={{
                memberId: selection.memberId,
                slotId: null,
                startsAt,
                endsAt,
              }}
              pending={pending}
              onApply={(value) => {
                const error = onApply(value)
                if (!error) setAdding(false)
                return error
              }}
              onRemove={() => setAdding(false)}
            />
          )}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-xs text-muted-foreground"
            disabled={pending || adding}
            onClick={() => setAdding(true)}
          >
            <Plus className="size-3.5" />
            追加
          </Button>
        </div>
        <details className="text-xs text-muted-foreground">
          <summary className="cursor-pointer">合計時間</summary>
          <p className="mt-2">
            当日：{duration(minutes(dayStart, dayStart + 86400000))}
          </p>
          <p className="mt-1">
            年度：
            {duration(
              minutes(Number.NEGATIVE_INFINITY, Number.POSITIVE_INFINITY)
            )}
          </p>
        </details>
      </div>
    </aside>
  )
}
function ShiftTimeRow({
  value,
  pending,
  onApply,
  onRemove,
}: {
  value: ShiftSelection
  pending: boolean
  onApply: (selection: ShiftSelection) => string | null
  onRemove: () => void
}) {
  const [from, setFrom] = useState(value.slotId ? local(value.startsAt) : "")
  const [to, setTo] = useState(value.slotId ? local(value.endsAt) : "")
  function commit() {
    if (!from && !to) return
    if (
      value.slotId &&
      from === local(value.startsAt) &&
      to === local(value.endsAt)
    )
      return
    if (
      !/^([01]\d|2[0-3]):[0-5]\d$/.test(from) ||
      !/^([01]\d|2[0-3]):[0-5]\d$/.test(to)
    ) {
      toast.error("時刻は09:00の形式で入力してください。", { id: "shift-time" })
      return
    }
    const start = japanLocalDateTime(
      `${japanDateTime(value.startsAt).date}T${from}`
    )
    const end = japanLocalDateTime(`${japanDateTime(value.endsAt).date}T${to}`)
    if (start >= end) {
      toast.error("終了は開始より後にしてください。", { id: "shift-time" })
      return
    }
    const error = onApply({
      ...value,
      startsAt: new Date(start).toISOString(),
      endsAt: new Date(end).toISOString(),
    })
    if (error) toast.error(error, { id: "shift-time" })
    else toast.dismiss("shift-time")
  }
  return (
    <form
      data-slot-editor={value.slotId}
      className="space-y-1"
      onSubmit={(event) => {
        event.preventDefault()
        commit()
      }}
    >
      <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_2rem] items-center gap-2">
        <Input
          aria-label={
            value.slotId
              ? `${local(value.startsAt)}からのシフトの開始`
              : "追加するシフトの開始"
          }
          type="text"
          maxLength={5}
          value={from}
          disabled={pending}
          onBlur={(event) => {
            if (
              !(event.relatedTarget instanceof Node) ||
              !event.currentTarget.form?.contains(event.relatedTarget)
            )
              commit()
          }}
          onChange={(event) => setFrom(event.target.value)}
          className="min-w-0 tabular-nums"
        />
        <span aria-hidden="true" className="text-xs text-muted-foreground">
          〜
        </span>
        <Input
          aria-label={
            value.slotId
              ? `${local(value.startsAt)}からのシフトの終了`
              : "追加するシフトの終了"
          }
          type="text"
          maxLength={5}
          value={to}
          disabled={pending}
          onBlur={(event) => {
            if (
              !(event.relatedTarget instanceof Node) ||
              !event.currentTarget.form?.contains(event.relatedTarget)
            )
              commit()
          }}
          onChange={(event) => setTo(event.target.value)}
          className="min-w-0 tabular-nums"
        />
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={
            value.slotId
              ? `${local(value.startsAt)}–${local(value.endsAt)}のシフトを削除`
              : "追加を取り消す"
          }
          disabled={pending}
          onClick={onRemove}
        >
          {value.slotId ? (
            <Trash2 className="size-3.5" />
          ) : (
            <X className="size-3.5" />
          )}
        </Button>
      </div>
    </form>
  )
}

import { memberAvailability } from "./member-availability"
import { useId, useLayoutEffect, useRef, useState } from "react"
import { Plus, X } from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import {
  japanDateTime,
  japanInputValue,
  japanLocalDateTime,
  japanTime,
} from "@workspace/shared/japan-time"
import type { ActivityEditorInput } from "@workspace/shared/shifts"
import type { EditorData } from "../editor-data"
import type { Assignment } from "./assign-member"

export type ShiftSelection = Assignment
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
  const dialog = useRef<HTMLDialogElement>(null)
  const member = data.members.find((item) => item.id === selection.memberId)
  const shifts = slots.filter((slot) =>
    slot.memberIds.includes(selection.memberId)
  )
  const [adding, setAdding] = useState(selection.slotId === null)
  useLayoutEffect(() => {
    const element = dialog.current
    if (!element) return undefined
    const anchor =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null
    element.showModal()
    const place = () => {
      const rect = anchor?.getBoundingClientRect()
      const width = element.offsetWidth,
        height = element.offsetHeight
      const center = window.innerWidth <= 640 || !rect
      element.style.left = `${center ? (window.innerWidth - width) / 2 : Math.max(16, Math.min(rect.left, window.innerWidth - width - 16))}px`
      element.style.top = `${Math.max(16, center ? (window.innerHeight - height) / 2 : rect.bottom + height + 8 < window.innerHeight ? rect.bottom + 8 : rect.top - height - 8)}px`
    }
    place()
    const observer = new ResizeObserver(place)
    observer.observe(element)
    window.addEventListener("resize", place)
    return () => {
      observer.disconnect()
      window.removeEventListener("resize", place)
      element.close()
      requestAnimationFrame(() => {
        if (!element.open && anchor?.isConnected)
          anchor.focus({ preventScroll: true })
      })
    }
  }, [])
  const available = data.availability.filter(
    (item) => item.memberId === selection.memberId
  )
  return (
    <dialog
      ref={dialog}
      className="shift-time-dialog"
      aria-labelledby="shift-time-title"
      onCancel={(event) => {
        event.preventDefault()
        onClose()
      }}
    >
      <div className="mb-4 flex items-start justify-between gap-2">
        <div>
          <h3 id="shift-time-title" className="text-sm font-semibold">
            {member?.displayName}{" "}
            <span className="font-normal text-muted-foreground">
              勤務を編集
            </span>
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            希望：
            {available
              .map(
                (item) =>
                  `${japanTime(item.startsAt)}–${japanTime(item.endsAt)}`
              )
              .join("、") ||
              (memberAvailability(data, selection, selection.memberId) !==
              "unanswered"
                ? "参加不可"
                : "未回答")}
          </p>
        </div>
        <Button
          variant="outline"
          size="icon-sm"
          aria-label="勤務時間の編集を閉じる"
          onClick={onClose}
        >
          <X />
        </Button>
      </div>
      <div className="space-y-4">
        {shifts.map((slot) => (
          <ShiftTimeRow
            key={`${slot.id}-${slot.startsAt}-${slot.endsAt}`}
            value={{ ...slot, memberId: selection.memberId, slotId: slot.id }}
            pending={pending}
            onApply={onApply}
            onClose={onClose}
            onRemove={() => onRemove(slot.id)}
          />
        ))}
        {adding && (
          <ShiftTimeRow
            value={{
              ...selection,
              slotId: null,
              startsAt: selection.startsAt || startsAt,
              endsAt: selection.endsAt || endsAt,
            }}
            pending={pending}
            onApply={onApply}
            onClose={onClose}
            onRemove={() => setAdding(false)}
          />
        )}
        {!adding && (
          <Button
            variant="outline"
            size="sm"
            disabled={pending}
            onClick={() => setAdding(true)}
          >
            <Plus />
            勤務を追加
          </Button>
        )}
      </div>
    </dialog>
  )
}
function ShiftTimeRow({
  value,
  pending,
  onApply,
  onRemove,
  onClose,
}: {
  value: ShiftSelection
  pending: boolean
  onApply: (selection: ShiftSelection) => string | null
  onRemove: () => void
  onClose: () => void
}) {
  const id = useId()
  const [from, setFrom] = useState(japanInputValue(value.startsAt).slice(11))
  const [to, setTo] = useState(japanInputValue(value.endsAt).slice(11))
  const [error, setError] = useState<string | null>(null)
  function commit() {
    const start = japanLocalDateTime(
      `${japanDateTime(value.startsAt).date}T${from}`
    )
    const end = japanLocalDateTime(`${japanDateTime(value.endsAt).date}T${to}`)
    if (!Number.isFinite(start) || !Number.isFinite(end) || start >= end) {
      setError("終了は開始より後にしてください。")
      return
    }
    setError(
      onApply({
        ...value,
        startsAt: new Date(start).toISOString(),
        endsAt: new Date(end).toISOString(),
      })
    )
  }
  return (
    <form
      data-slot-editor={value.slotId}
      onSubmit={(event) => {
        event.preventDefault()
        commit()
      }}
      className="space-y-3 border-t pt-3"
    >
      <fieldset disabled={pending} className="flex items-end gap-2">
        <label
          htmlFor={`${id}-start`}
          className="min-w-0 flex-1 text-xs text-muted-foreground"
        >
          開始
          <Input
            id={`${id}-start`}
            aria-label="勤務の開始"
            type="time"
            step={60}
            required
            value={from}
            onChange={(event) => setFrom(event.target.value)}
            className="mt-2 h-11 text-base text-foreground"
          />
        </label>
        <span className="pb-3">–</span>
        <label
          htmlFor={`${id}-end`}
          className="min-w-0 flex-1 text-xs text-muted-foreground"
        >
          終了
          <Input
            id={`${id}-end`}
            aria-label="勤務の終了"
            type="time"
            step={60}
            required
            value={to}
            onChange={(event) => setTo(event.target.value)}
            className="mt-2 h-11 text-base text-foreground"
          />
        </label>
      </fieldset>
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
      <div className="flex justify-between gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={pending}
          onClick={onRemove}
        >
          {value.slotId ? "割当を外す" : "追加を取り消す"}
        </Button>
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            取消
          </Button>
          <Button type="submit" variant="outline" size="sm" disabled={pending}>
            適用
          </Button>
        </div>
      </div>
    </form>
  )
}

import { AssignmentEditWarning } from "./assignment-edit-warning"
import { ShiftPopover } from "./shift-popover"
import type { ShiftAnchor } from "./shift-anchor"
import { memberAvailability } from "./member-availability"
import { useId, useState } from "react"
import { X } from "lucide-react"
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
import { SelectField } from "@/components/select-field"
import { assignmentEditWarning } from "./transfer-assignment"

export type ShiftSelection = Assignment
export function ShiftSelectionPanel({
  anchor,
  ...props
}: Parameters<typeof ShiftSelectionForm>[0] & { anchor: ShiftAnchor }) {
  const { selection } = props
  return (
    <ShiftPopover
      anchor={anchor}
      aria-labelledby="shift-time-title"
      onClose={props.onClose}
    >
      <ShiftSelectionForm
        key={`${selection.memberId}-${selection.slotId ?? "new"}-${selection.startsAt}-${selection.endsAt}`}
        {...props}
      />
    </ShiftPopover>
  )
}
function ShiftSelectionForm({
  selection,
  slots,
  startsAt,
  endsAt,
  data,
  pending,
  onClose,
  onApply,
  onRemove,
  activities,
  error,
}: {
  selection: ShiftSelection
  slots: ActivityEditorInput["slots"]
  startsAt: string
  endsAt: string
  data: EditorData
  pending: boolean
  onClose: () => void
  onApply: (
    selection: ShiftSelection,
    activityId?: string
  ) => string | null | Promise<string | null>
  onRemove: (slotId: string) => void
  activities?: { value: string; label: string }[] | undefined
  error?: string | undefined
}) {
  const member = data.members.find((item) => item.id === selection.memberId)
  const selectedSlot = slots.find(
    (slot) =>
      slot.id === selection.slotId &&
      slot.memberIds.includes(selection.memberId)
  )
  const available = data.availability.filter(
    (item) => item.memberId === selection.memberId
  )
  return (
    <>
      <div className="mb-4 flex items-start justify-between gap-2">
        <div>
          <h3 id="shift-time-title" className="text-sm font-semibold">
            {selection.slotId ? member?.displayName : "シフトを追加"}
          </h3>
          {!selection.slotId && (
            <p className="mt-1 text-sm">{member?.displayName}</p>
          )}
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
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        {selectedSlot && (
          <ShiftTimeRow
            key={`${selectedSlot.id}-${selectedSlot.startsAt}-${selectedSlot.endsAt}`}
            value={{
              ...selectedSlot,
              memberId: selection.memberId,
              slotId: selectedSlot.id,
            }}
            pending={pending}
            onApply={onApply}
            onClose={onClose}
            onRemove={() => onRemove(selectedSlot.id)}
            activityId={data.activity.id}
            activities={activities}
            warning={assignmentEditWarning(data, {
              ...selectedSlot,
              slotId: selectedSlot.id,
              memberId: selection.memberId,
            })}
          />
        )}
        {selection.slotId === null && (
          <ShiftTimeRow
            value={{
              ...selection,
              startsAt: selection.startsAt || startsAt,
              endsAt: selection.endsAt || endsAt,
            }}
            pending={pending}
            onApply={onApply}
            onClose={onClose}
            onRemove={onClose}
            activityId={data.activity.id}
            activities={activities}
          />
        )}
      </div>
    </>
  )
}
function ShiftTimeRow({
  value,
  pending,
  onApply,
  onRemove,
  onClose,
  activityId,
  activities,
  warning = null,
}: {
  value: ShiftSelection
  pending: boolean
  onApply: (
    selection: ShiftSelection,
    activityId?: string
  ) => string | null | Promise<string | null>
  onRemove: () => void
  onClose: () => void
  activityId: string
  activities?: { value: string; label: string }[] | undefined
  warning?: string | null
}) {
  const id = useId()
  const [from, setFrom] = useState(japanInputValue(value.startsAt).slice(11))
  const [to, setTo] = useState(japanInputValue(value.endsAt).slice(11))
  const [error, setError] = useState<string | null>(null)
  const [destination, setDestination] = useState(activityId)
  const [applying, setApplying] = useState(false)
  const changed =
    destination !== activityId ||
    from !== japanInputValue(value.startsAt).slice(11) ||
    to !== japanInputValue(value.endsAt).slice(11)
  const unchangedEdit = value.slotId !== null && !changed
  async function commit() {
    if (unchangedEdit || pending || applying) return
    const start = japanLocalDateTime(
      `${japanDateTime(value.startsAt).date}T${from}`
    )
    const end = japanLocalDateTime(`${japanDateTime(value.endsAt).date}T${to}`)
    if (!Number.isFinite(start) || !Number.isFinite(end) || start >= end) {
      setError("終了は開始より後にしてください。")
      return
    }
    setApplying(true)
    try {
      setError(
        await onApply(
          {
            ...value,
            startsAt: new Date(start).toISOString(),
            endsAt: new Date(end).toISOString(),
          },
          destination
        )
      )
    } finally {
      setApplying(false)
    }
  }
  return (
    <form
      data-slot-editor={value.slotId}
      onSubmit={(event) => {
        event.preventDefault()
        void commit()
      }}
      className="space-y-3 border-t pt-3"
    >
      <AssignmentEditWarning message={warning} />
      {activities && (
        <SelectField
          aria-label="シフト"
          searchable
          value={destination}
          options={activities}
          disabled={pending || applying}
          onValueChange={setDestination}
        />
      )}
      <fieldset disabled={pending || applying} className="flex items-end gap-2">
        <label
          htmlFor={`${id}-start`}
          className="min-w-0 flex-1 text-xs text-muted-foreground"
        >
          開始
          <Input
            controlSize="lg"
            id={`${id}-start`}
            aria-label="勤務の開始"
            type="time"
            step={60}
            required
            value={from}
            onChange={(event) => setFrom(event.target.value)}
            className="mt-2 text-base text-foreground"
          />
        </label>
        <span className="pb-3">–</span>
        <label
          htmlFor={`${id}-end`}
          className="min-w-0 flex-1 text-xs text-muted-foreground"
        >
          終了
          <Input
            controlSize="lg"
            id={`${id}-end`}
            aria-label="勤務の終了"
            type="time"
            step={60}
            required
            value={to}
            onChange={(event) => setTo(event.target.value)}
            className="mt-2 text-base text-foreground"
          />
        </label>
      </fieldset>
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
      <div className="flex justify-between gap-2">
        {value.slotId !== null && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={pending || applying}
            onClick={onRemove}
          >
            割当を外す
          </Button>
        )}
        <div className="ml-auto flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={unchangedEdit || pending || applying}
            onClick={onClose}
          >
            キャンセル
          </Button>
          <Button
            type="submit"
            variant="outline"
            size="sm"
            disabled={unchangedEdit || pending || applying}
          >
            反映
          </Button>
        </div>
      </div>
    </form>
  )
}

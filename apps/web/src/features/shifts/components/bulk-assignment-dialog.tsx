import { useId, useState } from "react"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import {
  japanDateTime,
  japanInputValue,
  japanLocalDateTime,
  japanTime,
} from "@workspace/shared/japan-time"
import type { ActivityEditorInput } from "@workspace/shared/shifts"
import { ResponsiveDialog } from "@/components/responsive-overlay"
import type { EditorData } from "../editor-data"
import {
  assignMembers,
  reviewAssignments,
  type AssignmentWindow,
} from "./bulk-assignment"

export function BulkAssignmentDialog({
  data,
  memberIds: selected,
  plan,
  onApply,
  onClose,
}: {
  memberIds: string[]
  data: EditorData
  plan: ActivityEditorInput
  onApply: (
    plan: ActivityEditorInput,
    acknowledged: EditorData["availability"]
  ) => void
  onClose: () => void
}) {
  const fieldId = useId()
  const [from, setFrom] = useState(japanInputValue(plan.startsAt).slice(11, 16))
  const [to, setTo] = useState(japanInputValue(plan.endsAt).slice(11, 16))
  const [review, setReview] = useState<AssignmentWindow | null>(null)
  const [excluded, setExcluded] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const rows = review ? reviewAssignments(data, plan, selected, review) : []
  const included = rows.filter(
    (row) => !row.blocked && !excluded.includes(row.memberId)
  )
  function confirm() {
    const start = japanLocalDateTime(
      `${japanDateTime(plan.startsAt).date}T${from}`
    )
    const end = japanLocalDateTime(`${japanDateTime(plan.endsAt).date}T${to}`)
    if (!Number.isFinite(start) || !Number.isFinite(end) || start >= end) {
      setError("終了は開始より後にしてください。")
      return
    }
    if (start < Date.parse(plan.startsAt) || end > Date.parse(plan.endsAt)) {
      setError("シフトの開始・終了の範囲内で指定してください。")
      return
    }
    setError(null)
    setExcluded([])
    setReview({
      startsAt: new Date(start).toISOString(),
      endsAt: new Date(end).toISOString(),
    })
  }
  return (
    <ResponsiveDialog
      open
      title="一括割当"
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
      className="md:max-w-xl"
      bodyClassName="flex min-h-0 flex-col gap-4 py-4"
    >
      {review ? (
        <>
          <p className="text-sm tabular-nums">
            {japanTime(review.startsAt)}〜{japanTime(review.endsAt)} ·{" "}
            {included.length}人
          </p>
          <p className="text-xs text-muted-foreground">
            未回答・参加不可・希望時間外も、チェックを残すと割り当てます。勤務が重なる人と割当済みの人は除外します。
          </p>
          <div className="max-h-[40dvh] divide-y overflow-y-auto">
            {rows.map((row) => (
              <label
                key={row.memberId}
                className="flex items-center gap-3 py-2 text-sm"
              >
                <input
                  type="checkbox"
                  aria-label={`${row.name}に割り当てる`}
                  disabled={row.blocked}
                  checked={!row.blocked && !excluded.includes(row.memberId)}
                  onChange={(event) =>
                    setExcluded((current) =>
                      event.target.checked
                        ? current.filter((id) => id !== row.memberId)
                        : [...current, row.memberId]
                    )
                  }
                />
                <span className="min-w-0 flex-1 truncate">{row.name}</span>
                {row.reason && (
                  <span className="text-xs text-muted-foreground">
                    {row.reason}
                  </span>
                )}
              </label>
            ))}
          </div>
          {error && (
            <p role="alert" className="text-xs text-destructive">
              {error}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setReview(null)
                setError(null)
              }}
            >
              戻る
            </Button>
            <Button
              variant="outline"
              disabled={!included.length}
              onClick={() => {
                const result = assignMembers(
                  data,
                  plan,
                  included.map((row) => row.memberId),
                  review
                )
                if ("error" in result) {
                  setError(result.error)
                  return
                }
                onApply(
                  result.plan,
                  included.map((row) => ({ memberId: row.memberId, ...review }))
                )
                onClose()
              }}
            >
              {included.length}人に適用
            </Button>
          </div>
        </>
      ) : (
        <>
          <div className="flex items-end gap-2">
            <label
              htmlFor={`${fieldId}-start`}
              className="flex-1 text-xs text-muted-foreground"
            >
              開始
              <Input
                className="mt-2"
                id={`${fieldId}-start`}
                aria-label="一括割当の開始"
                type="time"
                step={60}
                required
                value={from}
                onChange={(event) => setFrom(event.target.value)}
              />
            </label>
            <span className="pb-2">〜</span>
            <label
              htmlFor={`${fieldId}-end`}
              className="flex-1 text-xs text-muted-foreground"
            >
              終了
              <Input
                className="mt-2"
                id={`${fieldId}-end`}
                aria-label="一括割当の終了"
                type="time"
                step={60}
                required
                value={to}
                onChange={(event) => setTo(event.target.value)}
              />
            </label>
          </div>
          {error && (
            <p role="alert" className="text-xs text-destructive">
              {error}
            </p>
          )}
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm tabular-nums">
              {selected.length}人選択
            </span>
            <Button
              variant="outline"
              disabled={!selected.length}
              onClick={confirm}
            >
              確認
            </Button>
          </div>
        </>
      )}
    </ResponsiveDialog>
  )
}

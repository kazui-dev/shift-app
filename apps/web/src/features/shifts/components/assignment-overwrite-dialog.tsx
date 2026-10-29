import type {
  ActivityEditorInput,
  AssignmentOverwriteReview,
} from "@workspace/shared/shifts"
import {
  japanDateTime,
  japanDateWeekday,
  japanTime,
} from "@workspace/shared/japan-time"
import { Button } from "@workspace/ui/components/button"
import { ResponsiveDialog } from "@/components/responsive-overlay"

function timeRange(startsAt: string, endsAt: string) {
  const endDate =
    japanDateTime(startsAt).date === japanDateTime(endsAt).date
      ? ""
      : `${japanDateWeekday(endsAt)} `
  return `${japanDateWeekday(startsAt)} ${japanTime(startsAt)}–${endDate}${japanTime(endsAt)}`
}
/** Show the exact intervals overwritten in the existing assignment. */
function overlapTimes(change: AssignmentOverwriteReview["changes"][number]) {
  let cursor = Date.parse(change.startsAt)
  const removed: { startsAt: string; endsAt: string }[] = []
  for (const piece of [...change.remaining].sort(
    (a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt)
  )) {
    const start = Date.parse(piece.startsAt)
    if (cursor < start)
      removed.push({
        startsAt: new Date(cursor).toISOString(),
        endsAt: piece.startsAt,
      })
    cursor = Date.parse(piece.endsAt)
  }
  if (cursor < Date.parse(change.endsAt))
    removed.push({
      startsAt: new Date(cursor).toISOString(),
      endsAt: change.endsAt,
    })
  return removed
}
export function AssignmentOverwriteDialog({
  review,
  plan,
  pending,
  onCancel,
  onConfirm,
}: {
  review: AssignmentOverwriteReview
  plan: ActivityEditorInput
  pending: boolean
  onCancel: () => void
  onConfirm: () => void
}) {
  const additions = plan.slots.flatMap((slot) =>
    slot.memberIds.flatMap((memberId) => {
      const change = review.changes.find(
        (item) =>
          item.memberId === memberId &&
          Date.parse(item.startsAt) < Date.parse(slot.endsAt) &&
          Date.parse(item.endsAt) > Date.parse(slot.startsAt)
      )
      return change
        ? [{ ...slot, memberId, memberName: change.memberName }]
        : []
    })
  )
  const overlaps = [
    ...new Map(
      review.changes
        .flatMap(overlapTimes)
        .map((piece) => [`${piece.startsAt}:${piece.endsAt}`, piece])
    ).values(),
  ].sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt))
  const blocked = review.changes.some((change) => change.blockedReason !== null)
  return (
    <ResponsiveDialog
      open
      title="上書き保存しますか？"
      onOpenChange={(open) => {
        if (!open && !pending) onCancel()
      }}
      className="sm:max-w-lg"
    >
      <div className="space-y-4 max-md:pt-4">
        <div className="max-h-[50dvh] space-y-4 overflow-y-auto md:max-h-[min(calc(70dvh_-_9rem),26rem)]">
          <div className="space-y-1 rounded-lg bg-muted px-4 py-3">
            <p className="text-xs text-muted-foreground">重複時間</p>
            {overlaps.map((piece) => (
              <p
                key={`${piece.startsAt}:${piece.endsAt}`}
                className="text-sm font-medium tabular-nums"
              >
                {timeRange(piece.startsAt, piece.endsAt)}
              </p>
            ))}
          </div>
          <p className="text-sm font-medium">上書きされる勤務</p>
          <ul className="divide-y rounded-lg border">
            {review.changes.map((change) => (
              <li
                key={change.assignmentId}
                className={
                  review.changes.length > 1
                    ? "space-y-1 px-4 py-2"
                    : "space-y-3 p-4"
                }
              >
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span className="text-sm font-semibold">
                    {change.activityName}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {change.memberName}
                  </span>
                </div>
                <p className="text-sm tabular-nums">
                  {timeRange(change.startsAt, change.endsAt)}
                </p>
                {change.blockedReason && (
                  <p role="alert" className="text-sm text-destructive">
                    {change.blockedReason}
                  </p>
                )}
              </li>
            ))}
          </ul>
          <p className="text-sm font-medium">追加される勤務</p>
          <ul className="divide-y rounded-lg border">
            {additions.map((item) => (
              <li
                key={`${item.id}:${item.memberId}`}
                className={
                  review.changes.length > 1
                    ? "space-y-1 px-4 py-2"
                    : "space-y-3 p-4"
                }
              >
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span className="text-sm font-semibold">{plan.name}</span>
                  <span className="text-sm text-muted-foreground">
                    {item.memberName}
                  </span>
                </div>
                <p className="text-sm tabular-nums">
                  {timeRange(item.startsAt, item.endsAt)}
                </p>
              </li>
            ))}
          </ul>
        </div>
        <div className="flex justify-end gap-2 border-t pt-4">
          <Button variant="outline" disabled={pending} onClick={onCancel}>
            キャンセル
          </Button>
          <Button disabled={pending || blocked} onClick={onConfirm}>
            {pending ? "上書き保存中…" : "上書き保存"}
          </Button>
        </div>
      </div>
    </ResponsiveDialog>
  )
}

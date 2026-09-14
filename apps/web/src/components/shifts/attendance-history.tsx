import { useQuery } from "@tanstack/react-query"
import { LoadingState } from "@/components/page-layout"
import { japanMonthDayTime, japanTime } from "@workspace/shared/japan-time"
import { getAttendanceEvents } from "@/api/assignments"
import { ResponsiveDialog } from "@/components/responsive-overlay"
import { keys } from "@/data/keys"

type AttendanceEvent = Awaited<
  ReturnType<typeof getAttendanceEvents>
>["events"][number]

/** What one change did, as a line of the history. */
function eventSummary(event: AttendanceEvent) {
  switch (event.action) {
    case "late":
      return event.expectedAt
        ? `遅刻（${japanTime(event.expectedAt)}ごろ到着予定）`
        : "遅刻（到着時刻は未定）"
    case "absent":
      return "欠勤"
    case "withdrawn":
      return "遅刻・欠勤を取り消し"
    case "checked_in":
      return event.checkedInAt ? `${japanTime(event.checkedInAt)} 出勤` : "出勤"
    case "corrected":
      return `出勤時刻を修正 ${event.previousCheckedInAt ? japanTime(event.previousCheckedInAt) : "記録なし"} → ${event.checkedInAt ? japanTime(event.checkedInAt) : ""}`
    default:
      return "対応済み"
  }
}

export function AttendanceHistory({
  id,
  onClose,
}: {
  id: string
  onClose: () => void
}) {
  const query = useQuery({
    queryKey: keys.attendanceEvents(id),
    queryFn: () => getAttendanceEvents(id),
  })
  return (
    <ResponsiveDialog
      open
      title="勤怠の履歴"
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      {query.isPending && <LoadingState />}
      {query.data?.events.length === 0 && (
        <p className="text-sm text-muted-foreground">履歴はありません。</p>
      )}
      <ul className="divide-y">
        {query.data?.events.map((event) => (
          <li key={event.id} className="space-y-1 py-3 text-sm">
            <p>{eventSummary(event)}</p>
            {event.reason && (
              <p className="whitespace-pre-wrap text-muted-foreground">
                {event.reason}
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              {event.actor} · {japanMonthDayTime(event.createdAt)}
            </p>
          </li>
        ))}
      </ul>
    </ResponsiveDialog>
  )
}

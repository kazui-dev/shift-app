import { useQuery } from "@tanstack/react-query"
import { LoadingState } from "@/components/page-layout"
import { japanMonthDayTime, japanTime } from "@workspace/shared/japan-time"
import { getAttendanceEvents, getReportEvents } from "@/api/assignments"
import { ResponsiveDialog } from "@/components/responsive-overlay"
import { keys } from "@/data/keys"

export function ReportHistory({
  id,
  onClose,
}: {
  id: string
  onClose: () => void
}) {
  const query = useQuery({
    queryKey: keys.reportEvents(id),
    queryFn: () => getReportEvents(id),
  })
  return (
    <ResponsiveDialog
      open
      title="連絡の履歴"
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <ul className="space-y-4">
        {query.data?.events.map((e) => (
          <li key={e.id} className="text-sm">
            <p>
              {e.actor} ·{" "}
              {e.action === "submitted"
                ? "送信・修正"
                : e.action === "resolved"
                  ? "確認"
                  : "取り消し"}{" "}
              · {japanTime(e.createdAt)}
            </p>
            <HistoryDetails details={e.details} />
          </li>
        ))}
      </ul>
    </ResponsiveDialog>
  )
}
function HistoryDetails({ details }: { details: string }) {
  try {
    const value: unknown = JSON.parse(details)
    return typeof value === "object" &&
      value !== null &&
      "message" in value &&
      typeof value.message === "string" ? (
      <p className="mt-1 whitespace-pre-wrap text-muted-foreground">
        {value.message}
      </p>
    ) : null
  } catch {
    return null
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
      title="出勤の修正履歴"
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      {query.isPending && <LoadingState />}
      {query.data?.events.length === 0 && (
        <p className="text-sm text-muted-foreground">修正履歴はありません。</p>
      )}
      <ul className="divide-y">
        {query.data?.events.map((event) => (
          <li key={event.id} className="space-y-1 py-3 text-sm">
            <p>
              {event.before ? japanTime(event.before) : "記録なし"} →{" "}
              {japanTime(event.after)}
            </p>
            <p>{event.reason}</p>
            <p className="text-xs text-muted-foreground">
              {event.actor} · {japanMonthDayTime(event.createdAt)}
            </p>
          </li>
        ))}
      </ul>
    </ResponsiveDialog>
  )
}

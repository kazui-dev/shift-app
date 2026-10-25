import { Link } from "@tanstack/react-router"
import { Megaphone, MessageSquare } from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import type { CalendarAssignment } from "../api/assignments"

export function CalendarNotices({
  assignment,
  onOpen,
  height,
}: {
  assignment: CalendarAssignment
  onOpen: () => void
  height: number
}) {
  if (!assignment.notices?.length) return null
  if (height < 100)
    return (
      <button
        type="button"
        aria-label={`${assignment.activityName}の重要な連絡事項を確認`}
        onClick={onOpen}
        className="absolute top-1.5 right-24 z-10 rounded p-1 text-foreground"
      >
        <Megaphone className="size-4" />
      </button>
    )
  return (
    <div className="pointer-events-none absolute inset-x-3 top-12 bottom-1.5 z-10 [scrollbar-width:thin] space-y-2 overflow-y-auto pl-2.5 text-xs">
      <button
        type="button"
        aria-label={`${assignment.activityName}の重要な連絡事項を確認`}
        onClick={onOpen}
        className="pointer-events-auto block w-full space-y-1 text-left"
      >
        {assignment.notices.map((notice) => (
          <span
            key={notice.id}
            className="flex items-start gap-1 px-1 py-1 font-medium text-foreground"
          >
            <Megaphone className="mt-0.5 size-3 shrink-0" />
            <span className="line-clamp-2">{notice.content}</span>
          </span>
        ))}
      </button>
    </div>
  )
}

export function AttendanceNotices({
  assignment,
}: {
  assignment: CalendarAssignment
}) {
  const roomId = assignment.roomId
  return (
    <div className="space-y-4">
      {(assignment.notices ?? []).map((notice) => (
        <section
          key={notice.id}
          aria-label="重要な連絡事項"
          className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-amber-950 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100"
        >
          <h3 className="mb-1.5 flex items-center gap-2 text-sm font-semibold">
            <Megaphone className="size-4" />
            重要な連絡事項
          </h3>
          <p className="text-sm leading-relaxed break-words whitespace-pre-wrap">
            {notice.content}
          </p>
        </section>
      ))}
      {roomId && (
        <Button
          variant="outline"
          className="w-full justify-between"
          nativeButton={false}
          render={<Link to="/chat/$roomId" params={{ roomId }} />}
        >
          <span className="flex items-center gap-2">
            <MessageSquare className="size-4" />
            {assignment.activityName}のチャットを開く
          </span>
          <span aria-hidden="true">→</span>
        </Button>
      )}
    </div>
  )
}

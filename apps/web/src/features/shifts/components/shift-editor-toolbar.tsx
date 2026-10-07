import {
  ClipboardCheck,
  Save,
  SlidersHorizontal,
  Redo2,
  Undo2,
} from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import type { EditorData } from "../editor-data"
import { japanDateWeekday, japanTime } from "@workspace/shared/japan-time"

export function ShiftEditorToolbar({
  activity,
  dirty,
  pending,
  conflicted,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onAttendance,
  onSave,
  onActions,
}: {
  activity: EditorData["activity"]
  dirty: boolean
  pending: boolean
  conflicted: boolean
  canUndo: boolean
  canRedo: boolean
  onUndo: () => void
  onRedo: () => void
  onAttendance: () => void
  onSave: () => void
  onActions: () => void
}) {
  return (
    <div className="flex shrink-0 items-center justify-between gap-2 px-4 py-3 sm:px-6">
      <span className="shrink-0 text-xs whitespace-nowrap sm:text-sm">
        {japanDateWeekday(activity.startsAt)}
        <span className="ml-2 tabular-nums">
          {japanTime(activity.startsAt)}–{japanTime(activity.endsAt)}
        </span>
      </span>
      <div className="flex items-center justify-end gap-1">
        <Button
          variant="outline"
          size="icon-sm"
          className="size-9 sm:size-10"
          aria-label="元に戻す"
          disabled={!canUndo || pending}
          onClick={onUndo}
        >
          <Undo2 />
        </Button>
        <Button
          variant="outline"
          size="icon-sm"
          className="size-9 sm:size-10"
          aria-label="やり直す"
          disabled={!canRedo || pending}
          onClick={onRedo}
        >
          <Redo2 />
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="size-9 px-0 sm:w-auto sm:px-3"

          disabled={pending}
          onClick={onAttendance}
        >
          <ClipboardCheck className="sm:hidden" />
          <span className="sr-only sm:not-sr-only">出勤・連絡</span>
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="size-9 px-0 sm:w-auto sm:px-3"
          disabled={pending || (!dirty && !conflicted)}
          onClick={onSave}
        >
          <Save className="sm:hidden" />
          <span className="sr-only sm:not-sr-only">
            {pending
              ? "保存中"
              : conflicted
                ? "競合を確認"
                : dirty
                  ? "変更を保存"
                  : "保存済み"}
          </span>
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="size-9 px-0 sm:w-auto sm:px-3"
          aria-label="シフトの詳細と操作"
          disabled={pending}
          onClick={onActions}
        >
          <SlidersHorizontal />
          <span className="sr-only sm:not-sr-only">詳細</span>
        </Button>
      </div>
    </div>
  )
}

import { MoreHorizontal, Redo2, Undo2 } from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import type { EditorData } from "../editor-data"
import { ShiftNavigation } from "./shift-navigation"

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
    <div className="flex shrink-0 flex-col gap-2 px-4 py-3 sm:px-6 md:flex-row md:items-center md:justify-between">
      <ShiftNavigation activity={activity} disabled={pending} />
      <div className="flex items-center justify-end gap-1">
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="元に戻す"
          disabled={!canUndo || pending}
          onClick={onUndo}
        >
          <Undo2 />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="やり直す"
          disabled={!canRedo || pending}
          onClick={onRedo}
        >
          <Redo2 />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="hidden md:inline-flex"
          onClick={onAttendance}
        >
          出勤・連絡
        </Button>
        <Button
          size="sm"
          disabled={pending || (!dirty && !conflicted)}
          onClick={onSave}
        >
          {pending
            ? "保存中"
            : conflicted
              ? "競合を確認"
              : dirty
                ? "変更を保存"
                : "保存済み"}
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="シフトの操作"
          onClick={onActions}
        >
          <MoreHorizontal />
        </Button>
      </div>
    </div>
  )
}

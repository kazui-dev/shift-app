import { AttendanceColorsControl } from "./attendance-colors-control"
import type { ReactNode } from "react"
import { ShiftWorkspaceToolbar } from "./shift-workspace-toolbar"
import {
  ClipboardCheck,
  Save,
  SlidersHorizontal,
  Redo2,
  Undo2,
} from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import { ManagementHeaderActions } from "@/features/management/components/header-actions"

export function ShiftEditorToolbar({
  attendanceColors,
  onAttendanceColorsChange,
  filters,
  selection,
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
  attendanceColors: boolean
  onAttendanceColorsChange: () => void
  filters: ReactNode
  selection: ReactNode
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
    <ShiftWorkspaceToolbar
      label="シフトの操作"
      selection={selection}
      actions={
        <>
          <AttendanceColorsControl
            checked={attendanceColors}
            onCheckedChange={onAttendanceColorsChange}
          />
          <Button
            variant="outline"
            size="icon-sm"
            aria-label="元に戻す"
            disabled={!canUndo || pending}
            onClick={onUndo}
          >
            <Undo2 />
          </Button>
          <Button
            variant="outline"
            size="icon-sm"
            aria-label="やり直す"
            disabled={!canRedo || pending}
            onClick={onRedo}
          >
            <Redo2 />
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="w-9 px-0 sm:w-auto sm:px-3"
            disabled={pending}
            onClick={onAttendance}
          >
            <ClipboardCheck className="sm:hidden" />
            <span className="sr-only sm:not-sr-only">勤怠・連絡</span>
          </Button>
          <ManagementHeaderActions>
            <Button
              data-save-shortcut
              variant="outline"
              size="sm"
              disabled={pending || (!dirty && !conflicted)}
              onClick={onSave}
            >
              <Save />
              <span>
                {pending
                  ? "保存中"
                  : conflicted
                    ? "競合を確認"
                    : dirty
                      ? "変更を保存"
                      : "保存済み"}
              </span>
            </Button>
          </ManagementHeaderActions>
          <Button
            variant="outline"
            size="sm"
            className="w-9 px-0 sm:w-auto sm:px-3"
            aria-label="シフトの詳細と操作"
            disabled={pending}
            onClick={onActions}
          >
            <SlidersHorizontal />
            <span className="sr-only sm:not-sr-only">詳細</span>
          </Button>
        </>
      }
    >
      {filters}
    </ShiftWorkspaceToolbar>
  )
}

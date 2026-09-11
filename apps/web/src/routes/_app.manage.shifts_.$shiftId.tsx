import { createFileRoute } from "@tanstack/react-router"
import { ShiftEditorPage } from "@/pages/shift-editor-page"
export const Route = createFileRoute("/_app/manage/shifts_/$shiftId")({
  component: ShiftEditorPage,
})

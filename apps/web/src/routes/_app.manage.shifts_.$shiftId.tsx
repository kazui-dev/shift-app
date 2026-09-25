import { createFileRoute } from "@tanstack/react-router"
import { activityQuery } from "@/features/shifts/data/activities"
import { ShiftEditorPage } from "@/features/shifts/pages/shift-editor-page"
export const Route = createFileRoute("/_app/manage/shifts_/$shiftId")({
  loader: ({ context, params }) =>
    context.queryClient.ensureQueryData(activityQuery(params.shiftId)),
  pendingMs: Infinity,
  component: ShiftEditorPage,
})
